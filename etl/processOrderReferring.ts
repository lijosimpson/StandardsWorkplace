/**
 * processOrderReferring.ts
 *
 * Processes the CMS Order and Referring Providers CSV into a JSON output.
 * Normalizes column headers to lowercase for robust parsing.
 *
 * Input:  raw/cms_order_referring.csv
 * Output: processed/order_referring_providers.json
 */

import fs from "fs";
import path from "path";
import { parse } from "csv-parse";

const RAW_DIR = path.join(__dirname, "raw");
const PROCESSED_DIR = path.join(__dirname, "processed");

const INPUT_FILE = path.join(RAW_DIR, "cms_order_referring.csv");
const OUTPUT_FILE = path.join(PROCESSED_DIR, "order_referring_providers.json");

interface OrderReferringProvider {
  npi: string;
  last_name: string;
  first_name: string;
  org_name: string;
  state: string;
  provider_type: string;
}

function normalizeHeaders(row: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[key.toLowerCase().trim()] = value;
    normalized[key.trim()] = value; // keep original too
  }
  return normalized;
}

function getField(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const val = row[key] ?? row[key.toLowerCase()];
    if (val !== undefined && val !== null && val.trim() !== "") return val.trim();
  }
  return "";
}

function transformRow(rawRow: Record<string, string>): OrderReferringProvider | null {
  const row = normalizeHeaders(rawRow);

  const npi = getField(row, "npi", "NPI");
  if (!npi) return null;

  return {
    npi,
    last_name: getField(row, "last name", "last_name", "LAST_NAME", "lastname"),
    first_name: getField(row, "first name", "first_name", "FIRST_NAME", "firstname"),
    org_name: getField(row, "organization name", "org_name", "Organization Name"),
    state: getField(row, "state code", "state_cd", "STATE_CD", "state", "State"),
    provider_type: getField(row, "provider type", "provider_type", "PRVDR_TYPE", "prvdr_type")
  };
}

async function main() {
  if (!fs.existsSync(PROCESSED_DIR)) {
    fs.mkdirSync(PROCESSED_DIR, { recursive: true });
  }

  console.log("=== CMS Order and Referring Providers ===\n");

  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`  [ERROR] Input file not found: ${INPUT_FILE}`);
    console.error("  Run downloadOrderReferring.ts first: ts-node downloadOrderReferring.ts");
    process.exit(1);
  }

  const stats = fs.statSync(INPUT_FILE);
  console.log(`  Input:  ${INPUT_FILE} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`  Output: ${OUTPUT_FILE}\n`);

  const results: OrderReferringProvider[] = [];
  let totalRows = 0;
  let skippedRows = 0;

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(INPUT_FILE)
      .pipe(parse({ columns: true, skip_empty_lines: true, trim: true, relax_quotes: true, relax_column_count: true }))
      .on("data", (row: Record<string, string>) => {
        totalRows++;
        if (totalRows % 100_000 === 0) {
          process.stdout.write(
            `\r    Scanned ${totalRows.toLocaleString()} rows, kept ${results.length.toLocaleString()} ...`
          );
        }
        const record = transformRow(row);
        if (record) {
          results.push(record);
        } else {
          skippedRows++;
        }
      })
      .on("end", () => {
        process.stdout.write("\n");
        console.log(`    Scanned ${totalRows.toLocaleString()} rows`);
        console.log(`    Kept ${results.length.toLocaleString()} order/referring provider records`);
        if (skippedRows > 0) {
          console.log(`    Skipped ${skippedRows.toLocaleString()} rows (missing NPI)`);
        }

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
        console.log(`    Saved → ${OUTPUT_FILE}`);
        resolve();
      })
      .on("error", reject);
  });

  console.log("\nDone.");
}

main().catch(console.error);
