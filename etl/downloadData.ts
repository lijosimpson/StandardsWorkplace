/**
 * downloadData.ts
 *
 * Downloads raw CMS data files for the analyzer ETL pipeline.
 *
 * Files are large (100MB–2GB). This script streams them to /raw/ with progress.
 * You only need to run this once (or when you want to update to a new year).
 *
 * NOTE: The CMS download links change each year. Check the URLs in DATA_FILES
 * and update them for each new data release.
 */

import https from "https";
import http from "http";
import fs from "fs";
import path from "path";

const RAW_DIR = path.join(__dirname, "raw");

interface DataFile {
  name: string;
  url: string;
  description: string;
  year: number;
}

// ─── UPDATE THESE URLS each year from the CMS data portal ───────────────────
//
// Medicare Part B: https://data.cms.gov/provider-summary-by-type-of-service/
//   medicare-physician-other-practitioners/medicare-physician-other-practitioners-by-provider-and-service
//
// Medicare Part D: https://data.cms.gov/provider-summary-by-type-of-service/
//   medicare-part-d-prescribers/medicare-part-d-prescribers-by-provider-and-drug
//
// Open Payments: https://openpaymentsdata.cms.gov/datasets
//
// Medicaid: https://data.medicaid.gov/
//
// NPPES Bulk: https://download.cms.gov/nppes/NPI_Files.html
// ─────────────────────────────────────────────────────────────────────────────

const DATA_FILES: DataFile[] = [
  {
    name: "medicare_partb_2023.csv",
    url: "https://data.cms.gov/sites/default/files/2025-04/e3f823f8-db5b-4cc7-ba04-e7ae92b99757/MUP_PHY_R25_P05_V20_D23_Prov_Svc.csv",
    description: "Medicare Part B Physician/Other Practitioners by Provider & Service, CY2023",
    year: 2023
  },
  {
    name: "medicare_partb_2022.csv",
    url: "https://data.cms.gov/sites/default/files/2025-11/53fb2bae-4913-48dc-a6d4-d8c025906567/MUP_PHY_R25_P05_V20_D22_Prov_Svc.csv",
    description: "Medicare Part B Physician/Other Practitioners by Provider & Service, CY2022",
    year: 2022
  },
  {
    name: "medicare_partd_2023.csv",
    url: "https://data.cms.gov/sites/default/files/2025-04/0d5915ce-002c-4d87-bde8-24ffb08bb6cc/MUP_DPR_RY25_P04_V10_DY23_NPIBN.csv",
    description: "Medicare Part D Prescribers by Provider and Drug, CY2023",
    year: 2023
  },
  {
    name: "medicare_partd_2022.csv",
    url: "https://data.cms.gov/sites/default/files/2024-05/18f82097-61a6-4889-9941-9a0b6ad7523c/MUP_DPR_RY24_P04_V10_DY22_NPIBN.csv",
    description: "Medicare Part D Prescribers by Provider and Drug, CY2022",
    year: 2022
  },
  {
    name: "open_payments_general_2023.csv",
    url: "https://download.cms.gov/openpayments/PGYR2023_P01232026_01102026/OP_DTL_GNRL_PGYR2023_P01232026_01102026.csv",
    description: "CMS Open Payments General Payments, PY2023",
    year: 2023
  },
  {
    name: "open_payments_general_2022.csv",
    url: "https://download.cms.gov/openpayments/PGYR2022_P01232026_01102026/OP_DTL_GNRL_PGYR2022_P01232026_01102026.csv",
    description: "CMS Open Payments General Payments, PY2022",
    year: 2022
  }
];

function downloadFile(file: DataFile): Promise<void> {
  return new Promise((resolve, reject) => {
    const dest = path.join(RAW_DIR, file.name);

    if (fs.existsSync(dest)) {
      const stats = fs.statSync(dest);
      if (stats.size > 0) {
        console.log(`  [SKIP] ${file.name} already exists (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
        return resolve();
      }
    }

    console.log(`  [DOWNLOAD] ${file.name}`);
    console.log(`    ${file.description}`);
    console.log(`    URL: ${file.url}`);

    const output = fs.createWriteStream(dest);
    const protocol = file.url.startsWith("https") ? https : http;

    const request = protocol.get(file.url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Follow redirect
        const redirectUrl = response.headers.location!;
        console.log(`    Redirecting to: ${redirectUrl}`);
        const redirectProtocol = redirectUrl.startsWith("https") ? https : http;
        redirectProtocol.get(redirectUrl, (redirectResponse) => {
          const total = parseInt(redirectResponse.headers["content-length"] || "0", 10);
          let received = 0;

          redirectResponse.on("data", (chunk: Buffer) => {
            received += chunk.length;
            if (total > 0) {
              const pct = ((received / total) * 100).toFixed(1);
              process.stdout.write(`\r    Progress: ${pct}% (${(received / 1024 / 1024).toFixed(1)} MB)`);
            }
          });

          redirectResponse.pipe(output);
          output.on("finish", () => {
            console.log(`\n    Done: ${(received / 1024 / 1024).toFixed(1)} MB`);
            resolve();
          });
        }).on("error", reject);
        return;
      }

      if (response.statusCode !== 200) {
        output.close();
        fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${response.statusCode} for ${file.url}`));
      }

      const total = parseInt(response.headers["content-length"] || "0", 10);
      let received = 0;

      response.on("data", (chunk: Buffer) => {
        received += chunk.length;
        if (total > 0) {
          const pct = ((received / total) * 100).toFixed(1);
          process.stdout.write(`\r    Progress: ${pct}% (${(received / 1024 / 1024).toFixed(1)} MB)`);
        }
      });

      response.pipe(output);
      output.on("finish", () => {
        console.log(`\n    Done: ${(received / 1024 / 1024).toFixed(1)} MB`);
        resolve();
      });
    });

    request.on("error", (err) => {
      output.close();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(err);
    });
  });
}

async function main() {
  if (!fs.existsSync(RAW_DIR)) {
    fs.mkdirSync(RAW_DIR, { recursive: true });
  }

  console.log("=== CMS Data Downloader ===\n");
  console.log(`Files will be saved to: ${RAW_DIR}\n`);
  console.log("NOTE: These files are large (100MB–2GB). Download may take 10–60 minutes.");
  console.log("      Already-downloaded files will be skipped automatically.\n");

  for (const file of DATA_FILES) {
    try {
      await downloadFile(file);
    } catch (err) {
      console.error(`\n  [ERROR] Failed to download ${file.name}:`, err);
      console.log(`  You may need to manually download this file from:`);
      console.log(`  ${file.url}`);
      console.log(`  and save it to: ${path.join(RAW_DIR, file.name)}\n`);
    }
  }

  console.log("\n=== Download complete ===");
  console.log("Next step: npm run process:partb");
}

main().catch(console.error);
