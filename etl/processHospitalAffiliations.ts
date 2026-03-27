/**
 * processHospitalAffiliations.ts
 *
 * Processes two CMS hospital CSV files to produce:
 *   - processed/hospital_directory.json
 *   - processed/physician_hospital_affiliations.json
 *
 * Input files:
 *   raw/cms_hospital_general.csv      — Hospital General Information (Care Compare)
 *   raw/cms_hospital_affiliations.csv — CMS DAC Hospital Affiliations
 */

import fs from "fs";
import path from "path";
import { parse } from "csv-parse";

const RAW_DIR = path.join(__dirname, "raw");
const PROCESSED_DIR = path.join(__dirname, "processed");

const HOSPITAL_GENERAL_FILE = path.join(RAW_DIR, "cms_hospital_general.csv");
const HOSPITAL_AFFILIATIONS_FILE = path.join(RAW_DIR, "cms_hospital_affiliations.csv");

const HOSPITAL_DIRECTORY_OUTPUT = path.join(PROCESSED_DIR, "hospital_directory.json");
const PHYSICIAN_HOSPITAL_AFFILIATIONS_OUTPUT = path.join(PROCESSED_DIR, "physician_hospital_affiliations.json");

interface HospitalDirectoryEntry {
  ccn: string;           // Provider ID / CCN
  pac_id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  hospital_type: string;
  ownership: string;
  health_system: string; // extracted from name
}

interface PhysicianHospitalAffiliation {
  ind_npi: string;
  hosp_ccn: string;
  hosp_pac_id: string;
  facility_name: string;
  city: string;
  state: string;
}

// Well-known health system prefixes (uppercase)
const HEALTH_SYSTEM_PREFIXES = [
  "HCA",
  "ASCENSION",
  "ADVENT HEALTH",
  "ADVENTHEALTH",
  "MAYO CLINIC",
  "CLEVELAND CLINIC",
  "JOHNS HOPKINS",
  "MEMORIAL SLOAN",
  "PROVIDENCE",
  "COMMONSPIRIT",
  "TRINITY HEALTH",
  "DIGNITY HEALTH",
  "TENET",
  "COMMUNITY HEALTH SYSTEMS",
  "CHS",
  "BANNER HEALTH",
  "PRISMA HEALTH",
  "WELLSTAR",
  "ATRIUM HEALTH",
  "NOVANT HEALTH",
  "PIEDMONT",
  "INTERMOUNTAIN",
  "INOVA",
  "NORTHWELL",
  "MOUNT SINAI",
  "NYU LANGONE",
  "SUTTER HEALTH",
  "SHARP HEALTHCARE",
  "SCRIPPS HEALTH",
  "KAISER",
  "VETERANS AFFAIRS",
  "VA HEALTH"
];

function extractHealthSystem(name: string): string {
  const upper = name.toUpperCase();
  for (const prefix of HEALTH_SYSTEM_PREFIXES) {
    if (upper.startsWith(prefix) || upper.includes(prefix)) {
      return prefix;
    }
  }
  return "";
}

function getField(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const val = row[key];
    if (val !== undefined && val !== null) return val.trim();
  }
  return "";
}

function readCsv(filePath: string): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const rows: Record<string, string>[] = [];
    fs.createReadStream(filePath)
      .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }))
      .on("data", (row: Record<string, string>) => rows.push(row))
      .on("end", () => resolve(rows))
      .on("error", reject);
  });
}

async function main() {
  if (!fs.existsSync(PROCESSED_DIR)) {
    fs.mkdirSync(PROCESSED_DIR, { recursive: true });
  }

  console.log("=== CMS Hospital Affiliations Processing ===\n");

  // Check input files
  if (!fs.existsSync(HOSPITAL_GENERAL_FILE)) {
    console.error(`  [ERROR] Input file not found: ${HOSPITAL_GENERAL_FILE}`);
    console.error("  Run downloadHospitalData.ts first: ts-node downloadHospitalData.ts");
    process.exit(1);
  }
  if (!fs.existsSync(HOSPITAL_AFFILIATIONS_FILE)) {
    console.error(`  [ERROR] Input file not found: ${HOSPITAL_AFFILIATIONS_FILE}`);
    console.error("  Run downloadHospitalData.ts first: ts-node downloadHospitalData.ts");
    process.exit(1);
  }

  console.log(`  Reading ${HOSPITAL_GENERAL_FILE} ...`);
  const generalRows = await readCsv(HOSPITAL_GENERAL_FILE);
  console.log(`  Read ${generalRows.length.toLocaleString()} hospital general rows`);

  console.log(`  Reading ${HOSPITAL_AFFILIATIONS_FILE} ...`);
  const affiliationRows = await readCsv(HOSPITAL_AFFILIATIONS_FILE);
  console.log(`  Read ${affiliationRows.length.toLocaleString()} hospital affiliation rows`);

  // Build a CCN → pac_id map from affiliations file
  const ccnToPacId = new Map<string, string>();
  for (const row of affiliationRows) {
    const ccn = getField(row, "Facility Affiliations Certification Number", "hosp_ccn");
    const pacId = getField(row, "hosp_pac_id");
    if (ccn && pacId && !ccnToPacId.has(ccn)) {
      ccnToPacId.set(ccn, pacId);
    }
  }

  // Process hospital directory
  console.log("\n  Building hospital directory...");
  const hospitalDirectory: HospitalDirectoryEntry[] = [];

  for (const row of generalRows) {
    const ccn = getField(row, "Provider ID", "Facility ID");
    if (!ccn) continue;

    const name = getField(row, "Hospital Name", "Facility Name");
    const zip = getField(row, "ZIP Code", "Zip Code");
    const zip5 = zip.length > 5 ? zip.slice(0, 5) : zip;

    hospitalDirectory.push({
      ccn,
      pac_id: ccnToPacId.get(ccn) || "",
      name,
      address: getField(row, "Address", "Street Address"),
      city: getField(row, "City", "City/Town"),
      state: getField(row, "State"),
      zip: zip5,
      phone: getField(row, "Phone Number"),
      hospital_type: getField(row, "Hospital Type"),
      ownership: getField(row, "Hospital Ownership"),
      health_system: extractHealthSystem(name)
    });
  }

  console.log(`  Built ${hospitalDirectory.length.toLocaleString()} hospital directory entries`);
  const withSystem = hospitalDirectory.filter(h => h.health_system !== "").length;
  console.log(`  ${withSystem.toLocaleString()} hospitals matched a known health system`);

  // Process physician-hospital affiliations
  console.log("\n  Building physician-hospital affiliations...");
  const physicianAffiliations: PhysicianHospitalAffiliation[] = [];

  // Build CCN → hospital info lookup from directory
  const ccnToHospital = new Map<string, { name: string; city: string; state: string; pac_id: string }>();
  for (const h of hospitalDirectory) {
    ccnToHospital.set(h.ccn, { name: h.name, city: h.city, state: h.state, pac_id: h.pac_id });
  }

  for (const row of affiliationRows) {
    const indNpi = getField(row, "NPI", "ind_npi");
    const hospCcn = getField(row, "Facility Affiliations Certification Number", "hosp_ccn");
    if (!indNpi || !hospCcn) continue;

    const hosp = ccnToHospital.get(hospCcn);
    physicianAffiliations.push({
      ind_npi: indNpi,
      hosp_ccn: hospCcn,
      hosp_pac_id: hosp?.pac_id || getField(row, "hosp_pac_id"),
      facility_name: hosp?.name || getField(row, "facility_name"),
      city: hosp?.city || getField(row, "city"),
      state: hosp?.state || getField(row, "state")
    });
  }

  console.log(`  Built ${physicianAffiliations.length.toLocaleString()} physician-hospital affiliation records`);

  // Write output files
  fs.writeFileSync(HOSPITAL_DIRECTORY_OUTPUT, JSON.stringify(hospitalDirectory, null, 2));
  console.log(`\n  Saved → ${HOSPITAL_DIRECTORY_OUTPUT}`);

  fs.writeFileSync(PHYSICIAN_HOSPITAL_AFFILIATIONS_OUTPUT, JSON.stringify(physicianAffiliations, null, 2));
  console.log(`  Saved → ${PHYSICIAN_HOSPITAL_AFFILIATIONS_OUTPUT}`);

  console.log("\nDone.");
}

main().catch(console.error);
