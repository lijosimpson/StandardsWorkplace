/**
 * processPartBPhysicianServices.ts
 *
 * Processes the CMS Part B Physician and Other Practitioners by Provider & Service CSV
 * into a filtered JSON output containing NGS, chemotherapy infusion, radiation therapy,
 * and pathology billing records.
 *
 * Input:  raw/cms_partb_physician_services.csv
 * Output: processed/partb_physician_services.json
 */

import fs from "fs";
import path from "path";
import { parse } from "csv-parse";

const RAW_DIR = path.join(__dirname, "raw");
const PROCESSED_DIR = path.join(__dirname, "processed");

const INPUT_FILE = path.join(RAW_DIR, "cms_partb_physician_services.csv");
const OUTPUT_FILE = path.join(PROCESSED_DIR, "partb_physician_services.json");

// HCPCS code sets
const NGS_CODES = new Set([
  "81445","81450","81455","81479","0037U","0038U","0111U","0172U","0239U","0242U",
  "81443","81306","81307","81408"
]);
const CHEMO_CODES = new Set([
  "96413","96415","96416","96417","96401","96402","96405","96406",
  "96420","96422","96423","96425"
]);
const RADIATION_CODES = new Set([
  "77263","77301","77305","77307","77316","77317","77318","77385","77386",
  "77402","77407","77412","79005","79101","79200","79300","79403","79440"
]);
const PATHOLOGY_CODES = new Set([
  "88305","88307","88309","88321","88323","88325","88341","88342","88344",
  "88360","88361","88365","88366","88367","88373","88374","88377"
]);

type ServiceCategory = "NGS" | "CHEMO" | "RADIATION" | "PATHOLOGY";

interface PartBServiceRecord {
  npi: string;
  provider_name: string;
  provider_type: string;
  city: string;
  state: string;
  zip: string;
  hcpcs_code: string;
  hcpcs_description: string;
  service_category: ServiceCategory;
  place_of_service: string;
  total_services: number;
  total_unique_benes: number;
  avg_submitted_charge: number;
  avg_medicare_payment: number;
  year: number;
}

function getCategory(hcpcs: string): ServiceCategory | null {
  if (NGS_CODES.has(hcpcs)) return "NGS";
  if (CHEMO_CODES.has(hcpcs)) return "CHEMO";
  if (RADIATION_CODES.has(hcpcs)) return "RADIATION";
  if (PATHOLOGY_CODES.has(hcpcs)) return "PATHOLOGY";
  return null;
}

function getField(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const val = row[key];
    if (val !== undefined && val !== null && val.trim() !== "") return val.trim();
  }
  return "";
}

function detectYear(filename: string): number {
  const match = filename.match(/(\d{4})/);
  if (match) {
    const y = parseInt(match[1], 10);
    if (y >= 2019 && y <= 2030) return y;
  }
  return 2022;
}

function transformRow(row: Record<string, string>, year: number): PartBServiceRecord | null {
  const hcpcs = getField(row, "HCPCS_Cd", "hcpcs_cd");
  if (!hcpcs) return null;

  const category = getCategory(hcpcs);
  if (!category) return null;

  const npi = getField(row, "Rndrng_NPI", "rndrng_npi");
  if (!npi) return null;

  const lastName = getField(row, "Rndrng_Prvdr_Last_Org_Name", "rndrng_prvdr_last_org_name");
  const firstName = getField(row, "Rndrng_Prvdr_First_Name", "rndrng_prvdr_first_name");
  const providerName = firstName ? `${firstName} ${lastName}`.trim() : lastName;

  return {
    npi,
    provider_name: providerName,
    provider_type: getField(row, "Rndrng_Prvdr_Type", "rndrng_prvdr_type"),
    city: getField(row, "Rndrng_Prvdr_City", "rndrng_prvdr_city"),
    state: getField(row, "Rndrng_Prvdr_State_Abrvtn", "rndrng_prvdr_state_abrvtn"),
    zip: getField(row, "Rndrng_Prvdr_Zip5", "rndrng_prvdr_zip5"),
    hcpcs_code: hcpcs,
    hcpcs_description: getField(row, "HCPCS_Desc", "hcpcs_desc"),
    service_category: category,
    place_of_service: getField(row, "Place_Of_Srvc", "place_of_srvc"),
    total_services: parseFloat(getField(row, "Tot_Srvcs", "tot_srvcs") || "0") || 0,
    total_unique_benes: parseInt(getField(row, "Tot_Benes", "tot_benes") || "0", 10) || 0,
    avg_submitted_charge: parseFloat(getField(row, "Avg_Sbmtd_Chrg", "avg_sbmtd_chrg") || "0") || 0,
    avg_medicare_payment: parseFloat(getField(row, "Avg_Mdcr_Pymt_Amt", "avg_mdcr_pymt_amt") || "0") || 0,
    year
  };
}

async function main() {
  if (!fs.existsSync(PROCESSED_DIR)) {
    fs.mkdirSync(PROCESSED_DIR, { recursive: true });
  }

  console.log("=== CMS Part B — Physician Services (NGS/Chemo/Radiation/Pathology) ===\n");

  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`  [ERROR] Input file not found: ${INPUT_FILE}`);
    console.error("  Run downloadPartB.ts first: ts-node downloadPartB.ts");
    process.exit(1);
  }

  const stats = fs.statSync(INPUT_FILE);
  const year = detectYear(INPUT_FILE);
  console.log(`  Input:  ${INPUT_FILE} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`  Output: ${OUTPUT_FILE}`);
  console.log(`  Detected year: ${year}\n`);

  const results: PartBServiceRecord[] = [];
  let totalRows = 0;
  const categoryCounts: Record<ServiceCategory, number> = { NGS: 0, CHEMO: 0, RADIATION: 0, PATHOLOGY: 0 };

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(INPUT_FILE)
      .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }))
      .on("data", (row: Record<string, string>) => {
        totalRows++;
        if (totalRows % 500_000 === 0) {
          process.stdout.write(
            `\r    Scanned ${totalRows.toLocaleString()} rows, kept ${results.length.toLocaleString()} ...`
          );
        }
        const record = transformRow(row, year);
        if (record) {
          results.push(record);
          categoryCounts[record.service_category]++;
        }
      })
      .on("end", () => {
        process.stdout.write("\n");
        console.log(`    Scanned ${totalRows.toLocaleString()} rows total`);
        console.log(`    Kept ${results.length.toLocaleString()} records`);
        console.log(`      NGS:       ${categoryCounts.NGS.toLocaleString()}`);
        console.log(`      CHEMO:     ${categoryCounts.CHEMO.toLocaleString()}`);
        console.log(`      RADIATION: ${categoryCounts.RADIATION.toLocaleString()}`);
        console.log(`      PATHOLOGY: ${categoryCounts.PATHOLOGY.toLocaleString()}`);

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
        console.log(`    Saved → ${OUTPUT_FILE}`);
        resolve();
      })
      .on("error", reject);
  });

  console.log("\nDone.");
}

main().catch(console.error);
