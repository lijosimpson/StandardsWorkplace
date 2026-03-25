/**
 * enrichWithNPPES.ts
 *
 * Enriches a list of NPIs with provider information from the NPPES NPI Registry API.
 * Used to fill in missing specialty/address data for labs or prescribers.
 *
 * NPPES API: https://npiregistry.cms.hhs.gov/api/
 * Free, no API key required. Rate limit: ~20 requests/second.
 *
 * This script is OPTIONAL — the Medicare PUF files already contain most
 * provider details. Run this only if you want to fill gaps.
 *
 * Usage: ts-node enrichWithNPPES.ts <input.json> <output.json>
 *
 * The input JSON should be an array of objects with an `npi` field.
 */

import https from "https";
import fs from "fs";
import path from "path";

const NPPES_API = "https://npiregistry.cms.hhs.gov/api/?version=2.1&number=";
const RATE_LIMIT_MS = 100; // 10 requests/second to stay well under limits

interface NppesResult {
  npi: string;
  name: string;
  specialty: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchNppes(npi: string): Promise<NppesResult | null> {
  return new Promise((resolve) => {
    https.get(`${NPPES_API}${npi}`, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          const result = parsed.results?.[0];
          if (!result) return resolve(null);

          const basic = result.basic || {};
          const taxonomy = result.taxonomies?.find((t: any) => t.primary) || result.taxonomies?.[0] || {};
          const address = result.addresses?.find((a: any) => a.address_purpose === "LOCATION")
            || result.addresses?.[0]
            || {};

          resolve({
            npi,
            name: basic.organization_name
              || `${basic.first_name || ""} ${basic.last_name || ""}`.trim(),
            specialty: taxonomy.desc || "",
            city: address.city || "",
            state: address.state || "",
            zip: address.postal_code?.slice(0, 5) || "",
            phone: address.telephone_number || ""
          });
        } catch {
          resolve(null);
        }
      });
    }).on("error", () => resolve(null));
  });
}

async function main() {
  const [, , inputFile, outputFile] = process.argv;

  if (!inputFile || !outputFile) {
    console.log("Usage: ts-node enrichWithNPPES.ts <input.json> <output.json>");
    console.log("Example: ts-node enrichWithNPPES.ts processed/ngs_lab_2023.json processed/ngs_lab_2023_enriched.json");
    process.exit(1);
  }

  if (!fs.existsSync(inputFile)) {
    console.error(`Input file not found: ${inputFile}`);
    process.exit(1);
  }

  const rows: Array<Record<string, any>> = JSON.parse(fs.readFileSync(inputFile, "utf8"));
  console.log(`Loaded ${rows.length} rows from ${inputFile}`);

  // Collect unique NPIs that are missing data
  const npis = [...new Set(
    rows
      .filter((r) => r.npi && (!r.provider_type || !r.nppes_provider_state))
      .map((r) => r.npi as string)
  )];

  console.log(`Fetching NPPES data for ${npis.length} NPIs (rate-limited)...`);

  const cache = new Map<string, NppesResult | null>();
  let done = 0;

  for (const npi of npis) {
    const result = await fetchNppes(npi);
    cache.set(npi, result);
    done++;
    if (done % 50 === 0) {
      process.stdout.write(`\r  ${done}/${npis.length} NPIs fetched`);
    }
    await sleep(RATE_LIMIT_MS);
  }
  console.log(`\n  Done fetching NPPES data`);

  // Apply enrichment
  const enriched = rows.map((row) => {
    const nppes = cache.get(row.npi);
    if (!nppes) return row;
    return {
      ...row,
      provider_type: row.provider_type || nppes.specialty,
      nppes_provider_city: row.nppes_provider_city || nppes.city,
      nppes_provider_state: row.nppes_provider_state || nppes.state,
      nppes_provider_zip: row.nppes_provider_zip || nppes.zip
    };
  });

  fs.writeFileSync(outputFile, JSON.stringify(enriched, null, 2));
  console.log(`Saved enriched data → ${outputFile}`);
}

main().catch(console.error);
