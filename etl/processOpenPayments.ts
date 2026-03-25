/**
 * processOpenPayments.ts
 *
 * Filters CMS Open Payments (Sunshine Act) General Payments CSV files to
 * rows involving oncology drugs only, and transforms columns to match
 * the open_payments_oncology Supabase table schema.
 *
 * Open Payments data is downloaded directly as CSV by downloadData.ts.
 * Files are saved to:
 *   raw/open_payments_general_2023.csv
 *   raw/open_payments_general_2022.csv
 *
 * Input:  raw/open_payments_general_YYYY.csv
 * Output: processed/open_payments_YYYY.json
 */

import fs from "fs";
import path from "path";
import { parse } from "csv-parse";

import oncologyDrugsConfig from "./config/oncology_drugs.json";

const RAW_DIR = path.join(__dirname, "raw");
const PROCESSED_DIR = path.join(__dirname, "processed");

const YEARS = [2022, 2023];

// Build normalized drug lookup
const oncologyDrugTerms = oncologyDrugsConfig.drugs.map((d) => d.toLowerCase().trim());

function isOncologyPayment(row: Record<string, string>): boolean {
  // Check all 5 drug/device name fields in Open Payments
  for (let i = 1; i <= 5; i++) {
    const field = row[`Name_of_Associated_Covered_Drug_or_Biological${i}`]
      || row[`name_of_associated_covered_drug_or_biological${i}`]
      || "";
    if (!field.trim()) continue;
    const normalized = field.toLowerCase().trim();
    for (const drug of oncologyDrugTerms) {
      if (normalized.includes(drug) || drug.includes(normalized)) return true;
    }
  }
  return false;
}

function getFirstDrugName(row: Record<string, string>): string {
  for (let i = 1; i <= 5; i++) {
    const field = row[`Name_of_Associated_Covered_Drug_or_Biological${i}`]
      || row[`name_of_associated_covered_drug_or_biological${i}`]
      || "";
    if (field.trim()) return field.trim();
  }
  return "";
}

function transformRow(raw: Record<string, string>, year: number): object | null {
  if (!isOncologyPayment(raw)) return null;

  const npi = (raw["Covered_Recipient_NPI"] || raw["covered_recipient_npi"] || "").trim();
  const amount = parseFloat(raw["Total_Amount_of_Payment_USDollars"] || raw["total_amount_of_payment_usdollars"] || "0");

  // Only include physician rows (not teaching hospitals)
  const recipientType = (raw["Covered_Recipient_Type"] || raw["covered_recipient_type"] || "").trim();
  if (recipientType.toLowerCase().includes("teaching hospital")) return null;

  return {
    year,
    physician_npi: npi || null,
    physician_first_name: (raw["Covered_Recipient_First_Name"] || raw["covered_recipient_first_name"] || "").trim() || null,
    physician_last_name: (raw["Covered_Recipient_Last_Name"] || raw["covered_recipient_last_name"] || "").trim() || null,
    physician_specialty: (
      raw["Covered_Recipient_Specialty_1"]
      || raw["covered_recipient_specialty_1"]
      || raw["Covered_Recipient_Primary_Type_1"]
      || raw["covered_recipient_primary_type_1"]
      || ""
    ).trim() || null,
    recipient_city: (raw["Recipient_City"] || raw["recipient_city"] || "").trim() || null,
    recipient_state: (raw["Recipient_State"] || raw["recipient_state"] || "").trim() || null,
    manufacturer_name: (
      raw["Applicable_Manufacturer_or_Applicable_GPO_Making_Payment_Name"]
      || raw["applicable_manufacturer_or_applicable_gpo_making_payment_name"]
      || ""
    ).trim() || null,
    drug_name: getFirstDrugName(raw) || null,
    total_amount_usd: amount,
    nature_of_payment: (raw["Nature_of_Payment_or_Transfer_of_Value"] || raw["nature_of_payment_or_transfer_of_value"] || "").trim() || null,
    form_of_payment: (raw["Form_of_Payment_or_Transfer_of_Value"] || raw["form_of_payment_or_transfer_of_value"] || "").trim() || null,
    number_of_payments: parseInt(raw["Number_of_Payments_Included_in_Total_Amount"] || raw["number_of_payments_included_in_total_amount"] || "1", 10) || 1,
    payment_publication_date: (raw["Payment_Publication_Date"] || raw["payment_publication_date"] || "").trim() || null
  };
}

async function processYear(year: number): Promise<void> {
  const inputPath = path.join(RAW_DIR, `open_payments_general_${year}.csv`);
  const outputPath = path.join(PROCESSED_DIR, `open_payments_${year}.json`);

  if (!fs.existsSync(inputPath)) {
    console.log(`  [SKIP] ${inputPath} not found`);
    console.log(`  Extract the General_Payment_Data CSV from the ZIP file and rename it to ${path.basename(inputPath)}`);
    return;
  }

  console.log(`  Processing Open Payments ${year}...`);
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
        console.log(`    Scanned ${totalRows.toLocaleString()} rows, kept ${rows.length.toLocaleString()} oncology payment rows`);
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

  console.log("=== CMS Open Payments — Oncology Drug Filter ===\n");

  for (const year of YEARS) {
    await processYear(year);
  }

  console.log("\nDone. Next step: npm run process:medicaid");
}

main().catch(console.error);
