/**
 * uploadToSupabase.ts
 *
 * Uploads all processed JSON data files to the Supabase analyzer tables.
 * Runs UPSERT to safely re-upload without creating duplicates.
 *
 * Requires environment variables:
 *   SUPABASE_URL=https://your-project.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
 *
 * Set these in /etl/.env (copy from /backend/.env.example)
 */

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env if present
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, "utf8");
  for (const line of env.split("\n")) {
    const [key, ...rest] = line.split("=");
    if (key && rest.length) {
      process.env[key.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
    }
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  console.error("Copy /backend/.env to /etl/.env and fill in your Supabase credentials.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const PROCESSED_DIR = path.join(__dirname, "processed");
const BATCH_SIZE = 500; // Supabase insert limit

interface UploadConfig {
  file: string;
  table: string;
  description: string;
  upsertOn?: string;   // column(s) to conflict on for upsert (e.g. "npi,year")
  clearFirst?: boolean; // truncate table before uploading
}

const UPLOAD_CONFIGS: UploadConfig[] = [
  { file: "ngs_lab_2022.json", table: "ngs_lab_utilization", description: "NGS/IHC labs 2022" },
  { file: "ngs_lab_2023.json", table: "ngs_lab_utilization", description: "NGS/IHC labs 2023" },
  { file: "oncology_prescribers_2022.json", table: "oncology_drug_prescribers", description: "Oncology prescribers 2022" },
  { file: "oncology_prescribers_2023.json", table: "oncology_drug_prescribers", description: "Oncology prescribers 2023" },
  { file: "open_payments_2022.json", table: "open_payments_oncology", description: "Open Payments 2022" },
  { file: "open_payments_2023.json", table: "open_payments_oncology", description: "Open Payments 2023" },
  { file: "medicaid_utilization_2022.json", table: "medicaid_drug_utilization", description: "Medicaid utilization 2022" },
  { file: "medicaid_utilization_2023.json", table: "medicaid_drug_utilization", description: "Medicaid utilization 2023" }
];

// Phase 2: Collaboration network tables (run with --collaboration flag)
const COLLABORATION_CONFIGS: UploadConfig[] = [
  { file: "oncology_providers_2022.json", table: "oncology_provider_profiles", description: "Oncology provider HCPCS profiles 2022", clearFirst: true, upsertOn: "npi,year" },
  { file: "oncology_providers_2023.json", table: "oncology_provider_profiles", description: "Oncology provider HCPCS profiles 2023", upsertOn: "npi,year" },
  { file: "oncology_group_affiliations.json", table: "physician_group_affiliations", description: "Physician group affiliations (DAC)", clearFirst: true },
];

// Phase 3: Hospital network tables (run with --hospital flag)
const HOSPITAL_CONFIGS: UploadConfig[] = [
  { file: "physician_locations.json", table: "physician_locations", description: "Physician practice locations (DAC all addresses)", clearFirst: true },
  { file: "hospital_directory.json", table: "hospital_directory", description: "Hospital directory (Care Compare)", clearFirst: true },
  { file: "physician_hospital_affiliations.json", table: "physician_hospital_affiliations", description: "Physician-hospital affiliations (DAC)", clearFirst: true },
];

// Phase 4: Enrichment tables (run with --enrichment flag)
const ENRICHMENT_CONFIGS: UploadConfig[] = [
  { file: "partb_physician_services.json", table: "partb_physician_services", description: "Part B physician services (NGS/chemo/radiation/pathology)", clearFirst: true },
  { file: "aco_participants.json", table: "aco_participants", description: "ACO participant lists (MSSP)", clearFirst: true },
  { file: "order_referring_providers.json", table: "order_referring_providers", description: "CMS Order and Referring eligible providers", clearFirst: true },
];

async function insertBatchWithRetry(table: string, batch: object[], batchNum: number, upsertOn?: string, maxRetries = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const { error } = upsertOn
      ? await supabase.from(table).upsert(batch as any, { onConflict: upsertOn })
      : await supabase.from(table).insert(batch);
    if (!error) return true;
    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, attempt * 1000));
    } else {
      console.warn(`\n    Batch ${batchNum} failed after ${maxRetries} attempts: ${error.message}`);
    }
  }
  return false;
}

async function clearTable(table: string): Promise<void> {
  // Delete all rows by matching id >= 0 (works for bigserial tables)
  const { error } = await supabase.from(table).delete().gte("id", 0);
  if (error) console.warn(`  Warning: could not clear ${table}: ${error.message}`);
}

async function uploadFile(config: UploadConfig): Promise<void> {
  const filePath = path.join(PROCESSED_DIR, config.file);

  if (!fs.existsSync(filePath)) {
    console.log(`  [SKIP] ${config.file} not found in processed/`);
    return;
  }

  const rows: object[] = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (rows.length === 0) {
    console.log(`  [SKIP] ${config.file} is empty`);
    return;
  }

  if (config.clearFirst) {
    process.stdout.write(`  Clearing ${config.table} ...`);
    await clearTable(config.table);
    console.log(" done");
  }

  console.log(`  Uploading ${config.description} (${rows.length.toLocaleString()} rows) → ${config.table}`);

  let uploaded = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const ok = await insertBatchWithRetry(config.table, batch, batchNum, config.upsertOn);
    if (ok) {
      uploaded += batch.length;
    } else {
      failed += batch.length;
    }
    process.stdout.write(`\r    ${uploaded.toLocaleString()} / ${rows.length.toLocaleString()} rows uploaded`);
  }

  console.log(`\n    Done: ${uploaded.toLocaleString()} uploaded${failed > 0 ? `, ${failed.toLocaleString()} failed` : ""}`);
}

async function main() {
  console.log("=== Upload to Supabase ===\n");
  console.log(`Project: ${SUPABASE_URL}\n`);

  const isCollaboration = process.argv.includes("--collaboration");
  const isHospital = process.argv.includes("--hospital");
  const isEnrichment = process.argv.includes("--enrichment");

  let configs: UploadConfig[];
  if (isHospital) {
    configs = HOSPITAL_CONFIGS;
    console.log("Mode: Hospital network tables (physician_locations, hospital_directory, physician_hospital_affiliations)\n");
  } else if (isCollaboration) {
    configs = COLLABORATION_CONFIGS;
    console.log("Mode: Collaboration tables (oncology_provider_profiles, physician_group_affiliations)\n");
  } else if (isEnrichment) {
    configs = ENRICHMENT_CONFIGS;
    console.log("Mode: Enrichment tables (partb_physician_services, aco_participants, order_referring_providers)\n");
  } else {
    configs = UPLOAD_CONFIGS;
  }

  for (const config of configs) {
    await uploadFile(config);
  }

  console.log("\n=== Upload complete ===");
  console.log("Verify the data in your Supabase Studio table editor.");
}

main().catch(console.error);
