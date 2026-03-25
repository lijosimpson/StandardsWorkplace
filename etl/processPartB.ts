/**
 * processPartB.ts
 *
 * Filters Medicare Part B PUF (Provider & Service) CSV files down to
 * NGS, IHC, and FISH CPT codes only, and transforms column names to
 * match the ngs_lab_utilization Supabase table schema.
 *
 * Input:  raw/medicare_partb_YYYY.csv
 * Output: processed/ngs_lab_YYYY.json  (array of row objects)
 */

import fs from "fs";
import path from "path";
import { parse } from "csv-parse";

import ngsCodesConfig from "./config/ngs_codes.json";
import ihcCodesConfig from "./config/ihc_codes.json";

const RAW_DIR = path.join(__dirname, "raw");
const PROCESSED_DIR = path.join(__dirname, "processed");

const YEARS = [2022, 2023];

// Build lookup sets for fast membership testing
const ngsCodes = new Set(ngsCodesConfig.codes.map((c) => c.code));
const ihcCodes = new Set(ihcCodesConfig.codes.map((c) => c.code));

function getTestCategory(hcpcs: string): "NGS" | "IHC" | "FISH" | null {
  // FISH codes are a subset of IHC config
  const fishCodes = new Set(["88271", "88272", "88273", "88274", "88275", "88280", "88291"]);
  if (ngsCodes.has(hcpcs)) return "NGS";
  if (fishCodes.has(hcpcs)) return "FISH";
  if (ihcCodes.has(hcpcs)) return "IHC";
  return null;
}

// Map CMS column names → our schema
// CMS 2023 column names for Part B by Provider & Service:
function transformRow(raw: Record<string, string>, year: number): object | null {
  // Try both old and new CMS column name formats
  const hcpcs = (raw["HCPCS_Cd"] || raw["hcpcs_cd"] || "").trim();
  if (!hcpcs) return null;

  const category = getTestCategory(hcpcs);
  if (!category) return null;

  return {
    year,
    npi: (raw["Rndrng_NPI"] || raw["rndrng_npi"] || "").trim(),
    provider_last_name: (raw["Rndrng_Prvdr_Last_Org_Name"] || raw["rndrng_prvdr_last_org_name"] || "").trim(),
    provider_first_name: (raw["Rndrng_Prvdr_First_Name"] || raw["rndrng_prvdr_first_name"] || "").trim(),
    provider_credentials: (raw["Rndrng_Prvdr_Crdntls"] || raw["rndrng_prvdr_crdntls"] || "").trim(),
    provider_gender: (raw["Rndrng_Prvdr_Gndr"] || raw["rndrng_prvdr_gndr"] || "").trim() || null,
    provider_entity_type: (raw["Rndrng_Prvdr_Ent_Cd"] || raw["rndrng_prvdr_ent_cd"] || "").trim() || null,
    nppes_provider_street1: (raw["Rndrng_Prvdr_St1"] || raw["rndrng_prvdr_st1"] || "").trim(),
    nppes_provider_city: (raw["Rndrng_Prvdr_City"] || raw["rndrng_prvdr_city"] || "").trim(),
    nppes_provider_state: (raw["Rndrng_Prvdr_State_Abrvtn"] || raw["rndrng_prvdr_state_abrvtn"] || "").trim() || null,
    nppes_provider_zip: (raw["Rndrng_Prvdr_Zip5"] || raw["rndrng_prvdr_zip5"] || "").trim() || null,
    provider_country_code: (raw["Rndrng_Prvdr_Cntry"] || raw["rndrng_prvdr_cntry"] || "").trim() || null,
    provider_type: (raw["Rndrng_Prvdr_Type"] || raw["rndrng_prvdr_type"] || "").trim(),
    medicare_participation_indicator: (raw["Rndrng_Prvdr_Mdcr_Prtcptn_Ind"] || raw["rndrng_prvdr_mdcr_prtcptn_ind"] || "").trim() || null,
    hcpcs_code: hcpcs,
    hcpcs_description: (raw["HCPCS_Desc"] || raw["hcpcs_desc"] || "").trim(),
    test_category: category,
    line_srvc_cnt: parseFloat(raw["Tot_Srvcs"] || raw["tot_srvcs"] || "0") || null,
    bene_unique_cnt: parseInt(raw["Tot_Benes"] || raw["tot_benes"] || "0", 10) || null,
    bene_day_srvc_cnt: parseFloat(raw["Tot_Bene_Day_Srvcs"] || raw["tot_bene_day_srvcs"] || "0") || null,
    average_medicare_allowed_amt: parseFloat(raw["Avg_Mdcr_Alowd_Amt"] || raw["avg_mdcr_alowd_amt"] || "0") || null,
    average_submitted_chrg_amt: parseFloat(raw["Avg_Sbmtd_Chrg"] || raw["avg_sbmtd_chrg"] || "0") || null,
    average_medicare_payment_amt: parseFloat(raw["Avg_Mdcr_Pymt_Amt"] || raw["avg_mdcr_pymt_amt"] || "0") || null,
    average_medicare_standardized_amt: parseFloat(raw["Avg_Mdcr_Stdzd_Amt"] || raw["avg_mdcr_stdzd_amt"] || "0") || null
  };
}

async function processYear(year: number): Promise<void> {
  const inputPath = path.join(RAW_DIR, `medicare_partb_${year}.csv`);
  const outputPath = path.join(PROCESSED_DIR, `ngs_lab_${year}.json`);

  if (!fs.existsSync(inputPath)) {
    console.log(`  [SKIP] ${inputPath} not found — run downloadData.ts first`);
    return;
  }

  console.log(`  Processing Part B ${year}...`);
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
        console.log(`    Scanned ${totalRows.toLocaleString()} rows, kept ${rows.length.toLocaleString()} NGS/IHC/FISH rows`);
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

  console.log("=== Medicare Part B — NGS/IHC/FISH Filter ===\n");

  for (const year of YEARS) {
    await processYear(year);
  }

  console.log("\nDone. Next step: npm run process:partd");
}

main().catch(console.error);
