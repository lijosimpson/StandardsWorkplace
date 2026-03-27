/**
 * processAco.ts
 *
 * Processes the CMS MSSP ACO directory CSV.
 *
 * The public file (PY2025_Medicare_Shared_Savings_Program_Participants.csv) is
 * an ACO-level directory — one row per ACO, NOT one row per physician NPI.
 * (Physician NPI → ACO mapping requires restricted ResDAC access.)
 *
 * We store: aco_id, aco_name, participant_name (par_lbn), service_states, performance_year.
 * The backend matches physicians to ACOs by fuzzy-matching their group practice
 * name against participant_name.
 *
 * Input:  raw/cms_aco_participants.csv
 * Output: processed/aco_participants.json
 *
 * Actual columns: aco_id, par_lbn, aco_name, aco_service_area, initial_start_date,
 *   current_start_date, enhanced_track, basic_track, high_revenue_aco, low_revenue_aco, ...
 */

import fs from "fs";
import path from "path";
import { parse } from "csv-parse";

const RAW_DIR = path.join(__dirname, "raw");
const PROCESSED_DIR = path.join(__dirname, "processed");

const INPUT_FILE = path.join(RAW_DIR, "cms_aco_participants.csv");
const OUTPUT_FILE = path.join(PROCESSED_DIR, "aco_participants.json");

interface AcoDirectoryEntry {
  aco_id: string;
  aco_name: string;
  participant_name: string;   // par_lbn — the practice/TIN legal name; used for group-name matching
  service_states: string;     // comma-separated state codes from aco_service_area
  performance_year: number;
  enhanced_track: boolean;
}

function getField(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const val = row[key] ?? row[key.toLowerCase()];
    if (val !== undefined && val !== null && val.trim() !== "") return val.trim();
  }
  return "";
}

function extractYear(dateStr: string): number {
  if (!dateStr) return 2025;
  const m = dateStr.match(/\d{4}/);
  return m ? parseInt(m[0], 10) : 2025;
}

function transformRow(row: Record<string, string>): AcoDirectoryEntry | null {
  const acoId = getField(row, "aco_id", "ACO_ID", "ACO ID");
  if (!acoId) return null;

  const startDate = getField(row, "current_start_date", "initial_start_date");
  const enhancedRaw = getField(row, "enhanced_track", "Enhanced_Track");

  return {
    aco_id: acoId,
    aco_name: getField(row, "aco_name", "ACO_Name", "ACO Name"),
    participant_name: getField(row, "par_lbn", "PAR_LBN", "Participant Legal Business Name"),
    service_states: getField(row, "aco_service_area", "ACO_Service_Area", "Service Area"),
    performance_year: extractYear(startDate),
    enhanced_track: enhancedRaw === "1" || enhancedRaw.toLowerCase() === "yes"
  };
}

async function main() {
  if (!fs.existsSync(PROCESSED_DIR)) {
    fs.mkdirSync(PROCESSED_DIR, { recursive: true });
  }

  console.log("=== CMS ACO Directory ===\n");
  console.log("  NOTE: Public file is ACO-level (not NPI-level).");
  console.log("  Physicians are matched to ACOs via group practice name fuzzy match.\n");

  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`  [ERROR] Input file not found: ${INPUT_FILE}`);
    console.error("  Run downloadAco.ts first: ts-node downloadAco.ts");
    process.exit(1);
  }

  const stats = fs.statSync(INPUT_FILE);
  console.log(`  Input:  ${INPUT_FILE} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`  Output: ${OUTPUT_FILE}\n`);

  const results: AcoDirectoryEntry[] = [];
  let totalRows = 0;
  let skippedRows = 0;

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(INPUT_FILE)
      .pipe(parse({ columns: true, skip_empty_lines: true, trim: true, relax_quotes: true }))
      .on("data", (row: Record<string, string>) => {
        totalRows++;
        const record = transformRow(row);
        if (record) {
          results.push(record);
        } else {
          skippedRows++;
        }
      })
      .on("end", () => {
        console.log(`    Scanned ${totalRows.toLocaleString()} rows`);
        console.log(`    Kept ${results.length.toLocaleString()} ACO directory entries`);
        if (skippedRows > 0) {
          console.log(`    Skipped ${skippedRows.toLocaleString()} rows (missing ACO ID)`);
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
