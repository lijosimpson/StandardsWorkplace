# NGS/Oncology Analyzer — ETL Pipeline

This pipeline downloads public CMS datasets, filters them to oncology-relevant records, and loads them into Supabase for the Analyzer dashboard.

---

## What This Loads

| Table | Source | What It Contains |
|-------|--------|-----------------|
| `ngs_lab_utilization` | Medicare Part B PUF | Labs billing NGS/IHC/FISH tests, by NPI |
| `oncology_drug_prescribers` | Medicare Part D PUF | Physicians prescribing oncology drugs, by NPI |
| `open_payments_oncology` | CMS Open Payments | Pharma payments to physicians for oncology drugs |
| `medicaid_drug_utilization` | Medicaid State Utilization | State-level oncology drug counts |

---

## Prerequisites

1. **Node.js** 18+ installed
2. **Supabase project** with migration `20260324_0003_analyzer_tables.sql` applied
3. **Credentials**: Copy `/backend/.env` to `/etl/.env`

```
# /etl/.env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## Quick Start (First Time)

```bash
cd etl
npm install

# Step 1: Download raw CMS files (large, takes 30–90 min)
npm run download

# Step 2: Extract Open Payments ZIPs (manual — see below)

# Step 3: Process and upload everything
npm run run
```

---

## Step-by-Step

### Step 1: Download Raw Data

```bash
npm run download
```

Downloads to `raw/`. Files are large (100MB–2GB each). Already-downloaded files are skipped automatically.

**If the download URLs fail** (CMS updates them each year):
1. Visit the links in `downloadData.ts`
2. Find the current download link on the CMS data portal
3. Update the URL in `downloadData.ts`
4. Or download manually and save to `raw/` with the expected filename

### Step 2: Extract Open Payments ZIPs

The Open Payments files download as ZIP archives. Extract manually:
1. Open `raw/open_payments_general_2023.csv.zip` (or `.zip`)
2. Find the file named `OP_DTL_GNRL_PGYR2023_P*.csv`
3. Copy it to `raw/open_payments_general_2023.csv`
4. Repeat for 2022

### Step 3: Download Medicaid Data (Manual)

Medicaid data requires manual download:
1. Go to [data.medicaid.gov](https://data.medicaid.gov/)
2. Search "State Drug Utilization Data"
3. Filter by year (2022, 2023), download as CSV
4. Save to `raw/medicaid_utilization_2022.csv` and `raw/medicaid_utilization_2023.csv`

### Step 4: Run Processing & Upload

```bash
# Run everything at once:
npm run run

# Or run individual steps:
npm run process:partb     # NGS/IHC/FISH labs
npm run process:partd     # Oncology prescribers
npm run process:payments  # Open Payments
npm run process:medicaid  # Medicaid
npm run upload            # Upload to Supabase
```

---

## Updating CPT Code Lists

Edit the JSON files in `config/`:

- `config/ngs_codes.json` — Add/remove NGS CPT codes
- `config/ihc_codes.json` — Add/remove IHC/FISH CPT codes
- `config/oncology_drugs.json` — Add/remove drug names
- `config/companion_dx_map.json` — Update drug → companion test mappings

After editing, re-run processing and upload.

---

## Updating for a New Data Year

1. Add the new year's download URLs to `downloadData.ts`
2. Add the new year to the `YEARS` array in each processing script
3. Run `npm run run` again

---

## Key Limitation

> **The Medicare Part B PUF shows the billing lab's NPI, NOT the ordering physician.**
> NGS tests are billed by the lab (e.g., Foundation Medicine, Guardant, Tempus), so the lab appears as the provider — not the oncologist who ordered the test.
>
> To find ordering physicians, use the **Part D cross-reference**: oncologists prescribing drugs that require companion diagnostics (e.g., osimertinib → EGFR, pembrolizumab → PD-L1/TMB) are highly likely to be ordering those NGS tests.

---

## Troubleshooting

**"File not found" errors**: The raw file wasn't downloaded. Check `raw/` folder or re-run download.

**Supabase upload errors**: Verify your `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `/etl/.env`. Check that the migration was applied.

**Large file memory errors**: Node.js streams are used throughout, so even multi-GB files should process without memory issues. If you hit errors, try `NODE_OPTIONS=--max-old-space-size=4096 npm run process:partb`.

**CMS URL changes**: CMS changes download URLs with each data release. Check the CMS data portal for current links and update `downloadData.ts`.
