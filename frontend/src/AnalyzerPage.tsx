import { useEffect, useState, useCallback } from "react";
import { api } from "./api";
import type {
  NgsLabRecord,
  OncologyPrescriberRecord,
  OpenPaymentRecord,
  MedicaidRecord,
  NgsLabSummary,
  PrescriberSummary,
  OpenPaymentsSummary,
  ProspectRecord,
  CrossReferenceResponse
} from "./types";

type AnalyzerTab = "ngs-labs" | "prescribers" | "open-payments" | "medicaid" | "prospects";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC","PR"
];

function fmt(n: number | null | undefined, decimals = 0): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function CompanionBadge({ required, testType }: { required: boolean; testType: string | null }) {
  if (!required) return null;
  return (
    <span className="companion-badge" title={`Requires companion diagnostic: ${testType || "Yes"}`}>
      {testType || "Companion Dx"}
    </span>
  );
}

function MiniBar({ value, max, color = "var(--ol-teal-500)" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="mini-bar-wrap">
      <div className="mini-bar-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NGS Labs Tab
// ─────────────────────────────────────────────────────────────────────────────

function NgsLabsTab({ year, state, search }: { year: string; state: string; search: string }) {
  const [rows, setRows] = useState<NgsLabRecord[]>([]);
  const [summary, setSummary] = useState<NgsLabSummary | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [data, sum] = await Promise.all([
        api.getNgsLabs({ year, state, category, search, page, limit: 50 }),
        page === 1 ? api.getNgsLabsSummary(year) : Promise.resolve(summary)
      ]);
      setRows(data.data);
      setTotal(data.total);
      if (page === 1) setSummary(sum as NgsLabSummary);
    } catch (e: any) {
      setError(e.message || "Failed to load NGS/IHC data");
    } finally {
      setLoading(false);
    }
  }, [year, state, category, search, page]);

  useEffect(() => { setPage(1); }, [year, state, category, search]);
  useEffect(() => { load(); }, [load]);

  const topMax = summary?.topLabs[0]?.total || 1;

  return (
    <div className="analyzer-tab-body">
      {summary && (
        <div className="analyzer-summary-cards">
          <div className="analyzer-card">
            <div className="analyzer-card-value">{fmt(summary.totalRows)}</div>
            <div className="analyzer-card-label">Total Records</div>
          </div>
          {summary.byCategory.map((c) => (
            <div className="analyzer-card" key={c.category}>
              <div className="analyzer-card-value">{fmt(c.total)}</div>
              <div className="analyzer-card-label">{c.category} Services</div>
            </div>
          ))}
        </div>
      )}

      {summary && summary.topLabs.length > 0 && (
        <div className="analyzer-chart-section">
          <h3>Top 10 Labs by Total Services Billed</h3>
          <div className="analyzer-bar-chart">
            {summary.topLabs.map((lab) => (
              <div className="analyzer-bar-row" key={lab.npi}>
                <div className="analyzer-bar-label" title={lab.npi}>
                  <span className="lab-name">{lab.name || lab.npi}</span>
                  <span className="lab-state">{lab.state}</span>
                </div>
                <MiniBar value={lab.total} max={topMax} />
                <div className="analyzer-bar-value">{fmt(lab.total)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="analyzer-table-controls">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="analyzer-select">
          <option value="">All Categories</option>
          <option value="NGS">NGS</option>
          <option value="IHC">IHC</option>
          <option value="FISH">FISH</option>
        </select>
        <span className="analyzer-count">{fmt(total)} records</span>
        <button
          type="button"
          className="analyzer-btn-outline"
          onClick={() => api.downloadAnalyzerCsv("ngs-labs", { year, state, category, search }).catch((e: Error) => setError(e.message || "Export failed"))}
        >
          Export CSV
        </button>
      </div>

      {loading && <div className="analyzer-loading">Loading…</div>}
      {error && <div className="analyzer-error">{error}</div>}

      {!loading && rows.length === 0 && !error && (
        <div className="analyzer-empty">
          No data found. Run the ETL pipeline to load Medicare Part B data.
        </div>
      )}

      {rows.length > 0 && (
        <div className="analyzer-table-wrap">
          <table className="analyzer-table">
            <thead>
              <tr>
                <th>NPI</th>
                <th>Lab / Provider Name</th>
                <th>City</th>
                <th>State</th>
                <th>Specialty</th>
                <th>HCPCS Code</th>
                <th>Category</th>
                <th>Year</th>
                <th>Services</th>
                <th>Beneficiaries</th>
                <th>Avg Medicare Paid</th>
                <th>Avg Submitted Charge</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="mono">{row.npi}</td>
                  <td>{row.provider_last_name}{row.provider_first_name ? `, ${row.provider_first_name}` : ""}</td>
                  <td>{row.nppes_provider_city}</td>
                  <td>{row.nppes_provider_state}</td>
                  <td className="wrap-cell">{row.provider_type}</td>
                  <td className="mono">{row.hcpcs_code}</td>
                  <td><span className={`category-badge category-${row.test_category.toLowerCase()}`}>{row.test_category}</span></td>
                  <td>{row.year}</td>
                  <td className="num">{fmt(row.line_srvc_cnt)}</td>
                  <td className="num">{fmt(row.bene_unique_cnt)}</td>
                  <td className="num">{fmtUsd(row.average_medicare_payment_amt)}</td>
                  <td className="num">{fmtUsd(row.average_submitted_chrg_amt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 50 && (
        <div className="analyzer-pagination">
          <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)} className="analyzer-btn-outline">← Prev</button>
          <span>Page {page} of {Math.ceil(total / 50)}</span>
          <button type="button" disabled={page >= Math.ceil(total / 50)} onClick={() => setPage(page + 1)} className="analyzer-btn-outline">Next →</button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Oncology Prescribers Tab
// ─────────────────────────────────────────────────────────────────────────────

function PrescribersTab({ year, state, search, onCrossRef }: { year: string; state: string; search: string; onCrossRef: (npi: string) => void }) {
  const [rows, setRows] = useState<OncologyPrescriberRecord[]>([]);
  const [summary, setSummary] = useState<PrescriberSummary | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [drug, setDrug] = useState("");
  const [companionOnly, setCompanionOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [data, sum] = await Promise.all([
        api.getOncologyPrescribers({ year, state, drug, companionDxOnly: companionOnly, search, page, limit: 50 }),
        page === 1 ? api.getOncologyPrescribersSummary(year) : Promise.resolve(summary)
      ]);
      setRows(data.data);
      setTotal(data.total);
      if (page === 1) setSummary(sum as PrescriberSummary);
    } catch (e: any) {
      setError(e.message || "Failed to load prescriber data");
    } finally {
      setLoading(false);
    }
  }, [year, state, drug, companionOnly, search, page]);

  useEffect(() => { setPage(1); }, [year, state, drug, companionOnly, search]);
  useEffect(() => { load(); }, [load]);

  const topMax = summary?.topPrescribers[0]?.claims || 1;

  return (
    <div className="analyzer-tab-body">
      {summary && (
        <div className="analyzer-summary-cards">
          <div className="analyzer-card">
            <div className="analyzer-card-value">{fmt(summary.totalRows)}</div>
            <div className="analyzer-card-label">Total Records</div>
          </div>
          <div className="analyzer-card highlight">
            <div className="analyzer-card-value">{fmt(summary.companionDxCount)}</div>
            <div className="analyzer-card-label">Prescribers with Companion Dx Drugs</div>
          </div>
        </div>
      )}

      {summary && summary.topPrescribers.length > 0 && (
        <div className="analyzer-chart-section">
          <h3>Top 10 Prescribers by Total Claims</h3>
          <div className="analyzer-bar-chart">
            {summary.topPrescribers.map((p) => (
              <div className="analyzer-bar-row" key={p.npi}>
                <div className="analyzer-bar-label">
                  <span className="lab-name">{p.name}</span>
                  <span className="lab-state">{p.state}{p.hasCompanion ? " 🧬" : ""}</span>
                </div>
                <MiniBar value={p.claims} max={topMax} />
                <div className="analyzer-bar-value">{fmt(p.claims)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="analyzer-table-controls">
        <input
          type="text"
          placeholder="Filter by drug name…"
          value={drug}
          onChange={(e) => setDrug(e.target.value)}
          className="analyzer-input"
        />
        <label className="analyzer-checkbox-label">
          <input type="checkbox" checked={companionOnly} onChange={(e) => setCompanionOnly(e.target.checked)} />
          <span>Companion Dx required only</span>
        </label>
        <span className="analyzer-count">{fmt(total)} records</span>
        <button
          type="button"
          className="analyzer-btn-outline"
          onClick={() => api.downloadAnalyzerCsv("oncology-prescribers", { year, state, drug, ...(companionOnly ? { requires_companion_dx: "true" } : {}), search }).catch((e: Error) => setError(e.message || "Export failed"))}
        >
          Export CSV
        </button>
      </div>

      {loading && <div className="analyzer-loading">Loading…</div>}
      {error && <div className="analyzer-error">{error}</div>}

      {!loading && rows.length === 0 && !error && (
        <div className="analyzer-empty">
          No data found. Run the ETL pipeline to load Medicare Part D data.
        </div>
      )}

      {rows.length > 0 && (
        <div className="analyzer-table-wrap">
          <table className="analyzer-table">
            <thead>
              <tr>
                <th>NPI</th>
                <th>Prescriber Name</th>
                <th>City</th>
                <th>State</th>
                <th>Specialty</th>
                <th>Drug</th>
                <th>Generic Name</th>
                <th>Companion Dx</th>
                <th>Year</th>
                <th>Claims</th>
                <th>Patients</th>
                <th>Total Drug Cost</th>
                <th>Cross-Ref</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="mono">{row.npi}</td>
                  <td>{row.nppes_provider_first_name} {row.nppes_provider_last_org_name}</td>
                  <td>{row.nppes_provider_city}</td>
                  <td>{row.nppes_provider_state}</td>
                  <td className="wrap-cell">{row.provider_type}</td>
                  <td><strong>{row.drug_name}</strong></td>
                  <td className="muted-cell">{row.generic_name}</td>
                  <td><CompanionBadge required={row.requires_companion_dx} testType={row.companion_test_type} /></td>
                  <td>{row.year}</td>
                  <td className="num">{fmt(row.total_claim_count)}</td>
                  <td className="num">{fmt(row.bene_count)}</td>
                  <td className="num">{fmtUsd(row.total_drug_cost)}</td>
                  <td>
                    <button type="button" className="analyzer-link-btn" onClick={() => onCrossRef(row.npi)}>
                      View →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 50 && (
        <div className="analyzer-pagination">
          <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)} className="analyzer-btn-outline">← Prev</button>
          <span>Page {page} of {Math.ceil(total / 50)}</span>
          <button type="button" disabled={page >= Math.ceil(total / 50)} onClick={() => setPage(page + 1)} className="analyzer-btn-outline">Next →</button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Open Payments / KOLs Tab
// ─────────────────────────────────────────────────────────────────────────────

function OpenPaymentsTab({ year, state, search, onCrossRef }: { year: string; state: string; search: string; onCrossRef: (npi: string) => void }) {
  const [rows, setRows] = useState<OpenPaymentRecord[]>([]);
  const [summary, setSummary] = useState<OpenPaymentsSummary | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [drug, setDrug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [data, sum] = await Promise.all([
        api.getOpenPayments({ year, state, drug, page, limit: 50 }),
        page === 1 ? api.getOpenPaymentsSummary(year) : Promise.resolve(summary)
      ]);
      setRows(data.data);
      setTotal(data.total);
      if (page === 1) setSummary(sum as OpenPaymentsSummary);
    } catch (e: any) {
      setError(e.message || "Failed to load Open Payments data");
    } finally {
      setLoading(false);
    }
  }, [year, state, drug, page]);

  useEffect(() => { setPage(1); }, [year, state, drug]);
  useEffect(() => { load(); }, [load]);

  const topMax = summary?.topKols[0]?.total || 1;

  return (
    <div className="analyzer-tab-body">
      {summary && (
        <div className="analyzer-summary-cards">
          <div className="analyzer-card">
            <div className="analyzer-card-value">{fmt(summary.totalRows)}</div>
            <div className="analyzer-card-label">Total Payments</div>
          </div>
          <div className="analyzer-card highlight">
            <div className="analyzer-card-value">{fmtUsd(summary.totalAmount)}</div>
            <div className="analyzer-card-label">Total Amount Paid</div>
          </div>
        </div>
      )}

      {summary && summary.topKols.length > 0 && (
        <div className="analyzer-chart-section">
          <h3>Top 10 Key Opinion Leaders by Total Payments Received</h3>
          <div className="analyzer-bar-chart">
            {summary.topKols.map((k) => (
              <div className="analyzer-bar-row" key={k.npi}>
                <div className="analyzer-bar-label">
                  <span className="lab-name">{k.name}</span>
                  <span className="lab-state">{k.state}</span>
                </div>
                <MiniBar value={k.total} max={topMax} color="var(--ol-navy-500)" />
                <div className="analyzer-bar-value">{fmtUsd(k.total)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="analyzer-table-controls">
        <input
          type="text"
          placeholder="Filter by drug name…"
          value={drug}
          onChange={(e) => setDrug(e.target.value)}
          className="analyzer-input"
        />
        <span className="analyzer-count">{fmt(total)} payments</span>
        <button
          type="button"
          className="analyzer-btn-outline"
          onClick={() => api.downloadAnalyzerCsv("open-payments", { year, state, drug }).catch((e: Error) => setError(e.message || "Export failed"))}
        >
          Export CSV
        </button>
      </div>

      {loading && <div className="analyzer-loading">Loading…</div>}
      {error && <div className="analyzer-error">{error}</div>}

      {!loading && rows.length === 0 && !error && (
        <div className="analyzer-empty">
          No data found. Run the ETL pipeline to load Open Payments data.
        </div>
      )}

      {rows.length > 0 && (
        <div className="analyzer-table-wrap">
          <table className="analyzer-table">
            <thead>
              <tr>
                <th>Physician NPI</th>
                <th>Name</th>
                <th>Specialty</th>
                <th>City</th>
                <th>State</th>
                <th>Manufacturer</th>
                <th>Drug</th>
                <th>Nature of Payment</th>
                <th>Amount</th>
                <th># Payments</th>
                <th>Year</th>
                <th>Cross-Ref</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="mono">{row.physician_npi || "—"}</td>
                  <td>{row.physician_first_name} {row.physician_last_name}</td>
                  <td className="wrap-cell">{row.physician_specialty}</td>
                  <td>{row.recipient_city}</td>
                  <td>{row.recipient_state}</td>
                  <td className="wrap-cell">{row.manufacturer_name}</td>
                  <td><strong>{row.drug_name}</strong></td>
                  <td className="wrap-cell">{row.nature_of_payment}</td>
                  <td className="num">{fmtUsd(row.total_amount_usd)}</td>
                  <td className="num">{fmt(row.number_of_payments)}</td>
                  <td>{row.year}</td>
                  <td>
                    {row.physician_npi && (
                      <button type="button" className="analyzer-link-btn" onClick={() => onCrossRef(row.physician_npi!)}>
                        View →
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 50 && (
        <div className="analyzer-pagination">
          <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)} className="analyzer-btn-outline">← Prev</button>
          <span>Page {page} of {Math.ceil(total / 50)}</span>
          <button type="button" disabled={page >= Math.ceil(total / 50)} onClick={() => setPage(page + 1)} className="analyzer-btn-outline">Next →</button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Medicaid Tab
// ─────────────────────────────────────────────────────────────────────────────

function MedicaidTab({ year, state }: { year: string; state: string }) {
  const [rows, setRows] = useState<MedicaidRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [drug, setDrug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.getMedicaidUtilization({ year, state, drug, page, limit: 50 });
      setRows(data.data);
      setTotal(data.total);
    } catch (e: any) {
      setError(e.message || "Failed to load Medicaid data");
    } finally {
      setLoading(false);
    }
  }, [year, state, drug, page]);

  useEffect(() => { setPage(1); }, [year, state, drug]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="analyzer-tab-body">
      <div className="analyzer-table-controls">
        <input
          type="text"
          placeholder="Filter by drug name…"
          value={drug}
          onChange={(e) => setDrug(e.target.value)}
          className="analyzer-input"
        />
        <span className="analyzer-count">{fmt(total)} records</span>
        <button
          type="button"
          className="analyzer-btn-outline"
          onClick={() => api.downloadAnalyzerCsv("medicaid", { year, state, drug }).catch((e: Error) => setError(e.message || "Export failed"))}
        >
          Export CSV
        </button>
      </div>

      {loading && <div className="analyzer-loading">Loading…</div>}
      {error && <div className="analyzer-error">{error}</div>}

      {!loading && rows.length === 0 && !error && (
        <div className="analyzer-empty">
          No data found. Download Medicaid state utilization data from data.medicaid.gov and run the ETL pipeline.
        </div>
      )}

      {rows.length > 0 && (
        <div className="analyzer-table-wrap">
          <table className="analyzer-table">
            <thead>
              <tr>
                <th>State</th>
                <th>Year</th>
                <th>Quarter</th>
                <th>Drug Name</th>
                <th>NDC</th>
                <th>Prescriptions</th>
                <th>Units Reimbursed</th>
                <th>Total Reimbursed</th>
                <th>Medicaid Paid</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td><strong>{row.state_code}</strong></td>
                  <td>{row.year}</td>
                  <td>{row.quarter ? `Q${row.quarter}` : "—"}</td>
                  <td>{row.drug_name}</td>
                  <td className="mono">{row.ndc || "—"}</td>
                  <td className="num">{fmt(row.number_of_prescriptions)}</td>
                  <td className="num">{fmt(row.units_reimbursed)}</td>
                  <td className="num">{fmtUsd(row.total_amount_reimbursed)}</td>
                  <td className="num">{fmtUsd(row.medicaid_amount_reimbursed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 50 && (
        <div className="analyzer-pagination">
          <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)} className="analyzer-btn-outline">← Prev</button>
          <span>Page {page} of {Math.ceil(total / 50)}</span>
          <button type="button" disabled={page >= Math.ceil(total / 50)} onClick={() => setPage(page + 1)} className="analyzer-btn-outline">Next →</button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Prospect List Tab
// ─────────────────────────────────────────────────────────────────────────────

function ProspectsTab({ year, state }: { year: string; state: string }) {
  const [prospects, setProspects] = useState<ProspectRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [drug, setDrug] = useState("");
  const [minClaims, setMinClaims] = useState("10");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.getProspectList({ state, drug, minClaims, year });
      setProspects(data.prospects);
      setTotal(data.total);
    } catch (e: any) {
      setError(e.message || "Failed to load prospect list");
    } finally {
      setLoading(false);
    }
  }, [state, drug, minClaims, year]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="analyzer-tab-body">
      <div className="analyzer-callout">
        <strong>How this works:</strong> This list shows oncologists prescribing drugs that require companion diagnostic testing (NGS, IHC, or FISH). These are your highest-value prospects for NGS test ordering, since their patients need biomarker testing before or during treatment.
      </div>

      <div className="analyzer-table-controls">
        <input
          type="text"
          placeholder="Filter by drug name…"
          value={drug}
          onChange={(e) => setDrug(e.target.value)}
          className="analyzer-input"
        />
        <label className="analyzer-inline-label">
          Min claims:
          <input
            type="number"
            value={minClaims}
            onChange={(e) => setMinClaims(e.target.value)}
            min="1"
            style={{ width: "80px", marginLeft: "0.4rem" }}
            className="analyzer-input"
          />
        </label>
        <span className="analyzer-count">{fmt(total)} prospects</span>
        <button
          type="button"
          className="analyzer-btn-outline"
          onClick={() => api.downloadProspectListCsv({ state, drug, minClaims, year }).catch((e: Error) => setError(e.message || "Export failed"))}
        >
          Export Prospect List CSV
        </button>
      </div>

      {loading && <div className="analyzer-loading">Loading…</div>}
      {error && <div className="analyzer-error">{error}</div>}

      {!loading && prospects.length === 0 && !error && (
        <div className="analyzer-empty">
          No prospects found with current filters. Try reducing the minimum claims threshold or broadening the state/drug filters.
        </div>
      )}

      {prospects.length > 0 && (
        <div className="analyzer-prospect-grid">
          {prospects.map((p) => (
            <div className="analyzer-prospect-card" key={p.npi}>
              <div className="prospect-name">{p.name || p.npi}</div>
              <div className="prospect-location">{p.city}{p.city && p.state ? ", " : ""}{p.state} {p.zip}</div>
              {p.credentials && <div className="prospect-creds">{p.credentials}</div>}
              <div className="prospect-specialty">{p.specialty}</div>
              <div className="prospect-stats">
                <span>{fmt(p.totalClaims)} total claims</span>
                <span>{fmtUsd(p.totalCost)} drug cost</span>
              </div>
              <div className="prospect-drugs">
                {p.drugs.map((d, i) => (
                  <div key={i} className="prospect-drug-row">
                    <span className="prospect-drug-name">{d.drug}</span>
                    <CompanionBadge required={true} testType={d.companion_test} />
                    <span className="prospect-drug-claims">{fmt(d.claims)} claims</span>
                  </div>
                ))}
              </div>
              <div className="prospect-npi">NPI: {p.npi}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cross-Reference Drawer
// ─────────────────────────────────────────────────────────────────────────────

function CrossRefDrawer({ npi, onClose }: { npi: string; onClose: () => void }) {
  const [data, setData] = useState<CrossReferenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    api.getCrossReference(npi)
      .then(setData)
      .catch((e) => setError(e.message || "Failed to load cross-reference"))
      .finally(() => setLoading(false));
  }, [npi]);

  return (
    <div className="analyzer-drawer-overlay" onClick={onClose}>
      <div className="analyzer-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="analyzer-drawer-header">
          <h3>Prescriber Cross-Reference</h3>
          <button type="button" className="drawer-close-btn" onClick={onClose}>✕</button>
        </div>

        {loading && <div className="analyzer-loading">Loading…</div>}
        {error && <div className="analyzer-error">{error}</div>}

        {data && (
          <div className="analyzer-drawer-body">
            {data.provider && (
              <div className="crossref-provider-info">
                <div className="crossref-name">{data.provider.name}</div>
                <div className="crossref-location">{data.provider.city}, {data.provider.state}</div>
                <div className="crossref-specialty">{data.provider.specialty}</div>
                <div className="crossref-npi">NPI: {data.npi}</div>
              </div>
            )}

            {data.prescriptions.length > 0 && (
              <div className="crossref-section">
                <h4>Medicare Part D — Oncology Drug Claims</h4>
                <table className="analyzer-table compact-table">
                  <thead>
                    <tr>
                      <th>Drug</th>
                      <th>Companion Dx</th>
                      <th>Year</th>
                      <th>Claims</th>
                      <th>Drug Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.prescriptions.map((rx) => (
                      <tr key={rx.id}>
                        <td><strong>{rx.drug_name}</strong></td>
                        <td><CompanionBadge required={rx.requires_companion_dx} testType={rx.companion_test_type} /></td>
                        <td>{rx.year}</td>
                        <td className="num">{fmt(rx.total_claim_count)}</td>
                        <td className="num">{fmtUsd(rx.total_drug_cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {data.openPayments.length > 0 && (
              <div className="crossref-section">
                <h4>CMS Open Payments — Industry Payments Received</h4>
                <table className="analyzer-table compact-table">
                  <thead>
                    <tr>
                      <th>Manufacturer</th>
                      <th>Drug</th>
                      <th>Nature</th>
                      <th>Amount</th>
                      <th>Year</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.openPayments.map((p) => (
                      <tr key={p.id}>
                        <td>{p.manufacturer_name}</td>
                        <td>{p.drug_name}</td>
                        <td>{p.nature_of_payment}</td>
                        <td className="num">{fmtUsd(p.total_amount_usd)}</td>
                        <td>{p.year}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {data.prescriptions.length === 0 && data.openPayments.length === 0 && (
              <div className="analyzer-empty">No data found for this NPI in the loaded datasets.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main AnalyzerPage Component
// ─────────────────────────────────────────────────────────────────────────────

export function AnalyzerPage() {
  const [activeTab, setActiveTab] = useState<AnalyzerTab>("ngs-labs");
  const [year, setYear] = useState("2023");
  const [state, setState] = useState("");
  const [search, setSearch] = useState("");
  const [crossRefNpi, setCrossRefNpi] = useState<string | null>(null);

  const tabs: Array<{ id: AnalyzerTab; label: string }> = [
    { id: "ngs-labs", label: "NGS / IHC Labs" },
    { id: "prescribers", label: "Oncology Prescribers" },
    { id: "open-payments", label: "Open Payments / KOLs" },
    { id: "medicaid", label: "Medicaid Utilization" },
    { id: "prospects", label: "Prospect List ★" }
  ];

  return (
    <div className="analyzer-page">
      <div className="analyzer-header">
        <div className="analyzer-header-top">
          <div>
            <h2 className="analyzer-title">Market Intelligence Analyzer</h2>
            <p className="analyzer-subtitle">Medicare Part B/D · Open Payments · Medicaid State Utilization</p>
          </div>
        </div>

        <div className="analyzer-disclaimer">
          <strong>Data Limitation:</strong> Medicare Part B shows the <em>billing lab's NPI</em>, not the ordering physician. NGS tests are billed by labs (e.g., Foundation Medicine, Guardant, Tempus). To identify ordering physicians, use the <strong>Oncology Prescribers</strong> tab — oncologists prescribing companion-dx drugs are your best proxy for NGS test orderers. All data is public Medicare/Medicaid (CMS) and reflects covered claims only; does not include commercial insurance.
        </div>

        <div className="analyzer-filters">
          <label className="analyzer-filter-label">
            Year
            <select value={year} onChange={(e) => setYear(e.target.value)} className="analyzer-select">
              <option value="">All Years</option>
              <option value="2023">2023</option>
              <option value="2022">2022</option>
            </select>
          </label>
          <label className="analyzer-filter-label">
            State
            <select value={state} onChange={(e) => setState(e.target.value)} className="analyzer-select">
              <option value="">All States</option>
              {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="analyzer-filter-label">
            Search
            <input
              type="text"
              placeholder="Name, NPI…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="analyzer-input"
            />
          </label>
        </div>

        <div className="analyzer-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`analyzer-tab-btn${activeTab === tab.id ? " active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="analyzer-content">
        {activeTab === "ngs-labs" && <NgsLabsTab year={year} state={state} search={search} />}
        {activeTab === "prescribers" && <PrescribersTab year={year} state={state} search={search} onCrossRef={setCrossRefNpi} />}
        {activeTab === "open-payments" && <OpenPaymentsTab year={year} state={state} search={search} onCrossRef={setCrossRefNpi} />}
        {activeTab === "medicaid" && <MedicaidTab year={year} state={state} />}
        {activeTab === "prospects" && <ProspectsTab year={year} state={state} />}
      </div>

      {crossRefNpi && (
        <CrossRefDrawer npi={crossRefNpi} onClose={() => setCrossRefNpi(null)} />
      )}
    </div>
  );
}
