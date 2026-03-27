/**
 * downloadDac.ts
 *
 * Downloads the CMS Doctors and Clinicians (DAC) National Downloadable File.
 * This file contains physician group practice affiliations (org_pac_id) and
 * is used to build the collaboration network feature.
 *
 * If the URL below has expired, visit:
 *   https://data.cms.gov/provider-data/dataset/mj5m-pzi6
 * and download the CSV manually, saving it to:
 *   raw/cms_dac_physicians.csv
 */

import https from "https";
import http from "http";
import fs from "fs";
import path from "path";

const RAW_DIR = path.join(__dirname, "raw");
const OUTPUT_FILE = "cms_dac_physicians.csv";

// Direct download URL for the DAC National Downloadable File.
// If this URL fails, go to https://data.cms.gov/provider-data/dataset/mj5m-pzi6
// and download the CSV manually.
const DAC_URL =
  "https://data.cms.gov/provider-data/sites/default/files/resources/52c3f098d7e56028a298fd297cb0b38d_1772834755/DAC_NationalDownloadableFile.csv";

const MIN_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

function downloadFile(url: string, destPath: string): Promise<void> {
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
                  `  https://data.cms.gov/provider-data/dataset/mj5m-pzi6\n` +
                  `  and download the CSV manually to raw/${OUTPUT_FILE}`
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

async function main() {
  if (!fs.existsSync(RAW_DIR)) {
    fs.mkdirSync(RAW_DIR, { recursive: true });
  }

  const destPath = path.join(RAW_DIR, OUTPUT_FILE);

  console.log("=== CMS DAC National Downloadable File ===\n");

  // Skip if file already exists and is large enough
  if (fs.existsSync(destPath)) {
    const stats = fs.statSync(destPath);
    if (stats.size > MIN_SIZE_BYTES) {
      console.log(
        `  [SKIP] ${OUTPUT_FILE} already exists (${(stats.size / 1024 / 1024).toFixed(1)} MB)`
      );
      console.log("  Delete the file and re-run to force a fresh download.");
      return;
    }
    // File exists but is too small — likely a partial/failed download
    console.log(
      `  [WARN] ${OUTPUT_FILE} exists but is only ${(stats.size / 1024 / 1024).toFixed(1)} MB — re-downloading`
    );
    fs.unlinkSync(destPath);
  }

  console.log(`  [DOWNLOAD] ${OUTPUT_FILE}`);
  console.log(`  CMS Doctors and Clinicians National Downloadable File`);
  console.log(`  URL: ${DAC_URL}\n`);
  console.log(
    "  NOTE: If this URL has expired, go to:\n" +
      "        https://data.cms.gov/provider-data/dataset/mj5m-pzi6\n" +
      `        and download the CSV manually to raw/${OUTPUT_FILE}\n`
  );

  try {
    await downloadFile(DAC_URL, destPath);
    console.log(`\n  Saved → ${destPath}`);
  } catch (err) {
    console.error("\n  [ERROR] Download failed:", err);
    console.log("\n  Manual download steps:");
    console.log("    1. Visit https://data.cms.gov/provider-data/dataset/mj5m-pzi6");
    console.log("    2. Click the CSV download link");
    console.log(`    3. Save as: ${destPath}`);
    process.exit(1);
  }

  console.log("\n=== Download complete ===");
  console.log("Next step: npm run process:dac  (ts-node processDac.ts)");
}

main().catch(console.error);
