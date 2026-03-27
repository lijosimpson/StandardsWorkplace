import { useEffect, useState, useCallback, useRef } from "react";
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
  CrossReferenceResponse,
  CollaborationNetwork,
  CollaboratorNode,
  CollaborationProviderSearchResult,
  CancerTypeYear,
  PhysicianLocation,
  HospitalSearchResult,
  HospitalProvider,
  HospitalNetwork,
  PartBServiceRecord,
  AcoMembership,
  OrderReferringStatus
} from "./types";

type AnalyzerTab = "ngs-labs" | "prescribers" | "open-payments" | "medicaid" | "prospects" | "collaboration" | "hospital-network";

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

function OpenPaymentsTab({ year, state, onCrossRef }: { year: string; state: string; search: string; onCrossRef: (npi: string) => void }) {
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

            {data.ngsLabs && data.ngsLabs.length > 0 && (
              <div className="crossref-section">
                <h4>
                  NGS / IHC Labs in {data.provider?.state || "Same State"}
                  <span className="crossref-note"> — labs performing tests required by this prescriber's drugs (best proxy; Medicare Part B does not record the ordering physician)</span>
                </h4>
                <table className="analyzer-table compact-table">
                  <thead>
                    <tr>
                      <th>Lab Name</th>
                      <th>City</th>
                      <th>Test Type</th>
                      <th>Test Code</th>
                      <th>Year</th>
                      <th>Claims</th>
                      <th>Patients</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ngsLabs.map((lab, i) => (
                      <tr key={`${lab.npi}-${lab.hcpcs_code}-${lab.year}-${i}`}>
                        <td><strong>{lab.provider_last_name}{lab.provider_first_name ? `, ${lab.provider_first_name}` : ""}</strong></td>
                        <td>{lab.nppes_provider_city}</td>
                        <td>{lab.test_category}</td>
                        <td title={lab.hcpcs_description}>{lab.hcpcs_code}</td>
                        <td>{lab.year}</td>
                        <td className="num">{fmt(lab.line_srvc_cnt)}</td>
                        <td className="num">{fmt(lab.bene_unique_cnt)}</td>
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
// Collaboration Network Tab
// ─────────────────────────────────────────────────────────────────────────────

const SPECIALTY_COLORS: Record<string, string> = {
  "Hematology/Oncology": "#4e9af1",
  "Medical Oncology": "#3b82f6",
  "Radiation Oncology": "#f97316",
  "Gynecological/Oncology": "#a855f7",
  "Surgical Oncology": "#10b981",
  "Hematology": "#06b6d4",
  "Thoracic Surgery": "#84cc16",
  "Pathology": "#f59e0b",
  "Internal Medicine": "#6b7280",
  "Family Practice": "#9ca3af",
};

// Canonical specialty type → display config
const SPECIALTY_TYPE_META: Record<string, { color: string; label: string; icon: string }> = {
  oncology:   { color: "#3b82f6", label: "Medical Oncology",    icon: "💊" },
  hematology: { color: "#8b5cf6", label: "Hematology",          icon: "🩸" },
  radiation:  { color: "#f97316", label: "Radiation Oncology",  icon: "⚡" },
  surgery:    { color: "#22c55e", label: "Surgical Oncology",   icon: "🔪" },
  pathology:  { color: "#eab308", label: "Pathology",           icon: "🔬" },
  radiology:  { color: "#06b6d4", label: "Radiology",           icon: "🩻" },
  other:      { color: "#94a3b8", label: "Other",               icon: "👤" },
};
const CARE_TEAM_TYPES = ["oncology", "hematology", "radiation", "surgery", "pathology", "radiology"] as const;

function specialtyTypeColor(specialtyType?: string): string {
  return SPECIALTY_TYPE_META[specialtyType || "other"]?.color ?? "#94a3b8";
}

function CancerTypeBadges({ cancerTypes, compact }: { cancerTypes?: CancerTypeYear[]; compact?: boolean }) {
  if (!cancerTypes || cancerTypes.length === 0) return null;
  const items = compact ? cancerTypes.slice(0, 3) : cancerTypes;
  return (
    <div className="cancer-type-badges">
      {items.map(ct => (
        <span key={ct.type} className="cancer-type-badge" title={ct.years.length > 0 ? `Treated in: ${ct.years.join(", ")}` : ct.type}>
          {ct.type}
          {ct.years.length > 0 && <span className="cancer-type-year">{ct.years.length === 1 ? ct.years[0] : `${ct.years[0]}–${ct.years[ct.years.length - 1]}`}</span>}
        </span>
      ))}
      {compact && cancerTypes.length > 3 && (
        <span className="cancer-type-badge cancer-type-more">+{cancerTypes.length - 3}</span>
      )}
    </div>
  );
}

function specialtyColor(spec: string): string {
  for (const [key, color] of Object.entries(SPECIALTY_COLORS)) {
    if (spec?.toLowerCase().includes(key.toLowerCase())) return color;
  }
  return "#94a3b8";
}

function scoreLabel(score: number): string {
  if (score >= 0.7) return "Strong";
  if (score >= 0.4) return "Moderate";
  if (score >= 0.2) return "Weak";
  return "Low";
}

// Simple radial force network rendered in SVG
function CollaborationGraph({ network, onNodeClick }: {
  network: CollaborationNetwork;
  onNodeClick: (node: CollaboratorNode) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const W = 800, H = 560;
  const CX = W / 2, CY = H / 2;

  // Position focal node in center, collaborators in rings by score
  const positions = new Map<string, { x: number; y: number; node: CollaboratorNode }>();
  const focal = { ...network.focalProvider, collaborationScore: 1, sharedDrugs: [], drugOverlapScore: 1, hcpcsOverlapScore: 1, sharedBeneProxy: 1 } as CollaboratorNode;
  positions.set(network.focalProvider.npi, { x: CX, y: CY, node: focal });

  const strong = network.collaborators.filter(c => c.collaborationScore >= 0.4);
  const moderate = network.collaborators.filter(c => c.collaborationScore >= 0.2 && c.collaborationScore < 0.4);
  const weak = network.collaborators.filter(c => c.collaborationScore < 0.2);

  const placeRing = (nodes: CollaboratorNode[], radius: number) => {
    nodes.forEach((n, i) => {
      const angle = (i / Math.max(nodes.length, 1)) * 2 * Math.PI - Math.PI / 2;
      positions.set(n.npi, { x: CX + radius * Math.cos(angle), y: CY + radius * Math.sin(angle), node: n });
    });
  };
  placeRing(strong.slice(0, 12), 160);
  placeRing(moderate.slice(0, 16), 280);
  placeRing(weak.slice(0, 12), 390);

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="collab-graph-svg">
      <defs>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="#475569" />
        </marker>
      </defs>

      {/* Ring guides */}
      {[160, 280, 390].map(r => (
        <circle key={r} cx={CX} cy={CY} r={r} fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
      ))}
      <text x={CX + 165} y={CY - 8} fontSize="10" fill="#475569">Strong (≥0.4)</text>
      <text x={CX + 285} y={CY - 8} fontSize="10" fill="#475569">Moderate (≥0.2)</text>

      {/* Specialty legend */}
      {CARE_TEAM_TYPES.map((t, i) => {
        const meta = SPECIALTY_TYPE_META[t];
        return (
          <g key={t} transform={`translate(${8}, ${H - 110 + i * 17})`}>
            <circle cx={6} cy={6} r={5} fill={meta.color} />
            <text x={14} y={10} fontSize="9" fill="#94a3b8">{meta.icon} {meta.label}</text>
          </g>
        );
      })}

      {/* Edges */}
      {network.edges.map(edge => {
        const src = positions.get(edge.source);
        const tgt = positions.get(edge.target);
        if (!src || !tgt) return null;
        const opacity = 0.15 + edge.score * 0.6;
        const strokeW = Math.max(0.5, edge.score * 3);
        return (
          <line key={`${edge.source}-${edge.target}`}
            x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
            stroke="#64748b" strokeWidth={strokeW} opacity={opacity} />
        );
      })}

      {/* Nodes */}
      {[...positions.values()].map(({ x, y, node }) => {
        const isFocal = node.npi === network.focalProvider.npi;
        const r = isFocal ? 22 : Math.max(8, 6 + node.collaborationScore * 10);
        const color = node.specialtyType ? specialtyTypeColor(node.specialtyType) : specialtyColor(node.specialty);
        return (
          <g key={node.npi} onClick={() => onNodeClick(node)} className="collab-node" style={{ cursor: "pointer" }}>
            <circle cx={x} cy={y} r={r + 3} fill={color} opacity="0.15" />
            <circle cx={x} cy={y} r={r} fill={color} stroke={isFocal ? "#fff" : color} strokeWidth={isFocal ? 3 : 1} />
            {isFocal && <text x={x} y={y + 5} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#fff">YOU</text>}
            {!isFocal && r >= 10 && (
              <text x={x} y={y + r + 12} textAnchor="middle" fontSize="9" fill="#cbd5e1"
                style={{ pointerEvents: "none" }}>
                {node.name.split(" ").slice(-1)[0]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// Care Team view — groups collaborators by specialty type in pods
function CareTeamView({ network, onNodeClick }: { network: CollaborationNetwork; onNodeClick: (n: CollaboratorNode) => void }) {
  const bySpecialty = Object.fromEntries(
    CARE_TEAM_TYPES.map(t => [t, network.collaborators.filter(c => c.specialtyType === t).slice(0, 8)])
  );
  const coveredCount = CARE_TEAM_TYPES.filter(t => bySpecialty[t].length > 0).length;

  return (
    <div className="care-team-view">
      <div className="care-team-completeness">
        <span className="care-team-coverage-label">Care Team Coverage</span>
        <div className="care-team-coverage-badges">
          {CARE_TEAM_TYPES.map(t => {
            const meta = SPECIALTY_TYPE_META[t];
            const has = bySpecialty[t].length > 0;
            return (
              <span key={t} className={`care-team-spec-badge ${has ? "covered" : "missing"}`}
                style={{ borderColor: meta.color, color: has ? meta.color : "#64748b", background: has ? meta.color + "18" : "transparent" }}>
                {has ? "✓" : "✗"} {meta.icon} {meta.label}
              </span>
            );
          })}
        </div>
        <span className="care-team-score">{coveredCount}/{CARE_TEAM_TYPES.length} specialties</span>
      </div>

      <div className="care-team-grid">
        {CARE_TEAM_TYPES.map(t => {
          const meta = SPECIALTY_TYPE_META[t];
          const members = bySpecialty[t];
          return (
            <div key={t} className="care-team-pod" style={{ borderTopColor: meta.color }}>
              <div className="pod-header">
                <span className="pod-icon">{meta.icon}</span>
                <span className="pod-label" style={{ color: meta.color }}>{meta.label}</span>
                {members.length > 0 && <span className="pod-count">{members.length}</span>}
              </div>
              {members.length === 0 ? (
                <div className="pod-empty">No {meta.label.toLowerCase()} found in area</div>
              ) : (
                members.map(c => (
                  <div key={c.npi} className="pod-member" onClick={() => onNodeClick(c)}>
                    <div className="pod-member-name">{c.name}</div>
                    <div className="pod-member-meta">{c.city}, {c.state}</div>
                    <CancerTypeBadges cancerTypes={c.cancerTypes} compact />
                    <div className="pod-member-footer">
                      <span className={`collab-badge collab-${c.collaborationType === "same_group" ? "strong" : scoreLabel(c.collaborationScore).toLowerCase()}`}>
                        {c.collaborationType === "same_group" ? "Same Group" : `${Math.round(c.collaborationScore * 100)}%`}
                      </span>
                      <span className="pod-conn-type">{c.collaborationType === "cross_specialty" ? "Geo" : c.collaborationType === "same_group" ? "" : "Rx/HCPCS"}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CollaborationTab({ year, state }: { year: string; state: string }) {
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<CollaborationProviderSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [network, setNetwork] = useState<CollaborationNetwork | null>(null);
  const [networkLoading, setNetworkLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<CollaboratorNode | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<"graph" | "table" | "care-team">("care-team");
  const [physicianLocations, setPhysicianLocations] = useState<PhysicianLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<PhysicianLocation | null>(null);
  const [focalPartB, setFocalPartB] = useState<PartBServiceRecord[]>([]);
  const [focalAcos, setFocalAcos] = useState<AcoMembership[]>([]);
  const [orderingStatus, setOrderingStatus] = useState<OrderReferringStatus | null>(null);
  const [selectedNodeAco, setSelectedNodeAco] = useState<AcoMembership[]>([]);
  const [selectedNodeOrdering, setSelectedNodeOrdering] = useState<boolean>(false);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const res = await api.searchCollaborationProviders(q, state || undefined, year || undefined);
      setSearchResults(res.providers);
    } catch (e: any) {
      setError(e.message || "Search failed");
    } finally {
      setSearchLoading(false);
    }
  }, [state, year]);

  const loadNetwork = async (npi: string, focalCity?: string, focalState?: string, focalZip?: string) => {
    setNetworkLoading(true);
    setError("");
    setSearchResults([]);
    setSelectedNode(null);
    setSelectedLocation(null);
    try {
      const [net, locResult] = await Promise.all([
        api.getCollaborationNetwork(npi, year || undefined, focalCity, focalState, focalZip),
        focalCity ? Promise.resolve({ locations: [] }) : api.getPhysicianLocations(npi)
      ]);
      setNetwork(net);
      setPhysicianLocations(locResult.locations || []);
      setSelectedNode({ ...net.focalProvider, collaborationScore: 1, sharedDrugs: net.focalProvider.drugs, drugOverlapScore: 1, hcpcsOverlapScore: 1, sharedBeneProxy: 1 });

      // Fetch enrichment data in parallel — failures don't block network load
      try {
        const [partBResult, acoResult, orderResult] = await Promise.all([
          api.getPhysicianPartBServices(npi, year || undefined),
          api.getPhysicianAco(npi),
          api.getOrderingStatus(npi)
        ]);
        setFocalPartB(partBResult.services || []);
        setFocalAcos(acoResult.acos || []);
        setOrderingStatus(orderResult);
      } catch {
        // Enrichment failures are non-fatal
      }
    } catch (e: any) {
      setError(e.message || "Failed to load network");
    } finally {
      setNetworkLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedNode?.npi) return;
    Promise.all([
      api.getPhysicianAco(selectedNode.npi),
      api.getOrderingStatus(selectedNode.npi)
    ]).then(([acoRes, orderRes]) => {
      setSelectedNodeAco(acoRes.acos || []);
      setSelectedNodeOrdering(orderRes.eligible || false);
    }).catch(() => {});
  }, [selectedNode?.npi]);

  const fmtScore = (s: number) => `${Math.round(s * 100)}%`;

  return (
    <div className="analyzer-tab-body">
      <div className="collab-search-bar">
        <input
          type="text"
          className="analyzer-input collab-search-input"
          placeholder="Search physician by name or NPI…"
          value={searchQ}
          onChange={e => { setSearchQ(e.target.value); doSearch(e.target.value); }}
          onKeyDown={e => { if (e.key === "Enter") doSearch(searchQ); }}
        />
        {searchLoading && <span className="analyzer-loading" style={{ padding: "0 12px" }}>Searching…</span>}
      </div>

      {searchResults.length > 0 && (
        <div className="collab-search-results">
          {searchResults.map(p => (
            <div key={p.npi} className="collab-search-item" onClick={() => { setSearchQ(p.name); loadNetwork(p.npi); }}>
              <strong>{p.name}</strong>
              <span className="collab-search-meta">{p.specialty} · {p.city}, {p.state}</span>
              <span className="collab-search-npi">NPI: {p.npi}</span>
            </div>
          ))}
        </div>
      )}

      {physicianLocations.length > 1 && network && !networkLoading && (
        <div className="physician-locations-panel">
          <div className="physician-locations-header">
            {physicianLocations.length} practice locations found — select a location to view the network from that office:
          </div>
          <div className="physician-locations-list">
            {physicianLocations.map((loc, i) => {
              const isActive = selectedLocation
                ? selectedLocation.city === loc.city && selectedLocation.state === loc.state && selectedLocation.zip === loc.zip
                : (network?.focalProvider.city === loc.city && network?.focalProvider.state === loc.state);
              return (
                <button
                  key={i}
                  type="button"
                  className={`physician-location-card${isActive ? " active" : ""}`}
                  onClick={() => {
                    setSelectedLocation(loc);
                    loadNetwork(loc.npi, loc.city, loc.state, loc.zip);
                  }}
                >
                  <div className="loc-facility">{loc.facility_name || "Independent Practice"}</div>
                  <div className="loc-address">{loc.address_line1 && `${loc.address_line1}, `}{loc.city}, {loc.state} {loc.zip}</div>
                  {loc.phone && <div className="loc-phone">{loc.phone}</div>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {error && <div className="analyzer-error">{error}</div>}
      {networkLoading && <div className="analyzer-loading" style={{ padding: "40px", textAlign: "center" }}>Building collaboration network…</div>}

      {!network && !networkLoading && !error && (
        <div className="collab-empty-state">
          <div className="collab-empty-icon">🔬</div>
          <h3>Physician Collaboration Network</h3>
          <p>Search for an oncology or hematology physician to see their collaboration group — physicians who prescribe overlapping drugs and likely share patients.</p>
          <div className="collab-score-legend">
            <h4>Collaboration Score</h4>
            <div className="collab-legend-row"><span className="collab-legend-dot" style={{ background: "#22c55e" }}></span><strong>Same Practice Group</strong> — Score 1.0, strongest signal</div>
            <div className="collab-legend-row"><span className="collab-legend-dot" style={{ background: "#4e9af1" }}></span><strong>HCPCS + Drug overlap</strong> — 40% HCPCS Jaccard + 40% drug Jaccard + 20% geo proxy</div>
            <div className="collab-legend-row"><span className="collab-legend-dot" style={{ background: "#f97316" }}></span><strong>Cross-specialty</strong> — Geographic proximity × specialty affinity (radiation 0.9, pathology 0.9, surgery 0.85, radiology 0.8)</div>
          </div>
          <div className="collab-score-legend" style={{ marginTop: "16px" }}>
            <h4>Specialty Types</h4>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {CARE_TEAM_TYPES.map(t => {
                const meta = SPECIALTY_TYPE_META[t];
                return (
                  <span key={t} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
                    <span style={{ width: 12, height: 12, borderRadius: "50%", background: meta.color, display: "inline-block" }}></span>
                    {meta.icon} {meta.label}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {network && !networkLoading && (
        <div className="collab-network-layout">
          <div className="collab-network-main">
            <div className="collab-network-header">
              <div>
                <div className="collab-focal-name">{network.focalProvider.name}</div>
                <div className="collab-focal-meta">{network.focalProvider.specialty} · {network.focalProvider.city}, {network.focalProvider.state} · NPI: {network.focalProvider.npi}</div>
                <div className="collab-focal-stats">
                  <span>{fmt(network.focalProvider.totalClaims)} claims</span>
                  <span>{network.focalProvider.drugs.length} oncology drugs</span>
                  <span>{network.collaborators.length} collaborators found</span>
                </div>
                {/* Enrichment badges */}
                <div className="collab-enrichment-badges">
                  {orderingStatus?.eligible && (
                    <span className="collab-badge collab-strong" title="Enrolled in CMS Order & Referring list">CMS Ordering Eligible</span>
                  )}
                  {focalPartB.some(s => s.service_category === "NGS") && (
                    <span className="collab-badge collab-strong" title="Bills NGS codes under own NPI — in-house genomic testing">In-House NGS Biller</span>
                  )}
                  {focalPartB.some(s => s.service_category === "CHEMO") && (
                    <span className="collab-badge collab-moderate" title="Bills chemotherapy infusion codes">Chemo Infusion Provider</span>
                  )}
                  {focalAcos.length > 0 && (
                    <span className="collab-badge collab-moderate" title={`Member of ACO: ${focalAcos[0].aco_name}`}>
                      ACO: {focalAcos[0].aco_name}
                    </span>
                  )}
                </div>
              </div>
              <div className="collab-view-toggle">
                <button type="button" className={`analyzer-btn-outline${view === "care-team" ? " active" : ""}`} onClick={() => setView("care-team")}>Care Team</button>
                <button type="button" className={`analyzer-btn-outline${view === "graph" ? " active" : ""}`} onClick={() => setView("graph")}>Graph</button>
                <button type="button" className={`analyzer-btn-outline${view === "table" ? " active" : ""}`} onClick={() => setView("table")}>Table</button>
              </div>
            </div>

            {(focalPartB.length > 0 || focalAcos.length > 0) && (
              <div className="collab-enrichment-section">
                {focalPartB.length > 0 && (
                  <div className="enrichment-block">
                    <h5>Part B Service Billing</h5>
                    <table className="analyzer-table compact-table">
                      <thead><tr><th>Category</th><th>HCPCS</th><th>Description</th><th>Services</th><th>Patients</th><th>Site</th></tr></thead>
                      <tbody>
                        {focalPartB.map((s, i) => (
                          <tr key={i}>
                            <td><span className={`collab-badge collab-${s.service_category === "NGS" ? "strong" : "moderate"}`}>{s.service_category}</span></td>
                            <td className="mono">{s.hcpcs_code}</td>
                            <td style={{ fontSize: "11px" }}>{s.hcpcs_description}</td>
                            <td className="num">{fmt(s.total_services)}</td>
                            <td className="num">{fmt(s.total_unique_benes)}</td>
                            <td>{s.place_of_service === "F" ? "Facility" : "Office"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {focalAcos.length > 0 && (
                  <div className="enrichment-block">
                    <h5>ACO Memberships</h5>
                    {focalAcos.map((a, i) => (
                      <div key={i} className="aco-card">
                        <strong>{a.aco_name}</strong>
                        <span className="collab-search-meta">{a.practice_name} · {a.city}, {a.state} · PY{a.performance_year}</span>
                        <span className="collab-search-npi">ACO ID: {a.aco_id}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {view === "care-team" && (
              <CareTeamView network={network} onNodeClick={setSelectedNode} />
            )}

            {view === "graph" && (
              <div className="collab-graph-wrap">
                <CollaborationGraph network={network} onNodeClick={setSelectedNode} />
              </div>
            )}

            {view === "table" && (
              <div className="analyzer-table-wrap">
                <table className="analyzer-table">
                  <thead>
                    <tr>
                      <th>Physician</th>
                      <th>Specialty</th>
                      <th>Location</th>
                      <th>Shared Drugs</th>
                      <th>Drug ∩</th>
                      <th>HCPCS ∩</th>
                      <th>Bene Proxy</th>
                      <th>Score</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {network.collaborators.map(c => (
                      <tr key={c.npi} onClick={() => setSelectedNode(c)} style={{ cursor: "pointer" }}>
                        <td>
                          <strong>{c.name}</strong>
                          <div style={{ fontSize: "11px", color: "#94a3b8" }}>NPI: {c.npi}</div>
                        </td>
                        <td><span style={{ color: specialtyColor(c.specialty), fontSize: "12px" }}>⬤</span> {c.specialty}</td>
                        <td>{c.city}, {c.state}</td>
                        <td style={{ fontSize: "11px" }}>{c.sharedDrugs.slice(0, 3).join(", ")}{c.sharedDrugs.length > 3 ? ` +${c.sharedDrugs.length - 3}` : ""}</td>
                        <td className="num">{fmtScore(c.drugOverlapScore)}</td>
                        <td className="num">{fmtScore(c.hcpcsOverlapScore)}</td>
                        <td className="num">{fmtScore(c.sharedBeneProxy)}</td>
                        <td className="num"><strong>{fmtScore(c.collaborationScore)}</strong></td>
                        <td><span className={`collab-badge collab-${c.collaborationType === "same_group" ? "strong" : scoreLabel(c.collaborationScore).toLowerCase()}`}>{c.collaborationType === "same_group" ? "Group" : scoreLabel(c.collaborationScore)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {selectedNode && (
            <div className="collab-detail-panel">
              <div className="collab-detail-header">
                <h4>{selectedNode.name}</h4>
                <button type="button" className="drawer-close-btn" onClick={() => setSelectedNode(null)}>✕</button>
              </div>
              <div className="collab-detail-body">
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                  {selectedNodeOrdering && <span className="collab-badge collab-strong">CMS Ordering Eligible</span>}
                  {selectedNodeAco.length > 0 && <span className="collab-badge collab-moderate">ACO: {selectedNodeAco[0].aco_name}</span>}
                </div>
                <div className="collab-detail-row"><span>Specialty</span><span style={{ color: specialtyColor(selectedNode.specialty) }}>{selectedNode.specialty || "—"}</span></div>
                <div className="collab-detail-row"><span>Location</span><span>{selectedNode.city}, {selectedNode.state}</span></div>
                <div className="collab-detail-row"><span>NPI</span><span>{selectedNode.npi}</span></div>
                {!selectedNode.isFocal && <>
                  <div className="collab-detail-row"><span>Collaboration Score</span><strong>{fmtScore(selectedNode.collaborationScore)} — {selectedNode.collaborationType === "same_group" ? "Same Practice Group" : scoreLabel(selectedNode.collaborationScore)}</strong></div>
                  {selectedNode.collaborationType && <div className="collab-detail-row"><span>Connection Type</span><span style={{ textTransform: "capitalize" }}>{selectedNode.collaborationType.replace(/_/g, " ")}</span></div>}
                  <div className="collab-detail-row"><span>Drug Overlap</span><span>{fmtScore(selectedNode.drugOverlapScore)}</span></div>
                  <div className="collab-detail-row"><span>HCPCS Overlap</span><span>{fmtScore(selectedNode.hcpcsOverlapScore)}</span></div>
                  <div className="collab-detail-row"><span>Shared Bene Proxy</span><span>{fmtScore(selectedNode.sharedBeneProxy)}</span></div>
                  <div className="collab-detail-row"><span>Total Claims</span><span>{fmt(selectedNode.totalClaims)}</span></div>
                  {selectedNode.cancerTypes && selectedNode.cancerTypes.length > 0 && (
                    <div className="collab-detail-section">
                      <div className="collab-detail-label">Inferred Cancer Types</div>
                      <CancerTypeBadges cancerTypes={selectedNode.cancerTypes} />
                    </div>
                  )}
                  {selectedNode.sharedDrugs.length > 0 && (
                    <div className="collab-detail-section">
                      <div className="collab-detail-label">Shared Drugs</div>
                      <div className="collab-drug-list">
                        {selectedNode.sharedDrugs.map(d => <span key={d} className="collab-drug-tag">{d}</span>)}
                      </div>
                    </div>
                  )}
                </>}
                {selectedNode.isFocal && network && (
                  <div className="collab-detail-section">
                    {network.focalProvider.groupName && (
                      <div className="collab-detail-row"><span>Practice Group</span><span>{network.focalProvider.groupName}</span></div>
                    )}
                    {network.focalProvider.hcpcsCodes.length > 0 && (
                      <div className="collab-detail-row"><span>HCPCS Codes</span><span>{network.focalProvider.hcpcsCodes.length} codes on file</span></div>
                    )}
                    {network.focalProvider.cancerTypes?.length > 0 && (
                      <>
                        <div className="collab-detail-label">Inferred Cancer Types</div>
                        <CancerTypeBadges cancerTypes={network.focalProvider.cancerTypes} />
                      </>
                    )}
                    <div className="collab-detail-label" style={{ marginTop: "12px" }}>Drug Portfolio ({year})</div>
                    <div className="collab-drug-list">
                      {network.focalProvider.drugs.map(d => <span key={d} className="collab-drug-tag">{d}</span>)}
                    </div>
                    {network.focalProvider.prescriptionHistory.length > 0 && (
                      <>
                        <div className="collab-detail-label" style={{ marginTop: "12px" }}>Full Prescription History</div>
                        <table className="analyzer-table compact-table">
                          <thead><tr><th>Drug</th><th>Year</th><th>Claims</th><th>Cost</th></tr></thead>
                          <tbody>
                            {network.focalProvider.prescriptionHistory.map((rx, i) => (
                              <tr key={i}>
                                <td>{rx.drug_name}</td>
                                <td>{rx.year}</td>
                                <td className="num">{fmt(rx.total_claim_count)}</td>
                                <td className="num">{fmtUsd(rx.total_drug_cost)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hospital Network Tab
// ─────────────────────────────────────────────────────────────────────────────

function HospitalNetworkTab({ year, state }: { year: string; state: string }) {
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<HospitalSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [network, setNetwork] = useState<HospitalNetwork | null>(null);
  const [networkLoading, setNetworkLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<HospitalProvider | null>(null);
  const [expandedAffiliates, setExpandedAffiliates] = useState(false);
  const [showAllDrugs, setShowAllDrugs] = useState(false);
  const [showAllLabs, setShowAllLabs] = useState(false);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const res = await api.searchHospitals(q, state || undefined);
      setSearchResults(res.hospitals);
    } catch (e: any) {
      setError(e.message || "Search failed");
    } finally {
      setSearchLoading(false);
    }
  }, [state]);

  const loadNetwork = async (ccn: string) => {
    setNetworkLoading(true);
    setError("");
    setSearchResults([]);
    setSelectedProvider(null);
    try {
      const net = await api.getHospitalNetwork(ccn, year || undefined);
      setNetwork(net);
    } catch (e: any) {
      setError(e.message || "Failed to load hospital network");
    } finally {
      setNetworkLoading(false);
    }
  };

  const HOSPITAL_SPECIALTIES: Array<{ key: keyof HospitalNetwork["providers"]; label: string; icon: string; color: string }> = [
    { key: "oncology",   label: "Medical Oncology / Hematology",  icon: "💊", color: "#3b82f6" },
    { key: "hematology", label: "Hematology",                     icon: "🩸", color: "#8b5cf6" },
    { key: "surgery",    label: "Surgical Oncology & Surgery",     icon: "🔪", color: "#22c55e" },
    { key: "radiology",  label: "Radiology",                      icon: "🩻", color: "#06b6d4" },
    { key: "pathology",  label: "Pathology",                      icon: "🔬", color: "#eab308" },
    { key: "midlevels",  label: "Mid-Levels (NP / PA)",           icon: "🩺", color: "#f97316" },
    { key: "referrers",  label: "Inferred Referring Providers",    icon: "↗",  color: "#94a3b8" },
  ];

  return (
    <div className="analyzer-tab-body">
      <div className="collab-search-bar">
        <input
          type="text"
          className="analyzer-input collab-search-input"
          placeholder="Search hospital by name…"
          value={searchQ}
          onChange={e => { setSearchQ(e.target.value); doSearch(e.target.value); }}
          onKeyDown={e => { if (e.key === "Enter") doSearch(searchQ); }}
        />
        {searchLoading && <span className="analyzer-loading" style={{ padding: "0 12px" }}>Searching…</span>}
      </div>

      {searchResults.length > 0 && (
        <div className="collab-search-results">
          {searchResults.map(h => (
            <div key={h.ccn} className="collab-search-item" onClick={() => { setSearchQ(h.name); loadNetwork(h.ccn); }}>
              <strong>{h.name}</strong>
              <span className="collab-search-meta">{h.hospital_type} · {h.city}, {h.state}</span>
              {h.health_system && <span className="collab-search-npi">System: {h.health_system}</span>}
            </div>
          ))}
        </div>
      )}

      {error && <div className="analyzer-error">{error}</div>}
      {networkLoading && <div className="analyzer-loading" style={{ padding: "40px", textAlign: "center" }}>Building hospital network…</div>}

      {!network && !networkLoading && !error && (
        <div className="collab-empty-state">
          <div className="collab-empty-icon">🏥</div>
          <h3>Hospital Network Analysis</h3>
          <p>Search for a hospital to discover its full oncology care team — affiliated physicians by specialty, mid-levels (NP/PA), and inferred referring providers. Affiliated hospitals in the same health system are included automatically.</p>
          <div className="collab-score-legend">
            <h4>What you'll see</h4>
            <div className="collab-legend-row"><strong>Core Team</strong> — Medical oncology, hematology, surgical oncology, radiation oncology, pathology, radiology</div>
            <div className="collab-legend-row"><strong>Mid-Levels</strong> — Nurse practitioners and physician assistants affiliated with the hospital</div>
            <div className="collab-legend-row"><strong>Inferred Referrers</strong> — Internal medicine, gastroenterology, pulmonology, urology and other specialties likely to refer oncology patients</div>
            <div className="collab-legend-row"><strong>Prescribing Data</strong> — Crossreferenced with Medicare Part D to show top oncology drugs and companion diagnostic requirements</div>
          </div>
          <div className="analyzer-callout" style={{ marginTop: "16px" }}>
            <strong>Data required:</strong> Run <code>npm run download:hospital</code> then <code>npm run process:hospital</code> then <code>npm run upload -- --hospital</code> in the <code>etl/</code> folder to load hospital data.
          </div>
        </div>
      )}

      {network && !networkLoading && (
        <div className="collab-network-layout">
          <div className="collab-network-main">
            {/* Hospital header */}
            <div className="collab-network-header">
              <div>
                <div className="collab-focal-name">🏥 {network.hospital.name}</div>
                <div className="collab-focal-meta">
                  {network.hospital.hospital_type} · {network.hospital.city}, {network.hospital.state} {network.hospital.zip}
                  {network.hospital.health_system && ` · System: ${network.hospital.health_system}`}
                </div>
                <div className="collab-focal-stats">
                  <span>{fmt(network.prescribingHighlights.totalProviders)} affiliated providers</span>
                  <span>{network.affiliateHospitals.length} affiliate hospitals</span>
                  <span>{network.prescribingHighlights.companionDxCount} providers with companion Dx drugs</span>
                </div>
              </div>
            </div>

            {/* Affiliate hospitals */}
            {network.affiliateHospitals.length > 0 && (
              <div className="hospital-affiliates-section">
                <button
                  type="button"
                  className="analyzer-btn-outline"
                  onClick={() => setExpandedAffiliates(v => !v)}
                  style={{ marginBottom: "8px" }}
                >
                  {expandedAffiliates ? "▾" : "▸"} {network.affiliateHospitals.length} Affiliated Hospitals
                  {network.hospital.health_system && ` (${network.hospital.health_system})`}
                </button>
                {expandedAffiliates && (
                  <div className="hospital-affiliates-list">
                    {network.affiliateHospitals.map(a => (
                      <div key={a.ccn} className="hospital-affiliate-card" onClick={() => { setSearchQ(a.name); loadNetwork(a.ccn); }} style={{ cursor: "pointer" }}>
                        <div className="affiliate-name">{a.name}</div>
                        <div className="affiliate-location">{a.city}, {a.state}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Prescribing highlights — all drugs */}
            {network.prescribingHighlights.allDrugs.length > 0 && (
              <div className="hospital-rx-highlights">
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                  <h4 style={{ margin: 0 }}>Oncology Drugs Prescribed at This Hospital ({network.prescribingHighlights.allDrugs.length} total)</h4>
                  {network.prescribingHighlights.allDrugs.length > 8 && (
                    <button type="button" className="analyzer-btn-outline" style={{ fontSize: "11px", padding: "2px 8px" }}
                      onClick={() => setShowAllDrugs(v => !v)}>
                      {showAllDrugs ? "Show fewer" : `Show all ${network.prescribingHighlights.allDrugs.length}`}
                    </button>
                  )}
                </div>
                <div className="analyzer-bar-chart">
                  {(showAllDrugs ? network.prescribingHighlights.allDrugs : network.prescribingHighlights.allDrugs.slice(0, 8)).map(d => (
                    <div className="analyzer-bar-row" key={d.drug}>
                      <div className="analyzer-bar-label">
                        <span className="lab-name">{d.drug}</span>
                        {d.companionDx && <span className="companion-badge">Companion Dx</span>}
                      </div>
                      <MiniBar value={d.claims} max={network.prescribingHighlights.allDrugs[0].claims} />
                      <div className="analyzer-bar-value">{fmt(d.claims)} claims · {d.providers} providers</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lab testing — NGS/IHC/FISH at this hospital */}
            {network.labTesting.length > 0 && (
              <div className="hospital-rx-highlights">
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                  <h4 style={{ margin: 0 }}>NGS / IHC / FISH Lab Testing ({network.labTesting.length} entries)</h4>
                  {network.labTesting.length > 6 && (
                    <button type="button" className="analyzer-btn-outline" style={{ fontSize: "11px", padding: "2px 8px" }}
                      onClick={() => setShowAllLabs(v => !v)}>
                      {showAllLabs ? "Show fewer" : `Show all ${network.labTesting.length}`}
                    </button>
                  )}
                </div>
                <div className="analyzer-table-wrap">
                  <table className="analyzer-table compact-table">
                    <thead>
                      <tr>
                        <th>Lab / Provider</th>
                        <th>Location</th>
                        <th>Test Type</th>
                        <th>HCPCS</th>
                        <th>Services</th>
                        <th>Patients</th>
                        <th>Affiliated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(showAllLabs ? network.labTesting : network.labTesting.slice(0, 6)).map((lab, i) => (
                        <tr key={`${lab.npi}-${lab.hcpcsCode}-${i}`}>
                          <td><strong>{lab.name || lab.npi}</strong><div style={{ fontSize: "11px", color: "#94a3b8" }}>NPI: {lab.npi}</div></td>
                          <td>{lab.city}, {lab.state}</td>
                          <td><span className={`collab-badge collab-${lab.testCategory === "NGS" ? "strong" : "moderate"}`}>{lab.testCategory}</span></td>
                          <td title={lab.hcpcsDescription} className="mono">{lab.hcpcsCode}</td>
                          <td className="num">{fmt(lab.totalServices)}</td>
                          <td className="num">{fmt(lab.totalPatients)}</td>
                          <td>{lab.isHospitalAffiliated ? <span className="collab-badge collab-strong">Yes</span> : <span style={{ color: "#64748b", fontSize: "11px" }}>Geo only</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Provider specialty pods */}
            <div className="care-team-grid">
              {HOSPITAL_SPECIALTIES.map(({ key, label, icon, color }) => {
                const members = network.providers[key] || [];
                return (
                  <div key={key} className="care-team-pod" style={{ borderTopColor: color }}>
                    <div className="pod-header">
                      <span className="pod-icon">{icon}</span>
                      <span className="pod-label" style={{ color }}>{label}</span>
                      {members.length > 0 && <span className="pod-count">{members.length}</span>}
                    </div>
                    {members.length === 0 ? (
                      <div className="pod-empty">No {label.toLowerCase()} found</div>
                    ) : (
                      members.slice(0, 6).map(p => (
                        <div key={p.npi} className="pod-member" onClick={() => setSelectedProvider(p)}>
                          <div className="pod-member-name">{p.name}</div>
                          <div className="pod-member-meta">{p.credentials && `${p.credentials} · `}{p.city}, {p.state}</div>
                          {p.totalClaims > 0 && (
                            <div className="pod-member-footer">
                              <span className="collab-badge collab-moderate">{fmt(p.totalClaims)} claims</span>
                              {p.hasCompanionDx && <span className="companion-badge" style={{ fontSize: "10px" }}>Companion Dx</span>}
                            </div>
                          )}
                          {p.drugs.length > 0 && (
                            <div className="pod-member-drugs">{p.drugs.slice(0, 2).join(", ")}{p.drugs.length > 2 ? ` +${p.drugs.length - 2}` : ""}</div>
                          )}
                        </div>
                      ))
                    )}
                    {members.length > 6 && (
                      <div className="pod-more">+{members.length - 6} more</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Provider detail panel */}
          {selectedProvider && (
            <div className="collab-detail-panel">
              <div className="collab-detail-header">
                <h4>{selectedProvider.name}</h4>
                <button type="button" className="drawer-close-btn" onClick={() => setSelectedProvider(null)}>✕</button>
              </div>
              <div className="collab-detail-body">
                <div className="collab-detail-row"><span>Specialty</span><span>{selectedProvider.specialty || "—"}</span></div>
                <div className="collab-detail-row"><span>Credentials</span><span>{selectedProvider.credentials || "—"}</span></div>
                <div className="collab-detail-row"><span>Location</span><span>{selectedProvider.city}, {selectedProvider.state} {selectedProvider.zip}</span></div>
                <div className="collab-detail-row"><span>NPI</span><span>{selectedProvider.npi}</span></div>
                <div className="collab-detail-row"><span>Affiliated Hospital</span><span>{selectedProvider.affiliatedHospital}</span></div>
                {selectedProvider.totalClaims > 0 && (
                  <div className="collab-detail-row"><span>Total Claims ({year})</span><span>{fmt(selectedProvider.totalClaims)}</span></div>
                )}
                {selectedProvider.drugs.length > 0 && (
                  <div className="collab-detail-section">
                    <div className="collab-detail-label">Oncology Drugs ({year})</div>
                    <div className="collab-drug-list">
                      {selectedProvider.drugs.map(d => <span key={d} className="collab-drug-tag">{d}</span>)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
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
    { id: "prospects", label: "Prospect List ★" },
    { id: "collaboration", label: "Collaboration Network 🔬" },
    { id: "hospital-network", label: "Hospital Network 🏥" },
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
              placeholder="Name, NPI… (Enter = all states/years)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && search.trim()) {
                  setState("");
                  setYear("");
                }
              }}
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
        {activeTab === "collaboration" && <CollaborationTab year={year} state={state} />}
        {activeTab === "hospital-network" && <HospitalNetworkTab year={year} state={state} />}
      </div>

      {crossRefNpi && (
        <CrossRefDrawer npi={crossRefNpi} onClose={() => setCrossRefNpi(null)} />
      )}
    </div>
  );
}
