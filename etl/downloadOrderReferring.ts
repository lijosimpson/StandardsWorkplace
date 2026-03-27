/**
 * downloadOrderReferring.ts
 *
 * Downloads the CMS Order and Referring Providers file (updated weekly).
 *
 * Tries multiple URLs in order. If all fail, prints manual download instructions.
 *
 * Output: raw/cms_order_referring.csv
 */

import https from "https";
import http from "http";
import fs from "fs";
import path from "path";

const RAW_DIR = path.join(__dirname, "raw");
const OUTPUT_FILE = path.join(RAW_DIR, "cms_order_referring.csv");
const MIN_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const CANDIDATE_URLS = [
  "https://data.cms.gov/sites/default/files/2026-01/bcf5e2e6-9555-424b-9ec9-7ba88815c095/OrderReferring_20260126.csv",
  "https://data.cms.gov/sites/default/files/2026-01/c0c3235c-8c57-42a2-a79d-ca9b4ad51537/OrderReferring_20260108.csv",
  "https://data.cms.gov/sites/default/files/2024-10/OrderReferring_20241001.csv"
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
          console.log(`\n    Done: ${(received / 1024 / 1024).toFixed(1)} MB saved`);
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
  console.log("Go to https://data.cms.gov/provider-characteristics/medicare-provider-supplier-enrollment/order-and-referring");
  console.log("and download the CSV");
  console.log(`Save as: ${OUTPUT_FILE}`);
  console.log("================================\n");
}

async function main() {
  if (!fs.existsSync(RAW_DIR)) {
    fs.mkdirSync(RAW_DIR, { recursive: true });
  }

  console.log("=== Download CMS Order and Referring Providers ===\n");

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

      const stats = fs.statSync(OUTPUT_FILE);
      if (stats.size < MIN_SIZE_BYTES) {
        console.log(`  Warning: file is only ${(stats.size / 1024 / 1024).toFixed(1)} MB — may be incomplete`);
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

  console.log("\nDone. Next step: ts-node processOrderReferring.ts");
}

main().catch(console.error);
