/**
 * processPartD.ts
 *
 * Filters Medicare Part D Prescriber PUF CSV files to oncology drugs only,
 * enriches rows with companion-dx flags, and transforms columns to match
 * the oncology_drug_prescribers Supabase table schema.
 *
 * Input:  raw/medicare_partd_YYYY.csv
 * Output: processed/oncology_prescribers_YYYY.json
 */

import fs from "fs";
import path from "path";
import { parse } from "csv-parse";

import oncologyDrugsConfig from "./config/oncology_drugs.json";
import companionDxMap from "./config/companion_dx_map.json";

const RAW_DIR = path.join(__dirname, "raw");
const PROCESSED_DIR = path.join(__dirname, "processed");

const YEARS = [2022, 2023];

// Build normalized drug lookup (lowercase, trimmed)
const oncologyDrugSet = new Set(oncologyDrugsConfig.drugs.map((d) => d.toLowerCase().trim()));

// Build companion dx lookup: generic name → { requires, test_type }
const companionDxLookup = new Map<string, { requires_companion_dx: boolean; companion_test_type: string }>();
for (const entry of companionDxMap.mappings) {
  companionDxLookup.set(entry.drug.toLowerCase().trim(), {
    requires_companion_dx: entry.requires_companion_dx,
    companion_test_type: entry.companion_test_type
  });
}

function isOncologyDrug(genericName: string, brandName: string): boolean {
  const g = genericName.toLowerCase().trim();
  const b = brandName.toLowerCase().trim();
  // Check exact match first, then partial match (e.g., "nab-paclitaxel" contains "paclitaxel")
  for (const drug of oncologyDrugSet) {
    if (g === drug || g.includes(drug) || drug.includes(g)) return true;
    if (b === drug || b.includes(drug)) return true;
  }
  return false;
}

function getCompanionDx(genericName: string): { requires_companion_dx: boolean; companion_test_type: string | null } {
  const g = genericName.toLowerCase().trim();
  for (const [key, value] of companionDxLookup) {
    if (g === key || g.includes(key) || key.includes(g)) {
      return value;
    }
  }
  return { requires_companion_dx: false, companion_test_type: null };
}

function transformRow(raw: Record<string, string>, year: number): object | null {
  const genericName = (raw["Gnrc_Name"] || raw["gnrc_name"] || "").trim();
  const brandName = (raw["Brnd_Name"] || raw["brnd_name"] || "").trim();

  if (!isOncologyDrug(genericName, brandName)) return null;

  const companion = getCompanionDx(genericName);

  return {
    year,
    npi: (raw["Prscrbr_NPI"] || raw["prscrbr_npi"] || "").trim(),
    nppes_provider_last_org_name: (raw["Prscrbr_Last_Org_Name"] || raw["prscrbr_last_org_name"] || "").trim(),
    nppes_provider_first_name: (raw["Prscrbr_First_Name"] || raw["prscrbr_first_name"] || "").trim(),
    nppes_provider_city: (raw["Prscrbr_City"] || raw["prscrbr_city"] || "").trim(),
    nppes_provider_state: (raw["Prscrbr_State_Abrvtn"] || raw["prscrbr_state_abrvtn"] || "").trim() || null,
    nppes_provider_zip5: (raw["Prscrbr_Zip5"] || raw["prscrbr_zip5"] || "").trim() || null,
    nppes_credentials: (raw["Prscrbr_Crdntls"] || raw["prscrbr_crdntls"] || "").trim() || null,
    provider_type: (raw["Prscrbr_Type"] || raw["prscrbr_type"] || "").trim(),
    description: (raw["Prscrbr_Type_Src"] || raw["prscrbr_type_src"] || "").trim() || null,
    drug_name: brandName || genericName,
    generic_name: genericName,
    drug_category: "Oncology",
    total_claim_count: parseInt(raw["Tot_Clms"] || raw["tot_clms"] || "0", 10) || null,
    total_30_day_fill_count: parseFloat(raw["Tot_30day_Fills"] || raw["tot_30day_fills"] || "0") || null,
    total_day_supply: parseInt(raw["Tot_Day_Suply"] || raw["tot_day_suply"] || "0", 10) || null,
    total_drug_cost: parseFloat(raw["Tot_Drug_Cst"] || raw["tot_drug_cst"] || "0") || null,
    bene_count: parseInt(raw["Tot_Benes"] || raw["tot_benes"] || "0", 10) || null,
    total_claim_count_ge65: parseInt(raw["GE65_Tot_Clms"] || raw["ge65_tot_clms"] || "0", 10) || null,
    total_drug_cost_ge65: parseFloat(raw["GE65_Tot_Drug_Cst"] || raw["ge65_tot_drug_cst"] || "0") || null,
    requires_companion_dx: companion.requires_companion_dx,
    companion_test_type: companion.companion_test_type
  };
}

async function processYear(year: number): Promise<void> {
  const inputPath = path.join(RAW_DIR, `medicare_partd_${year}.csv`);
  const outputPath = path.join(PROCESSED_DIR, `oncology_prescribers_${year}.json`);

  if (!fs.existsSync(inputPath)) {
    console.log(`  [SKIP] ${inputPath} not found — run downloadData.ts first`);
    return;
  }

  console.log(`  Processing Part D ${year}...`);
  const rows: object[] = [];
  let totalRows = 0;

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(inputPath)
      .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }))
      .on("data", (row: Record<string, string>) => {
        totalRows++;
        const transformed = transformRow(row, year);
        if (transformed) rows.push(transformed);
      })
      .on("end", () => {
        const withCompanion = rows.filter((r: any) => r.requires_companion_dx).length;
        console.log(`    Scanned ${totalRows.toLocaleString()} rows, kept ${rows.length.toLocaleString()} oncology rows`);
        console.log(`    → ${withCompanion.toLocaleString()} with companion diagnostic requirement`);
        fs.writeFileSync(outputPath, JSON.stringify(rows, null, 2));
        console.log(`    Saved → ${outputPath}`);
        resolve();
      })
      .on("error", reject);
  });
}

async function main() {
  if (!fs.existsSync(PROCESSED_DIR)) {
    fs.mkdirSync(PROCESSED_DIR, { recursive: true });
  }

  console.log("=== Medicare Part D — Oncology Drug Prescriber Filter ===\n");

  for (const year of YEARS) {
    await processYear(year);
  }

  console.log("\nDone. Next step: npm run process:payments");
}

main().catch(console.error);
