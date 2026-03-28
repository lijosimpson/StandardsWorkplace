#!/usr/bin/env node
/**
 * checkCmsUpdates.js
 *
 * Queries the CMS Data Portal API monthly to detect new or updated datasets.
 * Compares against scripts/cms-registry.json (last-seen modification dates).
 *
 * Usage:
 *   node scripts/checkCmsUpdates.js              # Check and print report
 *   node scripts/checkCmsUpdates.js --save       # Check, print, and update registry
 *   node scripts/checkCmsUpdates.js --json       # Output machine-readable JSON
 *
 * Called automatically by .github/workflows/cms-monthly-check.yml on the 1st of each month.
 */

"use strict";

const https = require("https");
const fs = require("fs");
const path = require("path");

const REGISTRY_FILE = path.join(__dirname, "cms-registry.json");
const SAVE = process.argv.includes("--save");
const JSON_OUTPUT = process.argv.includes("--json");

// ─── Dataset definitions ──────────────────────────────────────────────────────
// Each entry describes one CMS dataset we track.
// apiUrl:    DKAN search/metadata endpoint to check modification date
// matchKey:  substring to match in the result title (case-insensitive)
// portalUrl: human-readable landing page for manual review
// etlAction: what to update in the codebase when new data is detected
const DATASETS = [
  {
    key: "medicare_partb",
    label: "Medicare Part B — Physician/Other Practitioners by Provider & Service",
    // DKAN metadata endpoint — slug from portal URL
    apiUrl: "https://data.cms.gov/api/1/metastore/schemas/dataset/items/medicare-physician-other-practitioners-by-provider-and-service",
    portalUrl: "https://data.cms.gov/provider-summary-by-type-of-service/medicare-physician-other-practitioners/medicare-physician-other-practitioners-by-provider-and-service",
    etlAction: "Update URL in etl/downloadData.ts (medicare_partb_YYYY.csv) → run: cd etl && npm run download"
  },
  {
    key: "medicare_partd",
    label: "Medicare Part D — Prescribers by Provider and Drug",
    apiUrl: "https://data.cms.gov/api/1/metastore/schemas/dataset/items/medicare-part-d-prescribers-by-provider-and-drug",
    portalUrl: "https://data.cms.gov/provider-summary-by-type-of-service/medicare-part-d-prescribers/medicare-part-d-prescribers-by-provider-and-drug",
    etlAction: "Update URL in etl/downloadData.ts (medicare_partd_YYYY.csv) → run: cd etl && npm run download"
  },
  {
    key: "dac",
    label: "Doctors and Clinicians (DAC / PECOS)",
    apiUrl: "https://data.cms.gov/api/1/metastore/schemas/dataset/items/doctors-and-clinicians",
    portalUrl: "https://data.cms.gov/provider-data/dataset/mj5m-pzi6",
    etlAction: "Update URL in etl/downloadDac.ts → run: cd etl && npx ts-node downloadDac.ts"
  },
  {
    key: "hospital_general",
    label: "Hospital General Information",
    apiUrl: "https://data.cms.gov/api/1/metastore/schemas/dataset/items/hospital-general-information",
    portalUrl: "https://data.cms.gov/provider-data/dataset/xubh-q36u",
    etlAction: "Update URL in etl/downloadHospitalData.ts → re-run hospital ETL"
  },
  {
    key: "facility_affiliations",
    label: "Facility Affiliations (Physician-Hospital)",
    apiUrl: "https://data.cms.gov/api/1/metastore/schemas/dataset/items/facility-affiliations",
    portalUrl: "https://data.cms.gov/provider-data/dataset/45bf-edaf",
    etlAction: "Update URL in etl/downloadHospitalData.ts → re-run hospital affiliations ETL"
  },
  {
    key: "order_referring",
    label: "Order & Referring — Eligible Professionals",
    apiUrl: "https://data.cms.gov/api/1/metastore/schemas/dataset/items/order-and-referring",
    portalUrl: "https://data.cms.gov/provider-data/dataset/mj5m-pzi6",
    etlAction: "Update URL in etl/downloadOrderReferring.ts → run: cd etl && npx ts-node downloadOrderReferring.ts"
  },
  {
    key: "aco_mssp",
    label: "ACO MSSP — Shared Savings Program ACOs",
    apiUrl: "https://data.cms.gov/api/1/metastore/schemas/dataset/items/shared-savings-program-accountable-care-organizations-acos",
    portalUrl: "https://data.cms.gov/medicare-shared-savings-program/shared-savings-program-accountable-care-organizations-acos",
    etlAction: "Update URL in etl/downloadAco.ts → run: cd etl && npx ts-node downloadAco.ts"
  },
  {
    key: "open_payments",
    label: "CMS Open Payments — General Payments",
    // Open Payments uses a separate subdomain portal
    apiUrl: "https://openpaymentsdata.cms.gov/api/1/metastore/schemas/dataset/items/general-payment-data",
    portalUrl: "https://openpaymentsdata.cms.gov/datasets",
    etlAction: "Update URL in etl/downloadData.ts (open_payments_general_YYYY.csv) → run: cd etl && npm run download"
  }
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": "coc-cms-checker/1.0" } }, (res) => {
      let body = "";
      res.on("data", chunk => { body += chunk; });
      res.on("end", () => {
        if (res.statusCode === 404) return resolve(null); // dataset slug may differ
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error(`JSON parse error for ${url}: ${e.message}`)); }
      });
    });
    req.on("error", reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
  });
}

/** Extract the modification date string from a DKAN dataset item response. */
function extractModified(data) {
  if (!data) return null;
  // DKAN returns either a single object or an array
  const item = Array.isArray(data) ? data[0] : data;
  if (!item) return null;
  // Try common field names
  return item.modified || item.issued || item["dct:modified"] || null;
}

/** Extract the latest data year from DKAN dataset distributions (resource filenames). */
function extractLatestYear(data) {
  if (!data) return null;
  const item = Array.isArray(data) ? data[0] : data;
  if (!item) return null;

  // Look through distribution URLs for year patterns like _DY24_, _2024_, etc.
  const distributions = item.distribution || [];
  const years = [];
  for (const dist of distributions) {
    const url = dist.downloadURL || dist.accessURL || "";
    const match = url.match(/[_\/](?:DY|D|Y)?(\d{2,4})[_\/\.]/i);
    if (match) {
      const y = parseInt(match[1], 10);
      years.push(y < 100 ? 2000 + y : y); // handle 2-digit years like "24" → 2024
    }
  }
  return years.length > 0 ? Math.max(...years) : null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const nowIso = new Date().toISOString();

  // Load registry
  let registry = { _lastChecked: null, datasets: {} };
  if (fs.existsSync(REGISTRY_FILE)) {
    try { registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf8")); }
    catch { /* start fresh if corrupt */ }
  }

  const results = [];
  let hasUpdates = false;

  for (const ds of DATASETS) {
    const prev = registry.datasets[ds.key] || {};
    let currentModified = null;
    let currentYear = null;
    let fetchError = null;

    try {
      const data = await fetchJson(ds.apiUrl);
      currentModified = extractModified(data);
      currentYear = extractLatestYear(data);
    } catch (err) {
      fetchError = err.message;
    }

    const prevModified = prev.lastModified || null;
    const prevYear = prev.latestYear || null;

    const modifiedChanged = currentModified && prevModified && currentModified !== prevModified;
    const yearIncreased = currentYear && prevYear && currentYear > prevYear;
    const newlyTracked = currentModified && !prevModified;
    const isUpdated = modifiedChanged || yearIncreased;

    if (isUpdated) hasUpdates = true;

    results.push({
      key: ds.key,
      label: ds.label,
      portalUrl: ds.portalUrl,
      etlAction: ds.etlAction,
      prevModified,
      currentModified,
      prevYear,
      currentYear,
      isUpdated,
      newlyTracked,
      fetchError
    });

    // Update registry entry with latest known info
    registry.datasets[ds.key] = {
      label: ds.label,
      lastModified: currentModified || prevModified,
      latestYear: currentYear || prevYear,
      knownUrl: prev.knownUrl || null
    };
  }

  registry._lastChecked = nowIso;

  // ─── Output ────────────────────────────────────────────────────────────────

  if (JSON_OUTPUT) {
    const out = { hasUpdates, checkedAt: nowIso, results };
    process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  } else {
    const checkedDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    console.log(`\n${"=".repeat(70)}`);
    console.log(`  CMS Data Update Check — ${checkedDate}`);
    console.log("=".repeat(70));

    if (hasUpdates) {
      console.log("\n🆕  NEW OR UPDATED DATASETS DETECTED:\n");
    } else {
      console.log("\n✅  No updates detected — all datasets match the registry.\n");
    }

    for (const r of results) {
      const status = r.fetchError ? "⚠️  FETCH ERROR" : r.isUpdated ? "🆕  UPDATED" : "✓  Current";
      console.log(`  [${status}] ${r.label}`);
      if (r.fetchError) {
        console.log(`        Error: ${r.fetchError}`);
        console.log(`        Check manually: ${r.portalUrl}`);
      } else {
        if (r.isUpdated) {
          if (r.prevModified !== r.currentModified)
            console.log(`        Modified: ${r.prevModified || "unknown"} → ${r.currentModified}`);
          if (r.prevYear !== r.currentYear)
            console.log(`        Year:     ${r.prevYear || "unknown"} → ${r.currentYear} ← NEW YEAR AVAILABLE`);
          console.log(`        Action:   ${r.etlAction}`);
          console.log(`        Portal:   ${r.portalUrl}`);
        } else {
          const mod = r.currentModified ? `modified ${r.currentModified}` : "modification date unknown";
          const yr = r.currentYear ? `, year ${r.currentYear}` : "";
          console.log(`        ${mod}${yr}`);
        }
      }
      console.log();
    }

    const updateCount = results.filter(r => r.isUpdated).length;
    const errorCount = results.filter(r => r.fetchError).length;
    console.log(`${"─".repeat(70)}`);
    console.log(`  Checked ${results.length} datasets | ${updateCount} updated | ${errorCount} fetch errors`);
    console.log(`  Registry: scripts/cms-registry.json`);
    console.log("=".repeat(70) + "\n");
  }

  // ─── Save registry if --save flag ─────────────────────────────────────────
  if (SAVE) {
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2) + "\n", "utf8");
    if (!JSON_OUTPUT) console.log("Registry saved to", REGISTRY_FILE, "\n");
  }

  // Exit code 1 if updates found (lets CI detect changes easily)
  process.exit(hasUpdates ? 1 : 0);
}

main().catch(err => {
  console.error("Fatal error:", err.message);
  process.exit(2);
});
