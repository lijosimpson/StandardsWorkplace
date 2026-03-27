/**
 * downloadHospitalData.ts
 *
 * Downloads two CMS hospital data files used to build the hospital network feature:
 *   1. Hospital General Information (Care Compare)
 *   2. CMS DAC Hospital Affiliations
 *
 * If a URL fails, manual download instructions are printed.
 */

import https from "https";
import http from "http";
import fs from "fs";
import path from "path";

const RAW_DIR = path.join(__dirname, "raw");

interface DownloadTarget {
  name: string;
  url: string;
  outputFile: string;
  minSizeBytes: number;
  manualSearchTerm: string;
}

const TARGETS: DownloadTarget[] = [
  {
    name: "Hospital General Information (Care Compare)",
    url: "https://data.cms.gov/provider-data/api/1/datastore/query/xubh-q36u/0/download?format=csv",
    outputFile: "cms_hospital_general.csv",
    minSizeBytes: 1 * 1024 * 1024, // 1 MB
    manualSearchTerm: "Hospital General Information"
  },
  {
    name: "CMS DAC Hospital Affiliations",
    url: "https://data.cms.gov/provider-data/sites/default/files/resources/b7c4080ae144663e43353a9c35cd3f53_1772834760/Facility_Affiliation.csv",
    outputFile: "cms_hospital_affiliations.csv",
    minSizeBytes: 5 * 1024 * 1024, // 5 MB
    manualSearchTerm: "Hospital Affiliations"
  }
];

function downloadFile(url: string, destPath: string, outputFile: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(destPath);

    function doGet(targetUrl: string): void {
      const protocol = targetUrl.startsWith("https") ? https : http;

      protocol
        .get(targetUrl, (response) => {
          // Follow redirects (up to one hop)
          if (response.statusCode === 301 || response.statusCode === 302) {
            const redirectUrl = response.headers.location;
            if (!redirectUrl) {
              output.close();
              fs.unlinkSync(destPath);
              return reject(new Error("Redirect with no Location header"));
            }
            console.log(`    Redirecting → ${redirectUrl}`);
            return doGet(redirectUrl);
          }

          if (response.statusCode !== 200) {
            output.close();
            if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
            return reject(
              new Error(
                `HTTP ${response.statusCode} for ${targetUrl}\n` +
                  `  If the URL has expired, go to:\n` +
                  `  https://data.cms.gov/provider-data\n` +
                  `  and download the CSV manually to raw/${outputFile}`
              )
            );
          }

          const total = parseInt(response.headers["content-length"] || "0", 10);
          let received = 0;

          response.on("data", (chunk: Buffer) => {
            received += chunk.length;
            if (total > 0) {
              const pct = ((received / total) * 100).toFixed(1);
              process.stdout.write(
                `\r    Progress: ${pct}% (${(received / 1024 / 1024).toFixed(1)} MB / ${(total / 1024 / 1024).toFixed(1)} MB)`
              );
            } else {
              process.stdout.write(
                `\r    Downloaded: ${(received / 1024 / 1024).toFixed(1)} MB`
              );
            }
          });

          response.pipe(output);

          output.on("finish", () => {
            console.log(`\n    Done: ${(received / 1024 / 1024).toFixed(1)} MB`);
            resolve();
          });

          output.on("error", (err) => {
            if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
            reject(err);
          });
        })
        .on("error", (err) => {
          output.close();
          if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
          reject(err);
        });
    }

    doGet(url);
  });
}

async function downloadTarget(target: DownloadTarget): Promise<void> {
  const destPath = path.join(RAW_DIR, target.outputFile);

  console.log(`\n--- ${target.name} ---`);

  // Skip if file already exists and is large enough
  if (fs.existsSync(destPath)) {
    const stats = fs.statSync(destPath);
    if (stats.size > target.minSizeBytes) {
      console.log(
        `  [SKIP] ${target.outputFile} already exists (${(stats.size / 1024 / 1024).toFixed(1)} MB)`
      );
      console.log("  Delete the file and re-run to force a fresh download.");
      return;
    }
    // File exists but is too small — likely a partial/failed download
    console.log(
      `  [WARN] ${target.outputFile} exists but is only ${(stats.size / 1024 / 1024).toFixed(1)} MB — re-downloading`
    );
    fs.unlinkSync(destPath);
  }

  console.log(`  [DOWNLOAD] ${target.outputFile}`);
  console.log(`  URL: ${target.url}\n`);

  try {
    await downloadFile(target.url, destPath, target.outputFile);
    console.log(`  Saved → ${destPath}`);
  } catch (err) {
    console.error(`\n  [ERROR] Download failed for ${target.name}:`, err);
    console.log(`\n  Manual download steps:`);
    console.log(`    1. Visit https://data.cms.gov/provider-data`);
    console.log(`    2. Search for "${target.manualSearchTerm}"`);
    console.log(`    3. Click the CSV download link`);
    console.log(`    4. Save as: ${destPath}`);
  }
}

async function main() {
  if (!fs.existsSync(RAW_DIR)) {
    fs.mkdirSync(RAW_DIR, { recursive: true });
  }

  console.log("=== CMS Hospital Data Download ===");

  for (const target of TARGETS) {
    await downloadTarget(target);
  }

  console.log("\n=== Download complete ===");
  console.log("Next step: npm run process:hospital  (ts-node processHospitalAffiliations.ts)");
}

main().catch(console.error);
