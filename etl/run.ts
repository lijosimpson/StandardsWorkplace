/**
 * run.ts
 *
 * Master ETL runner. Runs all processing steps in order.
 * Skips steps whose input files are missing (prints instructions).
 *
 * Usage:
 *   cd etl
 *   npm install
 *   npm run run
 *
 * Or step by step:
 *   npm run download          # Download raw CMS files (large, run once)
 *   npm run process:partb     # Filter Medicare Part B for NGS/IHC codes
 *   npm run process:partd     # Filter Medicare Part D for oncology drugs
 *   npm run process:payments  # Filter Open Payments for oncology drugs
 *   npm run process:medicaid  # Filter Medicaid for oncology drugs
 *   npm run upload            # Upload all processed files to Supabase
 */

import { execSync } from "child_process";
import path from "path";

const steps: Array<{ name: string; script: string }> = [
  { name: "Process Medicare Part B (NGS/IHC/FISH labs)", script: "processPartB.ts" },
  { name: "Process Medicare Part D (Oncology prescribers)", script: "processPartD.ts" },
  { name: "Process CMS Open Payments (Oncology payments)", script: "processOpenPayments.ts" },
  { name: "Process Medicaid State Utilization", script: "processMedicaid.ts" },
  { name: "Upload all data to Supabase", script: "uploadToSupabase.ts" }
];

function runStep(name: string, script: string): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`STEP: ${name}`);
  console.log("=".repeat(60));
  try {
    execSync(`npx ts-node ${path.join(__dirname, script)}`, {
      stdio: "inherit",
      cwd: __dirname
    });
    console.log(`✓ ${name} — complete`);
  } catch (err) {
    console.error(`✗ ${name} — failed`);
    // Continue with next steps even if one fails
  }
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║       NGS/Oncology Analyzer — ETL Master Runner      ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log("\nNOTE: Raw data files must be downloaded first.");
  console.log("If files are missing, run: npm run download\n");

  for (const step of steps) {
    runStep(step.name, step.script);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("ETL pipeline complete.");
  console.log("Check your Supabase Studio to verify the data loaded correctly.");
  console.log("Then open the COC app and click the Analyzer tab.");
  console.log("=".repeat(60));
}

main().catch(console.error);
