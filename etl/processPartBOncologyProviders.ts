/**
 * processPartBOncologyProviders.ts
 *
 * Reads the Medicare Part B PUF (Provider & Service) CSV files and extracts
 * ALL oncology/hematology providers, aggregating per-NPI profiles with the
 * full set of HCPCS codes billed by each provider.
 *
 * Filtering criteria (either condition qualifies a row):
 *   1. Rndrng_Prvdr_Type matches any oncology/hematology type in
 *      config/oncology_provider_types.json (case-insensitive partial match)
 *   2. HCPCS_Cd falls within oncology-relevant code ranges:
 *      - 96401–96549  Chemotherapy administration
 *      - 96360–96376  Infusion therapy
 *      - 85025–85027  CBC / blood counts
 *      - 38220–38242  Bone marrow aspiration/biopsy
 *      - 88184–88189  Flow cytometry
 *
 * Input:  raw/medicare_partb_YYYY.csv
 * Output: processed/oncology_providers_YYYY.json  (array of per-NPI objects)
 */

import fs from "fs";
import path from "path";
import { parse } from "csv-parse";

import oncologyProviderTypesConfig from "./config/oncology_provider_types.json";

const RAW_DIR = path.join(__dirname, "raw");
const PROCESSED_DIR = path.join(__dirname, "processed");

const YEARS = [2022, 2023];

// Provider type strings for matching (lowercased for comparison)
const ONCOLOGY_TYPES_LOWER: string[] = oncologyProviderTypesConfig.types.map((t) =>
  t.toLowerCase()
);

// ── HCPCS code range helpers ──────────────────────────────────────────────────

/**
 * Returns true if a numeric HCPCS code falls within any of the defined
 * oncology-relevant ranges.
 */
function isOncologyHcpcs(code: string): boolean {
  const num = parseInt(code, 10);
  if (isNaN(num)) return false;

  return (
    (num >= 96401 && num <= 96549) || // Chemotherapy administration
    (num >= 96360 && num <= 96376) || // Infusion therapy
    (num >= 85025 && num <= 85027) || // CBC / blood counts
    (num >= 38220 && num <= 38242) || // Bone marrow aspiration/biopsy
    (num >= 88184 && num <= 88189)    // Flow cytometry
  );
}

/**
 * Returns true if the provider type string matches any oncology/hematology type
 * (case-insensitive partial match).
 */
function isOncologyProviderType(providerType: string): boolean {
  const lower = providerType.toLowerCase();
  return ONCOLOGY_TYPES_LOWER.some((t) => lower.includes(t) || t.includes(lower));
}

// ── Per-NPI accumulator ───────────────────────────────────────────────────────

interface NpiAccumulator {
  year: number;
  npi: string;
  provider_name: string;
  provider_city: string;
  provider_state: string;
  provider_zip: string;
  provider_type: string;
  total_services: number;
  bene_unique_cnt: number; // max across rows (not sum — avoid double-counting)
  hcpcs_codes: Set<string>;
}

function getField(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const val = row[key];
    if (val !== undefined && val !== null) return val.trim();
  }
  return "";
}

async function processYear(year: number): Promise<void> {
  const inputPath = path.join(RAW_DIR, `medicare_partb_${year}.csv`);
  const outputPath = path.join(PROCESSED_DIR, `oncology_providers_${year}.json`);

  if (!fs.existsSync(inputPath)) {
    console.log(`  [SKIP] ${inputPath} not found — run downloadData.ts first`);
    return;
  }

  console.log(`  Processing Part B ${year} for oncology providers...`);

  const byNpi = new Map<string, NpiAccumulator>();
  let totalRows = 0;
  let matchedRows = 0;

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(inputPath)
      .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }))
      .on("data", (row: Record<string, string>) => {
        totalRows++;

        if (totalRows % 500_000 === 0) {
          process.stdout.write(
            `\r    Scanned ${totalRows.toLocaleString()} rows, matched ${matchedRows.toLocaleString()} ...`
          );
        }

        const hcpcs = getField(row, "HCPCS_Cd", "hcpcs_cd");
        if (!hcpcs) return;

        const providerType = getField(row, "Rndrng_Prvdr_Type", "rndrng_prvdr_type");

        // Apply filter: oncology provider type OR oncology HCPCS code
        if (!isOncologyProviderType(providerType) && !isOncologyHcpcs(hcpcs)) return;

        matchedRows++;

        const npi = getField(row, "Rndrng_NPI", "rndrng_npi");
        if (!npi) return;

        const services = parseFloat(getField(row, "Tot_Srvcs", "tot_srvcs")) || 0;
        const benes = parseInt(getField(row, "Tot_Benes", "tot_benes"), 10) || 0;

        if (byNpi.has(npi)) {
          const acc = byNpi.get(npi)!;
          acc.total_services += services;
          // Use max for beneficiary count to avoid double-counting across service lines
          acc.bene_unique_cnt = Math.max(acc.bene_unique_cnt, benes);
          acc.hcpcs_codes.add(hcpcs);
        } else {
          const lastName = getField(row, "Rndrng_Prvdr_Last_Org_Name", "rndrng_prvdr_last_org_name");
          const firstName = getField(row, "Rndrng_Prvdr_First_Name", "rndrng_prvdr_first_name");
          const providerName = firstName
            ? `${lastName}, ${firstName}`
            : lastName;

          byNpi.set(npi, {
            year,
            npi,
            provider_name: providerName,
            provider_city: getField(row, "Rndrng_Prvdr_City", "rndrng_prvdr_city"),
            provider_state: getField(row, "Rndrng_Prvdr_State_Abrvtn", "rndrng_prvdr_state_abrvtn"),
            provider_zip: getField(row, "Rndrng_Prvdr_Zip5", "rndrng_prvdr_zip5"),
            provider_type: providerType,
            total_services: services,
            bene_unique_cnt: benes,
            hcpcs_codes: new Set([hcpcs])
          });
        }
      })
      .on("end", () => {
        process.stdout.write("\n");
        console.log(
          `    Scanned ${totalRows.toLocaleString()} rows, matched ${matchedRows.toLocaleString()} rows, found ${byNpi.size.toLocaleString()} unique NPIs`
        );

        // Serialize: convert Set → sorted Array
        const output = Array.from(byNpi.values()).map((acc) => ({
          year: acc.year,
          npi: acc.npi,
          provider_name: acc.provider_name,
          provider_city: acc.provider_city,
          provider_state: acc.provider_state,
          provider_zip: acc.provider_zip,
          provider_type: acc.provider_type,
          total_services: acc.total_services,
          bene_unique_cnt: acc.bene_unique_cnt,
          hcpcs_codes: Array.from(acc.hcpcs_codes).sort()
        }));

        fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
        console.log(`    Saved ${output.length.toLocaleString()} provider records → ${outputPath}`);
        resolve();
      })
      .on("error", reject);
  });
}

async function main() {
  if (!fs.existsSync(PROCESSED_DIR)) {
    fs.mkdirSync(PROCESSED_DIR, { recursive: true });
  }

  console.log("=== Medicare Part B — Oncology Provider Profiles ===\n");

  for (const year of YEARS) {
    await processYear(year);
  }

  console.log("\nDone.");
}

main().catch(console.error);
