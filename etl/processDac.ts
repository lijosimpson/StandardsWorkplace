/**
 * processDac.ts
 *
 * Processes the CMS Doctors and Clinicians (DAC) National Downloadable File
 * to extract oncology/hematology physicians and their group practice affiliations.
 * Group affiliations (org_pac_id) are the basis for the physician collaboration
 * network feature.
 *
 * Input:  raw/cms_dac_physicians.csv
 * Output: processed/oncology_group_affiliations.json
 *         processed/physician_locations.json
 *
 * DAC CSV columns used:
 *   npi, pac_id, enrl_id, lst_nm, frst_nm, mid_nm, suff, gndr, cred,
 *   med_sch, grd_yr, pri_spec, sec_spec_1..4, telehlth, org_nm, org_pac_id,
 *   num_org_mems, adr_ln_1, adr_ln_2, cty, st, zip, phn_numbr,
 *   ind_assgn, grp_assgn, adrs_id
 */

import fs from "fs";
import path from "path";
import { parse } from "csv-parse";

const RAW_DIR = path.join(__dirname, "raw");
const PROCESSED_DIR = path.join(__dirname, "processed");

const INPUT_FILE = path.join(RAW_DIR, "cms_dac_physicians.csv");
const OUTPUT_FILE = path.join(PROCESSED_DIR, "oncology_group_affiliations.json");
const LOCATIONS_OUTPUT_FILE = path.join(PROCESSED_DIR, "physician_locations.json");

// Specialty keywords that identify oncology/hematology physicians.
// Matched against pri_spec (case-insensitive).
const ONCOLOGY_SPECIALTY_KEYWORDS = [
  "HEMATOLOGY",
  "ONCOLOGY",
  "RADIATION",
  "GYNECOLOGIC ONCOLOGY",
  "SURGICAL ONCOLOGY",
  "PATHOLOGY",           // anatomic/clinical pathologists — essential for oncology dx
  "RADIOLOGY",           // diagnostic/interventional radiology, nuclear medicine
  "SURGERY",             // general, thoracic, colorectal, breast surgeons
];

interface GroupAffiliation {
  npi: string;
  provider_name: string;   // "FirstName LastName"
  specialty: string;       // pri_spec value
  group_pac_id: string | null;  // org_pac_id — links providers within a practice group
  group_name: string | null;    // org_nm
  provider_city: string;
  provider_state: string;
  provider_zip: string;
  credentials: string;
}

interface PhysicianLocation {
  npi: string;
  address_id: string;
  provider_name: string;
  specialty: string;
  credentials: string;
  address_line1: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  facility_name: string | null;
  org_pac_id: string | null;
}

function isOncologySpecialty(priSpec: string): boolean {
  const upper = priSpec.toUpperCase();
  return ONCOLOGY_SPECIALTY_KEYWORDS.some((kw) => upper.includes(kw));
}

function getField(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const val = row[key];
    if (val !== undefined && val !== null) return val.trim();
  }
  return "";
}

function transformRow(row: Record<string, string>): { affiliation: GroupAffiliation; location: PhysicianLocation } | null {
  const priSpec = getField(row, "pri_spec");
  if (!priSpec || !isOncologySpecialty(priSpec)) return null;

  // Actual DAC CSV headers (verified against downloaded file):
  // NPI, Provider Last Name, Provider First Name, Cred, City/Town, State, ZIP Code, Facility Name, org_pac_id
  const npi = getField(row, "NPI", "npi");
  if (!npi) return null;

  const firstName = getField(row, "Provider First Name", "frst_nm");
  const lastName  = getField(row, "Provider Last Name",  "lst_nm");
  const suffix    = getField(row, "suff");
  const providerName = [firstName, lastName, suffix].filter(Boolean).join(" ");

  const orgPacId = getField(row, "org_pac_id") || null;
  const orgNm    = getField(row, "Facility Name", "org_nm") || null;

  const zip  = getField(row, "ZIP Code", "zip");
  const zip5 = zip.length > 5 ? zip.slice(0, 5) : zip;

  const credentials = getField(row, "Cred", "cred");
  const city  = getField(row, "City/Town", "cty");
  const state = getField(row, "State", "st");

  const affiliation: GroupAffiliation = {
    npi,
    provider_name: providerName,
    specialty: priSpec,
    group_pac_id: orgPacId,
    group_name: orgNm,
    provider_city:  city,
    provider_state: state,
    provider_zip:   zip5,
    credentials
  };

  const location: PhysicianLocation = {
    npi,
    address_id:   getField(row, "adrs_id"),
    provider_name: providerName,
    specialty: priSpec,
    credentials,
    address_line1: getField(row, "adr_ln_1"),
    city,
    state,
    zip: zip5,
    phone:         getField(row, "Telephone Number", "phn_numbr"),
    facility_name: orgNm,
    org_pac_id:    orgPacId
  };

  return { affiliation, location };
}

async function main() {
  if (!fs.existsSync(PROCESSED_DIR)) {
    fs.mkdirSync(PROCESSED_DIR, { recursive: true });
  }

  console.log("=== CMS DAC — Oncology Group Affiliations ===\n");

  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`  [ERROR] Input file not found: ${INPUT_FILE}`);
    console.error("  Run downloadDac.ts first: ts-node downloadDac.ts");
    process.exit(1);
  }

  const stats = fs.statSync(INPUT_FILE);
  console.log(`  Input:  ${INPUT_FILE} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`  Output: ${OUTPUT_FILE}`);
  console.log(`  Output: ${LOCATIONS_OUTPUT_FILE}\n`);

  const results: GroupAffiliation[] = [];
  const locationResults: PhysicianLocation[] = [];
  let totalRows = 0;
  let matchedRows = 0;

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(INPUT_FILE)
      .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }))
      .on("data", (row: Record<string, string>) => {
        totalRows++;

        if (totalRows % 100_000 === 0) {
          process.stdout.write(
            `\r    Scanned ${totalRows.toLocaleString()} rows, matched ${matchedRows.toLocaleString()} ...`
          );
        }

        const record = transformRow(row);
        if (record) {
          matchedRows++;
          results.push(record.affiliation);
          locationResults.push(record.location);
        }
      })
      .on("end", () => {
        process.stdout.write("\n");
        console.log(
          `    Scanned ${totalRows.toLocaleString()} rows, kept ${matchedRows.toLocaleString()} oncology/hematology providers`
        );

        // Count how many have group affiliations
        const withGroup = results.filter((r) => r.group_pac_id !== null).length;
        console.log(
          `    ${withGroup.toLocaleString()} providers have a group practice affiliation (org_pac_id)`
        );

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
        console.log(`    Saved → ${OUTPUT_FILE}`);

        fs.writeFileSync(LOCATIONS_OUTPUT_FILE, JSON.stringify(locationResults, null, 2));
        console.log(`    Saved → ${LOCATIONS_OUTPUT_FILE}`);
        resolve();
      })
      .on("error", reject);
  });

  console.log("\nDone.");
}

main().catch(console.error);
