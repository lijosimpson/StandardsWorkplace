/**
 * downloadPartB.ts
 *
 * Downloads the Medicare Physician and Other Practitioners by Provider and Service CSV
 * (CMS Part B PUF) for the most recent available year.
 *
 * Tries multiple URLs in order. If all fail, prints manual download instructions.
 *
 * Output: raw/cms_partb_physician_services.csv
 */

import https from "https";
import http from "http";
import fs from "fs";
import path from "path";

const RAW_DIR = path.join(__dirname, "raw");
const OUTPUT_FILE = path.join(RAW_DIR, "cms_partb_physician_services.csv");
const MIN_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

const CANDIDATE_URLS = [
  "https://data.cms.gov/sites/default/files/2025-04/e3f823f8-db5b-4cc7-ba04-e7ae92b99757/MUP_PHY_R25_P05_V20_D23_Prov_Svc.csv",
  "https://data.cms.gov/sites/default/files/2024-11/9767cb68-1b7e-451c-a5f7-48b8e2bdc6c0/MUP_PHY_R24_P05_V10_D22_Prov_Svc.csv"
];

function downloadUrl(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(dest);
    const protocol = url.startsWith("https") ? https : http;

    const makeRequest = (reqUrl: string) => {
      protocol.get(reqUrl, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location!;
          console.log(`    Redirecting to: ${redirectUrl}`);
          makeRequest(redirectUrl);
          return;
        }

        if (response.statusCode !== 200) {
          output.close();
          if (fs.existsSync(dest)) fs.unlinkSync(dest);
          return reject(new Error(`HTTP ${response.statusCode} for ${reqUrl}`));
        }

        const total = parseInt(response.headers["content-length"] || "0", 10);
        let received = 0;

        response.on("data", (chunk: Buffer) => {
          received += chunk.length;
          if (total > 0) {
            const pct = ((received / total) * 100).toFixed(1);
            process.stdout.write(`\r    Progress: ${pct}% (${(received / 1024 / 1024).toFixed(1)} MB)`);
          } else {
            process.stdout.write(`\r    Downloaded: ${(received / 1024 / 1024).toFixed(1)} MB`);
          }
        });

        response.pipe(output);
        output.on("finish", () => {
          console.log(`\n    Done: ${(received / 1024 / 1024).toFixed(1)} MB saved to ${dest}`);
          resolve();
        });
      }).on("error", (err) => {
        output.close();
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        reject(err);
      });
    };

    makeRequest(url);
  });
}

function printManualInstructions(): void {
  console.log("\n=== MANUAL DOWNLOAD REQUIRED ===");
  console.log("Manual download: Go to https://data.cms.gov/provider-summary-by-type-of-service/medicare-physician-other-practitioners/medicare-physician-other-practitioners-by-provider-and-service");
  console.log("Click \"Data\" tab -> download the Provider and Service CSV file (2022 or 2023)");
  console.log(`Save as: ${OUTPUT_FILE}`);
  console.log("================================\n");
}

async function main() {
  if (!fs.existsSync(RAW_DIR)) {
    fs.mkdirSync(RAW_DIR, { recursive: true });
  }

  console.log("=== Download CMS Part B Physician Services ===\n");

  // Skip if already downloaded and large enough
  if (fs.existsSync(OUTPUT_FILE)) {
    const stats = fs.statSync(OUTPUT_FILE);
    if (stats.size >= MIN_SIZE_BYTES) {
      console.log(`  [SKIP] ${OUTPUT_FILE} already exists (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
      return;
    }
    console.log(`  Existing file too small (${(stats.size / 1024 / 1024).toFixed(1)} MB), re-downloading...`);
  }

  let success = false;
  for (const url of CANDIDATE_URLS) {
    console.log(`  Trying: ${url}`);
    try {
      await downloadUrl(url, OUTPUT_FILE);

      // Verify size
      const stats = fs.statSync(OUTPUT_FILE);
      if (stats.size < MIN_SIZE_BYTES) {
        console.log(`  Warning: file is only ${(stats.size / 1024 / 1024).toFixed(1)} MB — may be incomplete or wrong format`);
      }
      success = true;
      break;
    } catch (err: any) {
      console.log(`  Failed: ${err.message}`);
      if (fs.existsSync(OUTPUT_FILE)) fs.unlinkSync(OUTPUT_FILE);
    }
  }

  if (!success) {
    console.error("\n  All download URLs failed.");
    printManualInstructions();
    process.exit(1);
  }

  console.log("\nDone. Next step: ts-node processPartBPhysicianServices.ts");
}

main().catch(console.error);
