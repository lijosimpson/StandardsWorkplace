/**
 * processMedicaid.ts
 *
 * Processes Medicaid State Drug Utilization Data, filtering to oncology drugs.
 * Medicaid data is available via the CMS Medicaid.gov API as CSV downloads.
 *
 * Data source: https://data.medicaid.gov/
 * Navigate to: Drug Utilization > State Drug Utilization Data
 *
 * The Medicaid data uses NDC (National Drug Codes), so we match by drug name
 * from the dataset's "SUPPRESSION USED" and related fields.
 *
 * Input:  raw/medicaid_utilization_YYYY.csv  (download manually from data.medicaid.gov)
 * Output: processed/medicaid_utilization_YYYY.json
 *
 * HOW TO DOWNLOAD MEDICAID DATA:
 * 1. Go to https://data.medicaid.gov/
 * 2. Click "Drug Utilization" → "State Drug Utilization Data"
 * 3. Filter by year, export as CSV
 * 4. Save to raw/medicaid_utilization_YYYY.csv
 */

import fs from "fs";
import path from "path";
import { parse } from "csv-parse";

import oncologyDrugsConfig from "./config/oncology_drugs.json";

const RAW_DIR = path.join(__dirname, "raw");
const PROCESSED_DIR = path.join(__dirname, "processed");

const YEARS = [2022, 2023];

const oncologyDrugTerms = oncologyDrugsConfig.drugs.map((d) => d.toLowerCase().trim());

function isOncologyDrug(drugName: string): boolean {
  const n = drugName.toLowerCase().trim();
  for (const term of oncologyDrugTerms) {
    if (n.includes(term) || term.includes(n)) return true;
  }
  return false;
}

// Medicaid data column names vary by source. We handle common variants.
function transformRow(raw: Record<string, string>, year: number): object | null {
  // Try various column name formats from different Medicaid data exports
  const drugName = (
    raw["DRUG_NAME"] || raw["drug_name"] ||
    raw["Product Name"] || raw["product_name"] ||
    raw["LABEL_NAME"] || raw["label_name"] || ""
  ).trim();

  if (!drugName || !isOncologyDrug(drugName)) return null;

  const stateCode = (
    raw["STATE"] || raw["state"] ||
    raw["State"] || raw["state_code"] ||
    raw["STATEFP"] || ""
  ).trim();

  if (!stateCode || stateCode.length > 2) return null;

  const quarterRaw = (raw["QUARTER"] || raw["quarter"] || raw["Quarter"] || "").trim();
  const quarter = quarterRaw ? parseInt(quarterRaw, 10) : null;

  return {
    year,
    quarter: (quarter && quarter >= 1 && quarter <= 4) ? quarter : null,
    state_code: stateCode,
    labeler_code: (raw["LABELER_CODE"] || raw["labeler_code"] || "").trim() || null,
    product_code: (raw["PRODUCT_CODE"] || raw["product_code"] || "").trim() || null,
    ndc: (raw["NDC"] || raw["ndc"] || raw["NATIONAL_DRUG_CODE"] || "").trim() || null,
    utilization_type: (raw["UTILIZATION_TYPE"] || raw["utilization_type"] || "").trim() || null,
    suppression_used: (raw["SUPPRESSION_USED"] || raw["suppression_used"] || "").trim() || null,
    units_reimbursed: parseFloat(raw["UNITS_REIMBURSED"] || raw["units_reimbursed"] || raw["Number of Units"] || "0") || null,
    number_of_prescriptions: parseInt(raw["NUMBER_OF_PRESCRIPTIONS"] || raw["number_of_prescriptions"] || raw["Number of Prescriptions"] || "0", 10) || null,
    total_amount_reimbursed: parseFloat(raw["TOTAL_AMOUNT_REIMBURSED"] || raw["total_amount_reimbursed"] || raw["Total Amount Reimbursed"] || "0") || null,
    medicaid_amount_reimbursed: parseFloat(raw["MEDICAID_AMOUNT_REIMBURSED"] || raw["medicaid_amount_reimbursed"] || raw["Medicaid Amount Reimbursed"] || "0") || null,
    non_medicaid_amount_reimbursed: parseFloat(raw["NON_MEDICAID_AMOUNT_REIMBURSED"] || raw["non_medicaid_amount_reimbursed"] || "0") || null,
    drug_name: drugName,
    drug_category: "Oncology"
  };
}

async function processYear(year: number): Promise<void> {
  const inputPath = path.join(RAW_DIR, `medicaid_utilization_${year}.csv`);
  const outputPath = path.join(PROCESSED_DIR, `medicaid_utilization_${year}.json`);

  if (!fs.existsSync(inputPath)) {
    console.log(`  [SKIP] ${inputPath} not found`);
    console.log(`  Download Medicaid State Drug Utilization data for ${year} from data.medicaid.gov`);
    return;
  }

  console.log(`  Processing Medicaid ${year}...`);
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
        console.log(`    Scanned ${totalRows.toLocaleString()} rows, kept ${rows.length.toLocaleString()} oncology rows`);
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

  console.log("=== Medicaid State Drug Utilization — Oncology Filter ===\n");

  for (const year of YEARS) {
    await processYear(year);
  }

  console.log("\nDone. Next step: npm run upload");
}

main().catch(console.error);
