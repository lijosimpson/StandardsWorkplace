import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { api } from "./api";
import { AnalyzerPage } from "./AnalyzerPage";
import type {
  AssignmentItem,
  AuditLogEntry,
  CommitteeMeeting,
  CommitteeMeetingAppendixInput,
  CommitteePerson,
  CustomQualityMetric,
  DocumentExportFormat,
  Hospital,
  ProcessDocument,
  PrqWarRoomItem,
  QualityReferenceDocument,
  QualityMetricTemplate,
  QualityMetricSummaryResponse,
  RegistryDashboardSummary,
  StandardDetailResponse,
  StandardListItem,
  StandardRoleAssignment,
  TemplateDraft,
  TemplateDraftRevision,
  UploadItem,
  AccreditationFramework,
  UserRole
} from "./types";

const userRoles: UserRole[] = ["admin", "owner", "staff", "auditor"];
const frameworkOptions: AccreditationFramework[] = ["CoC", "NAPBC", "NCPRC", "NQF", "ASCO", "ASTRO", "ACR", "Other"];

const formatSelectedFrameworks = (frameworks: AccreditationFramework[]): string => frameworks.length === 0 ? "None selected" : frameworks.join(", ");

const isDefaultProgramMetricLabel = (value: string): boolean =>
  /^Program-defined metric\s+\d+\s+\([^)]+\)$/.test(value.trim());

const isMetricsOnlyStandard = (standardCode: string): boolean => /^[1-4]\./.test(standardCode);
const usesOncoLensFeatures = (standardCode: string): boolean => ["2.5", "6.1"].includes(standardCode);
const committeeRoleStandardCode = "2.1";
const isCurrentRoleAssignment = (assignment: StandardRoleAssignment): boolean => !assignment.endDate || assignment.endDate >= new Date().toISOString().slice(0, 10);
const buildEvidenceUploadGuidance = (standardCode: string): string => {
  switch (standardCode) {
    case "2.1":
      return "Upload committee rosters, appointment letters, credential records, and any supporting role coverage documents for this standard.";
    case "2.2":
      return "Upload CLP presentation slides, agendas, minutes, and any files showing the two required NCDB presentations.";
    case "2.3":
      return "Upload agendas, attendance records, signed minutes, and quarter-specific meeting documentation for this standard.";
    case "2.4":
      return "Upload attendance logs, alternate coverage records, and any annual attendance summary used for this standard.";
    case "2.5":
      return "Upload the multidisciplinary case conference protocol, coordinator monitoring materials, annual report files, and committee minutes for this standard.";
    case "3.1":
      return "Upload facility licenses, accreditation records, and other active supporting documents for this requirement.";
    case "3.2":
      return "Upload diagnostic imaging, radiation oncology, systemic therapy, quality assurance, and pathology support documents for this requirement.";
    case "4.1":
      return "Upload physician credential packets, board-certification records, and cancer-related CME files for physicians covered by this requirement.";
    case "4.2":
      return "Upload the oncology nursing protocol, annual evaluation materials, accreditation-cycle review evidence, and committee minutes for this standard.";
    case "4.3":
      return "Upload registry credential templates, supervision plans, continuing-education records, and any ODS support documents for this standard.";
    case "4.4":
      return "Upload genetics service coverage evidence, the required protocol, the selected-site guideline process, and the annual committee report for this standard.";
    case "4.5":
      return "Upload palliative care availability evidence, the required protocol, monitoring materials, and the annual committee report for this standard.";
    case "4.6":
      return "Upload rehabilitation referral protocols, service availability evidence, annual evaluation materials, and committee minutes for this standard.";
    case "4.7":
      return "Upload Registered Dietitian Nutritionist coverage evidence, oncology nutrition service materials, annual evaluation files, and committee minutes for this standard.";
    case "4.8":
      return "Upload the survivorship team roster, program monitoring materials, annual report files, and committee minutes for this standard.";
    case "5.1":
    case "5.3":
    case "5.4":
    case "5.5":
    case "5.6":
    case "5.7":
    case "5.8":
      return "Upload audit worksheets, case-review summaries, action plans, and any supporting documents used for this annual audit.";
    case "5.2":
      return "Upload psychosocial access protocols, distress screening and referral workflows, screening evidence, annual report files, and committee-review materials for this standard.";
    case "5.9":
      return "Upload tobacco screening logs, referral tracking, audit summaries, and any supporting workflow documents for this standard.";
    case "6.1":
      return "Upload registry quality-control reports, reabstraction summaries, follow-up reports, timeliness reviews, and related evidence for this standard.";
    case "6.4":
      return "Upload RCRS submission confirmations, compliance reports, committee minutes, and any supporting registry monitoring files for this standard.";
    case "6.5":
      return "Upload follow-up rate reports, contact-attempt logs, and annual follow-up review documents for this standard.";
    case "7.1":
      return "Upload benchmark reports, measure summaries, and any quality review files used to track the required accountability measures.";
    case "7.2":
      return "Upload guideline concordance reports, exception reviews, improvement action plans, and committee-review files for each monitored evidence-based guideline.";
    case "7.3":
    case "7.4":
      return "Upload baseline data, progress updates, final reports, and committee-review materials for this improvement standard.";
    case "9.1":
      return "Upload the clinical research screening protocol, barrier review summaries, accrual reports, annual report materials, and cancer committee minutes supporting this standard.";
    case "9.2":
      return "Upload special study participation records, required submissions, and supporting evidence for this standard.";
    default:
      return "Upload any supporting letters, reports, minutes, audits, logs, or working files for this standard here.";
  }
};

const buildMetricWordingGuidance = (standardCode: string): string => {
  switch (standardCode) {
    case "2.1":
      return "These role lines are roster-driven. Adjust wording only if your program needs a clearer local label for the role coverage being tracked.";
    case "5.1":
    case "5.2":
    case "5.3":
    case "5.4":
    case "5.5":
    case "5.6":
    case "5.7":
    case "5.8":
      return "Keep these labels aligned to the specific annual audit or review element your program is documenting so the audit trail stays clear.";
    case "7.1":
    case "7.2":
      return "Replace any generic measure references with the actual NCDB, CoC, or evidence-based guideline titles your program is monitoring this year.";
    case "9.1":
      return "Keep the three lines aligned to the screening protocol, the required accrual percentage, and the annual Clinical Research Coordinator report documented in committee minutes.";
    case "9.2":
      return "Use wording that reflects the special study requirements that apply to your program category for the current cycle.";
    default:
      return "Use program-owned wording that clearly matches the evidence your team is tracking for this standard.";
  }
};

const sanitizeFileStem = (value: string): string => {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "committee-appendix";
};

const escapeHtml = (value: string): string => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/\"/g, "&quot;")
  .replace(/'/g, "&#39;");

const buildStandardCommitteeAppendixTemplate = (
  detail: StandardDetailResponse,
  metricLabels: string[]
): string => {
  const metricLines = metricLabels.length > 0
    ? metricLabels.map((label, index) => `- [${detail.state.componentsComplete[index] ? "x" : " "}] ${label}`).join("\n")
    : "- No metric wording has been configured yet.";

  const processLines = detail.standard.hospitalProcess.length > 0
    ? detail.standard.hospitalProcess.map((step, index) => {
      const completedQuarters = Object.entries(detail.state.processQuarterChecks[String(index)] || {})
        .filter(([, checked]) => checked)
        .map(([quarter]) => quarter);
      const linkedDocs = detail.processDocuments
        .filter((doc) => doc.processIndex === index)
        .map((doc) => doc.originalName);
      const statusSuffix = detail.state.processHiddenSteps[String(index)]
        ? " | status: not required"
        : completedQuarters.length > 0
          ? ` | completed quarters: ${completedQuarters.join(", ")}`
          : "";
      const docSuffix = linkedDocs.length > 0 ? ` | supporting docs: ${linkedDocs.join(", ")}` : "";
      return `- Step ${index + 1}: ${step}${statusSuffix}${docSuffix}`;
    }).join("\n")
    : "- No hospital process steps are configured for this standard.";

  const uploadLines = detail.uploads.length > 0
    ? detail.uploads.map((item) => `- ${item.originalName}`).join("\n")
    : "- No standard uploads are currently stored.";

  const assignmentLines = detail.assignments.length > 0
    ? detail.assignments.map((item) => `- ${item.componentLabel} | ${item.assignee} | due ${item.dueDate} | ${item.status}`).join("\n")
    : "- No assignments are currently open for this standard.";

  return [
    `${detail.standard.code} ${detail.standard.name} Cancer Committee Appendix`,
    "",
    `Category: ${detail.standard.category}`,
    `Framework: ${detail.standard.framework}`,
    `Current compliance: ${detail.results.numerator}/${detail.results.denominator} (${detail.results.compliancePercent}%)`,
    `Threshold: ${detail.standard.threshold.label}`,
    "",
    "Committee discussion summary",
    "- Summarize the discussion, findings, and any concerns reviewed by the committee.",
    "",
    "Editable metric wording",
    metricLines,
    "",
    "Hospital process / workflow",
    processLines,
    "",
    "Evidence currently on file",
    uploadLines,
    "",
    "Assignments / follow-up",
    assignmentLines,
    "",
    "Committee decisions and action items",
    "- Decision:",
    "- Owner:",
    "- Due date:",
    "",
    "Appendix note",
    "- This appendix was generated from the live standard workspace and may be edited before final committee filing."
  ].join("\n");
};

const buildWordDocumentHtml = (title: string, body: string): string => `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      body {
        font-family: Calibri, Arial, sans-serif;
        color: #1f2937;
        margin: 36px;
      }
      h1 {
        font-size: 18pt;
        margin-bottom: 8px;
      }
      p.meta {
        color: #4b5563;
        margin: 0 0 18px;
      }
      pre {
        white-space: pre-wrap;
        word-break: break-word;
        font-family: Calibri, Arial, sans-serif;
        font-size: 11pt;
        line-height: 1.45;
        margin: 0;
      }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <p class="meta">Generated ${escapeHtml(new Date().toLocaleString())}</p>
    <pre>${escapeHtml(body)}</pre>
  </body>
</html>`;

const buildQuarterSnapshot = (checks: Record<string, boolean>): string =>
  (["Q1", "Q2", "Q3", "Q4"] as const)
    .map((quarter) => `${quarter}: ${checks[quarter] ? "Complete" : "Open"}`)
    .join("\n");

const buildStandardEvidenceTemplate = (detail: StandardDetailResponse, metricLabels: string[]): string => {
  const currentLabels = metricLabels.length > 0 ? metricLabels : detail.state.metricLabels;
  const storedFiles = detail.uploads.length > 0
    ? detail.uploads.map((item) => `- ${item.originalName}`).join("\n")
    : "- No standard-level files are stored yet.";

  return [
    `${detail.standard.code} ${detail.standard.name} Working Evidence Template`,
    "",
    `Category: ${detail.standard.category}`,
    `Threshold: ${detail.standard.threshold.label}`,
    `Current compliance: ${detail.results.compliancePercent}%`,
    "",
    "Program summary",
    "- Describe how this standard is operationalized at the hospital.",
    "- Identify the owner responsible for maintaining this evidence.",
    "",
    "Editable standard language / metric wording",
    ...currentLabels.map((label, index) => `- ${index + 1}. ${label}`),
    "",
    "Required evidence narrative",
    "- Source documents reviewed:",
    "- Meeting or review dates:",
    "- Gaps identified:",
    "- Corrective action / monitoring plan:",
    "",
    "Currently stored files",
    storedFiles,
    "",
    "Committee appendix summary",
    "- Summarize the points that should carry into committee minutes or the appendix."
  ].join("\n");
};

const buildProcessStepTemplate = (
  detail: StandardDetailResponse,
  processIndex: number,
  displayedStepLabel: string
): string => {
  const key = String(processIndex);
  const quarterSnapshot = buildQuarterSnapshot(detail.state.processQuarterChecks?.[key] || {});
  const stepDocs = detail.processDocuments.filter((doc) => doc.processIndex === processIndex);
  const storedStepDocs = stepDocs.length > 0
    ? stepDocs.map((doc) => `- ${doc.originalName}`).join("\n")
    : "- No step-specific files are stored yet.";

  return [
    `${detail.standard.code} ${detail.standard.name} - Step ${processIndex + 1}`,
    "",
    `Step objective: ${displayedStepLabel}`,
    `Required status: ${detail.state.processHiddenSteps?.[key] ? "Marked not required" : "Required"}`,
    "",
    "Step write-up",
    "- Describe how this step is completed in practice.",
    "- Identify the workflow, policy, data source, or report that supports the step.",
    "- Record the staff role or owner responsible for updates.",
    "",
    "Quarter storage snapshot",
    quarterSnapshot,
    "",
    "Evidence and review details",
    "- Evidence reviewed:",
    "- Date reviewed:",
    "- Findings / variances:",
    "- Follow-up actions:",
    "",
    "Existing step files",
    storedStepDocs,
    "",
    "Committee appendix note",
    "- Summarize what should be carried into committee minutes for this step."
  ].join("\n");
};

type CommitteeAppendixDraft = CommitteeMeetingAppendixInput & {
  label: string;
  filePath: string;
  standardCode: string;
  processIndex: number | null;
  templateDraftKind: TemplateDraft["kind"] | null;
};

type StandardTemplateDraft = {
  title: string;
  body: string;
};

const findSavedTemplateDraft = (
  detail: StandardDetailResponse,
  kind: TemplateDraft["kind"],
  processIndex: number | null = null
): TemplateDraft | undefined => detail.templateDrafts.find((item) => item.kind === kind && item.processIndex === processIndex);

const formatSavedDraftNote = (draft?: TemplateDraft): string => {
  if (!draft) return "No saved draft yet.";
  return `Saved draft updated ${new Date(draft.updatedAt).toLocaleString()} by ${draft.updatedBy}.`;
};

const createTemplateDraftAppendixDraft = (draft: TemplateDraft): CommitteeAppendixDraft => ({
  sourceType: "template-draft",
  sourceId: draft.id,
  explanation: "",
  label: draft.title,
  filePath: "",
  standardCode: draft.standardCode,
  processIndex: draft.processIndex,
  templateDraftKind: draft.kind
});

const buildCommitteeAppendixKey = (appendix: Pick<CommitteeMeetingAppendixInput, "sourceType" | "sourceId">): string => `${appendix.sourceType}:${appendix.sourceId}`;

const createCommitteeAppendixDraft = (item: UploadItem | ProcessDocument, sourceType: "upload" | "process-document"): CommitteeAppendixDraft => ({
  sourceType,
  sourceId: item.id,
  explanation: "",
  label: sourceType === "process-document" ? `Step ${(item as ProcessDocument).processIndex + 1}: ${item.originalName}` : item.originalName,
  filePath: item.filePath,
  standardCode: item.standardCode,
  processIndex: sourceType === "process-document" ? (item as ProcessDocument).processIndex : null,
  templateDraftKind: null
});

function App() {
  const [role, setRole] = useState<UserRole>("owner");
  const [userName, setUserName] = useState("Cancer Program User");
  const [showAnalyzer, setShowAnalyzer] = useState(false);

  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState("");

  const [standards, setStandards] = useState<StandardListItem[]>([]);
  const [selectedFrameworks, setSelectedFrameworks] = useState<AccreditationFramework[]>(["CoC"]);
  const [selectedStandardCode, setSelectedStandardCode] = useState("");
  const [detail, setDetail] = useState<StandardDetailResponse | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [newAssignment, setNewAssignment] = useState({ componentLabel: "", assignee: "", dueDate: "" });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const [editableMetricLabels, setEditableMetricLabels] = useState<string[]>([]);
  const [newCustomMetric, setNewCustomMetric] = useState<{ framework: AccreditationFramework; title: string; description: string; target: string }>({
    framework: "CoC",
    title: "",
    description: "",
    target: ""
  });

  const detailPanelRef = useRef<HTMLElement>(null);
  const processSectionRef = useRef<HTMLElement>(null);
  const isInitialLoad = useRef(true);
  const [processDocFiles, setProcessDocFiles] = useState<Record<number, File | null>>({});
  const [operationsOpen, setOperationsOpen] = useState(false);
  const [qualitySummary, setQualitySummary] = useState<QualityMetricSummaryResponse | null>(null);
  const [qualityReferenceDocs, setQualityReferenceDocs] = useState<QualityReferenceDocument[]>([]);
  const [qualityReferenceFramework, setQualityReferenceFramework] = useState<"ACS" | "ASCO" | "ASTRO" | "Other">("ACS");
  const [qualityReferenceTitle, setQualityReferenceTitle] = useState("");
  const [qualityReferenceFile, setQualityReferenceFile] = useState<File | null>(null);
  const [prqWarRoomItems, setPrqWarRoomItems] = useState<PrqWarRoomItem[]>([]);
  const [committeeMeetings, setCommitteeMeetings] = useState<CommitteeMeeting[]>([]);
  const [committeePeople, setCommitteePeople] = useState<CommitteePerson[]>([]);
  const [committeeRoleData, setCommitteeRoleData] = useState<{ roleList: string[]; assignments: StandardRoleAssignment[] }>({ roleList: [], assignments: [] });
  const [registryDashboard, setRegistryDashboard] = useState<RegistryDashboardSummary | null>(null);
  const [newPrqItem, setNewPrqItem] = useState<{ title: string; category: PrqWarRoomItem["category"]; owner: string; dueDate: string; notes: string }>({
    title: "",
    category: "PRQ",
    owner: "",
    dueDate: "",
    notes: ""
  });
  const [newCommitteePerson, setNewCommitteePerson] = useState<{ name: string; degrees: string }>({ name: "", degrees: "" });
  const [newRoleAssignment, setNewRoleAssignment] = useState<{ roleName: string; personId: string; personName: string; degrees: string; startDate: string; endDate: string; notes: string }>({
    roleName: "Chairperson",
    personId: "",
    personName: "",
    degrees: "",
    startDate: "",
    endDate: "",
    notes: ""
  });
  const [newCommitteeMeeting, setNewCommitteeMeeting] = useState<{ title: string; meetingDate: string; quarter: CommitteeMeeting["quarter"]; presenter: string; conferenceCaseCount: number; notes: string; standardCodes: string[]; referencedRoleAssignmentIds: string[]; referencedUploadIds: string[]; appendices: CommitteeMeetingAppendixInput[]; minutes: string }>({
    title: "",
    meetingDate: "",
    quarter: "Q1",
    presenter: "",
    conferenceCaseCount: 0,
    notes: "",
    standardCodes: [committeeRoleStandardCode],
    referencedRoleAssignmentIds: [],
    referencedUploadIds: [],
    appendices: [],
    minutes: ""
  });
  const [standardMinutesEntry, setStandardMinutesEntry] = useState<{ title: string; meetingDate: string; quarter: CommitteeMeeting["quarter"]; presenter: string; notes: string; minutes: string; referencedUploadIds: string[]; appendices: CommitteeAppendixDraft[] }>({
    title: "",
    meetingDate: "",
    quarter: "Q1",
    presenter: "",
    notes: "",
    minutes: "",
    referencedUploadIds: [],
    appendices: []
  });
  const [appendixTemplateTitle, setAppendixTemplateTitle] = useState("");
  const [appendixTemplateBody, setAppendixTemplateBody] = useState("");
  const [standardEvidenceDraft, setStandardEvidenceDraft] = useState<StandardTemplateDraft | null>(null);
  const [processTemplateDrafts, setProcessTemplateDrafts] = useState<Record<number, StandardTemplateDraft>>({});
  const prqItemValidationMessage = !newPrqItem.title.trim() || !newPrqItem.owner.trim() || !newPrqItem.dueDate
    ? "Title, owner, and due date are required to add a strategy item."
    : "";

  const filteredStandards = useMemo(
    () => standards.filter((item) => !item.retired && selectedFrameworks.includes(item.framework)),
    [standards, selectedFrameworks]
  );
  const selectedStandard = useMemo(
    () => filteredStandards.find((item) => item.code === selectedStandardCode),
    [filteredStandards, selectedStandardCode]
  );
  const visibleQualityMetricTemplates = useMemo(
    () => (detail?.qualityMetricLibrary || []).filter((item) => selectedFrameworks.includes(item.framework)),
    [detail?.qualityMetricLibrary, selectedFrameworks]
  );
  const visibleCustomQualityMetrics = useMemo(
    () => (detail?.customQualityMetrics || []).filter((item) => selectedFrameworks.includes(item.framework)),
    [detail?.customQualityMetrics, selectedFrameworks]
  );
  const selectableCustomMetricFrameworks = useMemo(
    () => frameworkOptions.filter((item) => selectedFrameworks.includes(item)),
    [selectedFrameworks]
  );
  const requiredMetricCount = detail?.standard.requiredMetricCount ?? detail?.standard.numeratorComponents.length ?? 0;
  const trackedMetricCount = detail?.standard.numeratorComponents.length ?? 0;
  const trackedCompletedCount = detail?.state.componentsComplete.filter(Boolean).length ?? 0;

  const committeeRoleOptions = useMemo(
    () => Array.from(new Set([...(committeeRoleData.roleList || []), ...(detail?.roleList || [])])),
    [committeeRoleData.roleList, detail?.roleList]
  );

  const committeeMinuteRoleAssignments = useMemo(
    () => committeeRoleData.assignments.filter((assignment) => assignment.standardCode === committeeRoleStandardCode),
    [committeeRoleData.assignments]
  );

  const makeStandardMinutesEntry = (currentDetail: StandardDetailResponse, quarter: CommitteeMeeting["quarter"] = "Q1") => ({
    title: `${currentDetail.standard.code} ${currentDetail.standard.name} review`,
    meetingDate: "",
    quarter,
    presenter: "",
    notes: "",
    minutes: "",
    referencedUploadIds: [],
    appendices: [] as CommitteeAppendixDraft[]
  });

  const standardMinutesAppendixKeys = useMemo(
    () => new Set(standardMinutesEntry.appendices.map((item) => buildCommitteeAppendixKey(item))),
    [standardMinutesEntry.appendices]
  );
  const standardEvidenceSavedDraft = useMemo(
    () => detail ? findSavedTemplateDraft(detail, "standard-evidence") : undefined,
    [detail]
  );
  const committeeAppendixSavedDraft = useMemo(
    () => detail ? findSavedTemplateDraft(detail, "committee-appendix") : undefined,
    [detail]
  );

  const loadHospitals = async () => {
    const data = await api.getHospitals();
    setHospitals(data);
    if (data.length > 0) setSelectedHospitalId((current) => current || data[0].id);
  };

  const loadStandards = async (hospitalId: string) => {
    const data = await api.getStandards(hospitalId);
    setStandards(data);
    if (data.length > 0) setSelectedStandardCode((current) => current || data[0].code);
  };

  const loadDetail = async (hospitalId: string, standardCode: string) => {
    const data = await api.getStandardDetail(hospitalId, standardCode);
    setDetail(data);
    setEditableMetricLabels(data.standard.numeratorComponents);
  };

  const loadAuditLogs = async (hospitalId: string) => {
    const logs = await api.getAuditLogs(hospitalId);
    setAuditLogs(logs);
  };

  const loadQualitySummary = async (hospitalId: string) => {
    const summary = await api.getQualityMetricSummary(hospitalId);
    setQualitySummary(summary);
  };

  const loadQualityReferenceDocs = async (hospitalId: string) => {
    const docs = await api.getQualityReferenceDocs(hospitalId);
    setQualityReferenceDocs(docs);
  };

  const loadPrqWarRoomItems = async (hospitalId: string) => {
    const items = await api.getPrqWarRoomItems(hospitalId);
    setPrqWarRoomItems(items);
  };

  const loadCommitteeMeetings = async (hospitalId: string) => {
    const items = await api.getCommitteeMeetings(hospitalId);
    setCommitteeMeetings(items);
  };

  const loadCommitteePeople = async (hospitalId: string) => {
    const items = await api.getCommitteePeople(hospitalId);
    setCommitteePeople(items);
  };

  const loadCommitteeRoleAssignments = async (hospitalId: string) => {
    const data = await api.getRoleAssignments(hospitalId, committeeRoleStandardCode);
    setCommitteeRoleData(data);
    setNewRoleAssignment((current) => ({
      ...current,
      roleName: current.roleName || data.roleList[0] || ""
    }));
  };

  const loadRegistryDashboard = async (hospitalId: string) => {
    const summary = await api.getRegistryDashboard(hospitalId);
    setRegistryDashboard(summary);
  };

  const scrollToProcessSection = () => {
    if (detailPanelRef.current && processSectionRef.current) {
      detailPanelRef.current.scrollTo({
        top: Math.max(processSectionRef.current.offsetTop - 24, 0),
        behavior: "smooth"
      });
    }
  };

  const getDisplayedProcessStepLabel = (fallbackStep: string, index: number) => {
    const liveMetricLabel = editableMetricLabels[index]?.trim();
    return liveMetricLabel && liveMetricLabel.length > 0 ? liveMetricLabel : fallbackStep;
  };

  const loadOperationsData = async (hospitalId: string) => {
    await Promise.all([
      loadAuditLogs(hospitalId),
      loadQualitySummary(hospitalId),
      loadQualityReferenceDocs(hospitalId),
      loadPrqWarRoomItems(hospitalId),
      loadCommitteeMeetings(hospitalId),
      loadCommitteePeople(hospitalId),
      loadCommitteeRoleAssignments(hospitalId),
      loadRegistryDashboard(hospitalId)
    ]);
  };

  const refreshStandardData = async (hospitalId: string, standardCode: string) => {
    await Promise.all([
      loadStandards(hospitalId),
      loadDetail(hospitalId, standardCode)
    ]);
  };

  const refreshVisibleOperationsData = async (hospitalId: string) => {
    if (!operationsOpen) return;
    await loadOperationsData(hospitalId);
  };

  useEffect(() => {
    setLoading(true);
    (async () => {
      const hospitalsData = await api.getHospitals();
      setHospitals(hospitalsData);
      if (hospitalsData.length === 0) return;
      const hospitalId = hospitalsData[0].id;
      setSelectedHospitalId(hospitalId);

      const standardsData = await api.getStandards(hospitalId);
      setStandards(standardsData);
      if (standardsData.length === 0) return;
      const code = standardsData[0].code;
      setSelectedStandardCode(code);

      const detailData = await api.getStandardDetail(hospitalId, code);
      setDetail(detailData);
      setEditableMetricLabels(detailData.standard.numeratorComponents);
    })()
      .catch((err) => setError(err.message || "Failed to load"))
      .finally(() => {
        setLoading(false);
        isInitialLoad.current = false;
      });
  }, []);

  useEffect(() => {
    if (isInitialLoad.current) return;
    if (!selectedHospitalId) return;
    setLoading(true);
    loadStandards(selectedHospitalId)
      .catch((err) => setError(err.message || "Failed to load standards"))
      .finally(() => setLoading(false));
  }, [selectedHospitalId]);

  useEffect(() => {
    if (filteredStandards.length === 0) {
      setSelectedStandardCode("");
      setDetail(null);
      return;
    }
    if (!filteredStandards.some((item) => item.code === selectedStandardCode)) {
      setSelectedStandardCode(filteredStandards[0].code);
    }
  }, [filteredStandards, selectedStandardCode]);

  useEffect(() => {
    if (selectableCustomMetricFrameworks.length === 0) return;
    if (!selectableCustomMetricFrameworks.includes(newCustomMetric.framework)) {
      setNewCustomMetric((prev) => ({ ...prev, framework: selectableCustomMetricFrameworks[0] }));
    }
  }, [newCustomMetric.framework, selectableCustomMetricFrameworks]);

  useEffect(() => {
    if (!selectedHospitalId || !operationsOpen) return;
    setLoading(true);
    loadOperationsData(selectedHospitalId)
      .catch((err) => setError(err.message || "Failed to load operations data"))
      .finally(() => setLoading(false));
  }, [operationsOpen, selectedHospitalId]);

  useEffect(() => {
    if (isInitialLoad.current) return;
    if (!selectedHospitalId || !selectedStandardCode) return;
    setLoading(true);
    loadDetail(selectedHospitalId, selectedStandardCode)
      .catch((err) => setError(err.message || "Failed to load standard detail"))
      .finally(() => setLoading(false));
  }, [selectedHospitalId, selectedStandardCode]);

  // Scroll detail panel to top when standard changes
  useEffect(() => {
    if (detailPanelRef.current) {
      detailPanelRef.current.scrollTop = 0;
    }
  }, [selectedStandardCode]);

  useEffect(() => {
    setSelectedFiles([]);
  }, [selectedHospitalId, selectedStandardCode]);

  useEffect(() => {
    if (!detail) return;
    setStandardMinutesEntry(makeStandardMinutesEntry(detail));

    const standardDraft = findSavedTemplateDraft(detail, "standard-evidence");
    setStandardEvidenceDraft(standardDraft ? { title: standardDraft.title, body: standardDraft.body } : null);

    const savedProcessDrafts = detail.templateDrafts.reduce<Record<number, StandardTemplateDraft>>((accumulator, draft) => {
      if (draft.kind === "process-step" && draft.processIndex !== null) {
        accumulator[draft.processIndex] = { title: draft.title, body: draft.body };
      }
      return accumulator;
    }, {});
    setProcessTemplateDrafts(savedProcessDrafts);

    const appendixDraft = findSavedTemplateDraft(detail, "committee-appendix");
    setAppendixTemplateTitle(appendixDraft?.title || `${detail.standard.code} ${detail.standard.name} Committee Appendix`);
    setAppendixTemplateBody(appendixDraft?.body || buildStandardCommitteeAppendixTemplate(detail, detail.state.metricLabels));
  }, [detail]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const updateComponent = async (index: number, checked: boolean) => {
    if (!detail || !selectedHospitalId || role === "auditor") return;
    const next = [...detail.state.componentsComplete];
    next[index] = checked;

    try {
      setLoading(true);
      await api.updateMetrics(selectedHospitalId, detail.standard.code, role, userName, {
        componentsComplete: next,
        denominatorValue: detail.state.denominatorValue
      });
      await refreshStandardData(selectedHospitalId, detail.standard.code);
      await refreshVisibleOperationsData(selectedHospitalId);
      setNotice("Metric progress updated.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update component");
    } finally {
      setLoading(false);
    }
  };

  const saveMetricLabels = async () => {
    if (!detail || !selectedHospitalId || role === "auditor") return;
    const cleaned = editableMetricLabels.map((x) => x.trim()).filter((x) => x.length > 0);
    if (cleaned.length === 0) {
      setError("At least one metric label is required.");
      return;
    }
    if (cleaned.length < requiredMetricCount) {
      setError(`At least ${requiredMetricCount} required metric lines must remain in place.`);
      return;
    }

    try {
      setLoading(true);
      await api.updateMetricLabels(selectedHospitalId, detail.standard.code, role, userName, cleaned);
      await refreshStandardData(selectedHospitalId, detail.standard.code);
      await refreshVisibleOperationsData(selectedHospitalId);
      scrollToProcessSection();
      setNotice("Metric wording saved.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save metric labels");
    } finally {
      setLoading(false);
    }
  };

  const addMetricLabel = () => {
    setEditableMetricLabels((prev) => [...prev, `Program-defined metric ${prev.length + 1}`]);
  };

  const removeMetricLabel = (index: number) => {
    setEditableMetricLabels((prev) => prev.filter((_, idx) => idx !== index));
  };

  const updateDenominator = async (value: number) => {
    if (!detail || !selectedHospitalId || role === "auditor") return;

    try {
      setLoading(true);
      await api.updateMetrics(selectedHospitalId, detail.standard.code, role, userName, {
        componentsComplete: detail.state.componentsComplete,
        denominatorValue: value
      });
      await refreshStandardData(selectedHospitalId, detail.standard.code);
      await refreshVisibleOperationsData(selectedHospitalId);
      setNotice("Denominator updated.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update denominator");
    } finally {
      setLoading(false);
    }
  };

  const createAssignment = async () => {
    if (!detail || !selectedHospitalId || role === "auditor") return;
    if (!newAssignment.componentLabel || !newAssignment.assignee || !newAssignment.dueDate) {
      setError("Assignment needs component label, assignee, and due date.");
      return;
    }

    try {
      setLoading(true);
      await api.createAssignment(selectedHospitalId, detail.standard.code, role, userName, newAssignment);
      setNewAssignment({ componentLabel: "", assignee: "", dueDate: "" });
      await refreshStandardData(selectedHospitalId, detail.standard.code);
      await refreshVisibleOperationsData(selectedHospitalId);
      setNotice("Assignment created.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create assignment");
    } finally {
      setLoading(false);
    }
  };

  const toggleAssignment = async (item: AssignmentItem) => {
    if (!selectedHospitalId || role === "auditor") return;

    try {
      setLoading(true);
      await api.updateAssignment(selectedHospitalId, item.standardCode, item.id, role, userName, {
        status: item.status === "open" ? "done" : "open"
      });
      await refreshStandardData(selectedHospitalId, item.standardCode);
      await refreshVisibleOperationsData(selectedHospitalId);
      setNotice(item.status === "open" ? "Assignment marked done." : "Assignment reopened.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update assignment");
    } finally {
      setLoading(false);
    }
  };

  const _uploadEvidence = async () => {
    if (!detail || !selectedHospitalId || selectedFiles.length === 0 || role === "auditor") return;

    try {
      setLoading(true);
      for (const file of selectedFiles) {
        await api.uploadEvidence(selectedHospitalId, detail.standard.code, role, userName, file);
      }
      setSelectedFiles([]);
      await refreshStandardData(selectedHospitalId, detail.standard.code);
      await refreshVisibleOperationsData(selectedHospitalId);
      setNotice(selectedFiles.length > 1 ? "Evidence files uploaded." : "Evidence file uploaded.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload evidence");
    } finally {
      setLoading(false);
    }
  };

  const createCustomMetric = async (payload: { framework: AccreditationFramework; title: string; description: string; target: string }) => {
    if (!detail || !selectedHospitalId || role === "auditor") return;
    if (!payload.title.trim() || !payload.target.trim()) {
      setError("Custom quality metric requires title and target.");
      return;
    }

    try {
      setLoading(true);
      await api.createCustomQualityMetric(selectedHospitalId, detail.standard.code, role, userName, {
        ...payload,
        title: payload.title.trim(),
        description: payload.description.trim(),
        target: payload.target.trim()
      });
      setNewCustomMetric({ framework: selectableCustomMetricFrameworks[0] || "CoC", title: "", description: "", target: "" });
      await refreshStandardData(selectedHospitalId, detail.standard.code);
      await refreshVisibleOperationsData(selectedHospitalId);
      setNotice("Quality metric created.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create custom quality metric");
    } finally {
      setLoading(false);
    }
  };

  const quickAddTemplate = async (template: QualityMetricTemplate) => {
    await createCustomMetric({ ...template, framework: template.framework });
  };
  const downloadQualityMetricsCsv = async () => {
    if (!selectedHospitalId) return;

    try {
      const csv = await api.downloadCustomQualityMetricsCsv(selectedHospitalId);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quality-metrics-${selectedHospitalId}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download quality metrics CSV");
    }
  };

  const setCustomMetricStatus = async (item: CustomQualityMetric, status: CustomQualityMetric["status"]) => {
    if (!selectedHospitalId || role === "auditor") return;
    try {
      setLoading(true);
      await api.updateCustomQualityMetric(selectedHospitalId, item.standardCode, item.id, role, userName, { status });
      await refreshStandardData(selectedHospitalId, item.standardCode);
      await refreshVisibleOperationsData(selectedHospitalId);
      setNotice(`Quality metric marked ${status}.`);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update custom metric status");
    } finally {
      setLoading(false);
    }
  };

  const deleteCustomMetric = async (item: CustomQualityMetric) => {
    if (!selectedHospitalId || role === "auditor") return;
    try {
      setLoading(true);
      await api.deleteCustomQualityMetric(selectedHospitalId, item.standardCode, item.id, role, userName);
      await refreshStandardData(selectedHospitalId, item.standardCode);
      await refreshVisibleOperationsData(selectedHospitalId);
      setNotice("Quality metric deleted.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete custom metric");
    } finally {
      setLoading(false);
    }
  };


  const updateProcessQuarter = async (processIndex: number, quarter: string, checked: boolean) => {
    if (!detail || !selectedHospitalId || role === "auditor") return;
    try {
      setLoading(true);
      await api.updateProcessQuarter(selectedHospitalId, detail.standard.code, role, userName, processIndex, quarter, checked);
      await refreshStandardData(selectedHospitalId, detail.standard.code);
      await refreshVisibleOperationsData(selectedHospitalId);
      setNotice(`Step ${processIndex + 1} ${quarter} marked ${checked ? "complete" : "not complete"}.`);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update process quarter check");
    } finally {
      setLoading(false);
    }
  };

  const updateProcessVisibility = async (processIndex: number, hidden: boolean) => {
    if (!detail || !selectedHospitalId || role === "auditor") return;
    try {
      setLoading(true);
      await api.updateProcessVisibility(selectedHospitalId, detail.standard.code, role, userName, processIndex, hidden);
      await refreshStandardData(selectedHospitalId, detail.standard.code);
      await refreshVisibleOperationsData(selectedHospitalId);
      setNotice(hidden ? `Step ${processIndex + 1} marked not required.` : `Step ${processIndex + 1} restored as required.`);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update process step visibility");
    } finally {
      setLoading(false);
    }
  };

  const _uploadProcessDoc = async (processIndex: number) => {
    if (!detail || !selectedHospitalId || role === "auditor") return;
    const file = processDocFiles[processIndex];
    if (!file) return;
    try {
      setLoading(true);
      await api.uploadProcessDoc(selectedHospitalId, detail.standard.code, role, userName, processIndex, file);
      setProcessDocFiles((prev) => { const next = { ...prev }; delete next[processIndex]; return next; });
      await refreshStandardData(selectedHospitalId, detail.standard.code);
      await refreshVisibleOperationsData(selectedHospitalId);
      setNotice("Process document uploaded.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload process document");
    } finally {
      setLoading(false);
    }
  };

  const deleteProcessDoc = async (doc: ProcessDocument) => {
    if (!selectedHospitalId || role === "auditor") return;
    try {
      setLoading(true);
      await api.deleteProcessDoc(selectedHospitalId, doc.standardCode, role, userName, doc.id);
      await refreshStandardData(selectedHospitalId, doc.standardCode);
      await refreshVisibleOperationsData(selectedHospitalId);
      setNotice("Process document removed.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete process document");
    } finally {
      setLoading(false);
    }
  };

  const uploadQualityReferenceDoc = async () => {
    if (!selectedHospitalId || role !== "admin" || !qualityReferenceFile) return;

    try {
      setLoading(true);
      await api.uploadQualityReferenceDoc(selectedHospitalId, role, userName, {
        framework: qualityReferenceFramework,
        title: qualityReferenceTitle.trim(),
        file: qualityReferenceFile
      });
      setQualityReferenceFile(null);
      setQualityReferenceTitle("");
      await loadQualityReferenceDocs(selectedHospitalId);
      await loadAuditLogs(selectedHospitalId);
      setNotice("Quality source document uploaded.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload quality reference document");
    } finally {
      setLoading(false);
    }
  };

  const deleteQualityReferenceDoc = async (docId: string) => {
    if (!selectedHospitalId || role !== "admin") return;

    try {
      setLoading(true);
      await api.deleteQualityReferenceDoc(selectedHospitalId, docId, role, userName);
      await loadQualityReferenceDocs(selectedHospitalId);
      await loadAuditLogs(selectedHospitalId);
      setNotice("Quality source document deleted.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete quality reference document");
    } finally {
      setLoading(false);
    }
  };

  const createPrqWarRoomItem = async () => {
    if (!selectedHospitalId || role === "auditor") return;
    if (!newPrqItem.title.trim() || !newPrqItem.owner.trim() || !newPrqItem.dueDate) {
      setError("PRQ war room items require title, owner, and due date.");
      return;
    }
    try {
      setLoading(true);
      await api.createPrqWarRoomItem(selectedHospitalId, role, userName, {
        title: newPrqItem.title.trim(),
        category: newPrqItem.category,
        owner: newPrqItem.owner.trim(),
        dueDate: newPrqItem.dueDate,
        notes: newPrqItem.notes.trim()
      });
      setNewPrqItem({ title: "", category: "PRQ", owner: "", dueDate: "", notes: "" });
      await loadPrqWarRoomItems(selectedHospitalId);
      await loadAuditLogs(selectedHospitalId);
      await loadRegistryDashboard(selectedHospitalId);
      setNotice("Strategy room item added.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create PRQ war room item");
    } finally {
      setLoading(false);
    }
  };

  const setPrqWarRoomItemStatus = async (item: PrqWarRoomItem, status: PrqWarRoomItem["status"]) => {
    if (!selectedHospitalId || role === "auditor") return;
    try {
      setLoading(true);
      await api.updatePrqWarRoomItem(selectedHospitalId, item.id, role, userName, { status });
      await loadPrqWarRoomItems(selectedHospitalId);
      await loadAuditLogs(selectedHospitalId);
      setNotice(`Strategy item marked ${status}.`);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update PRQ war room item");
    } finally {
      setLoading(false);
    }
  };

  const deletePrqWarRoomItem = async (itemId: string) => {
    if (!selectedHospitalId || role === "auditor") return;
    try {
      setLoading(true);
      await api.deletePrqWarRoomItem(selectedHospitalId, itemId, role, userName);
      await loadPrqWarRoomItems(selectedHospitalId);
      await loadAuditLogs(selectedHospitalId);
      await loadRegistryDashboard(selectedHospitalId);
      setNotice("Strategy room item deleted.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete PRQ war room item");
    } finally {
      setLoading(false);
    }
  };

  const createCommitteeMeeting = async () => {
    if (!selectedHospitalId || role === "auditor") return;
    if (!newCommitteeMeeting.title.trim() || !newCommitteeMeeting.meetingDate) {
      setError("Committee meetings require title and meeting date.");
      return;
    }
    try {
      setLoading(true);
      await api.createCommitteeMeeting(selectedHospitalId, role, userName, {
        title: newCommitteeMeeting.title.trim(),
        meetingDate: newCommitteeMeeting.meetingDate,
        quarter: newCommitteeMeeting.quarter,
        presenter: newCommitteeMeeting.presenter.trim(),
        conferenceCaseCount: Number(newCommitteeMeeting.conferenceCaseCount) || 0,
        notes: newCommitteeMeeting.notes.trim(),
        standardCodes: newCommitteeMeeting.standardCodes,
        referencedRoleAssignmentIds: newCommitteeMeeting.referencedRoleAssignmentIds,
        referencedUploadIds: newCommitteeMeeting.referencedUploadIds,
        appendices: newCommitteeMeeting.appendices,
        minutes: newCommitteeMeeting.minutes.trim()
      });
      setNewCommitteeMeeting({ title: "", meetingDate: "", quarter: "Q1", presenter: "", conferenceCaseCount: 0, notes: "", standardCodes: [committeeRoleStandardCode], referencedRoleAssignmentIds: [], referencedUploadIds: [], appendices: [], minutes: "" });
      await loadCommitteeMeetings(selectedHospitalId);
      await loadAuditLogs(selectedHospitalId);
      await loadRegistryDashboard(selectedHospitalId);
      setNotice("Committee minutes added.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create committee meeting");
    } finally {
      setLoading(false);
    }
  };

  const createStandardCommitteeMeeting = async () => {
    if (!selectedHospitalId || !detail || role === "auditor") return;
    if (!standardMinutesEntry.title.trim() || !standardMinutesEntry.meetingDate) {
      setError("Minutes shortcut requires title and meeting date.");
      return;
    }
    try {
      setLoading(true);
      await api.createCommitteeMeeting(selectedHospitalId, role, userName, {
        title: standardMinutesEntry.title.trim(),
        meetingDate: standardMinutesEntry.meetingDate,
        quarter: standardMinutesEntry.quarter,
        presenter: standardMinutesEntry.presenter.trim(),
        conferenceCaseCount: 0,
        notes: standardMinutesEntry.notes.trim(),
        standardCodes: [detail.standard.code],
        referencedRoleAssignmentIds: [],
        referencedUploadIds: standardMinutesEntry.referencedUploadIds,
        appendices: standardMinutesEntry.appendices.map(({ sourceType, sourceId, explanation }) => ({
          sourceType,
          sourceId,
          explanation: explanation.trim()
        })),
        minutes: standardMinutesEntry.minutes.trim()
      });
      setStandardMinutesEntry(makeStandardMinutesEntry(detail, standardMinutesEntry.quarter));
      await loadCommitteeMeetings(selectedHospitalId);
      await loadAuditLogs(selectedHospitalId);
      await loadRegistryDashboard(selectedHospitalId);
      setNotice("Standard added to cancer committee minutes.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add this standard to cancer committee minutes");
    } finally {
      setLoading(false);
    }
  };

  const setCommitteeMeetingStatus = async (item: CommitteeMeeting, status: CommitteeMeeting["status"]) => {
    if (!selectedHospitalId || role === "auditor") return;
    try {
      setLoading(true);
      await api.updateCommitteeMeeting(selectedHospitalId, item.id, role, userName, { status });
      await loadCommitteeMeetings(selectedHospitalId);
      await loadAuditLogs(selectedHospitalId);
      await loadRegistryDashboard(selectedHospitalId);
      setNotice(`Committee minutes marked ${status}.`);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update committee meeting");
    } finally {
      setLoading(false);
    }
  };

  const deleteCommitteeMeeting = async (meetingId: string) => {
    if (!selectedHospitalId || role === "auditor") return;
    try {
      setLoading(true);
      await api.deleteCommitteeMeeting(selectedHospitalId, meetingId, role, userName);
      await loadCommitteeMeetings(selectedHospitalId);
      await loadAuditLogs(selectedHospitalId);
      await loadRegistryDashboard(selectedHospitalId);
      setNotice("Committee minutes deleted.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete committee meeting");
    } finally {
      setLoading(false);
    }
  };

  const createCommitteePerson = async () => {
    if (!selectedHospitalId || role === "auditor") return;
    if (!newCommitteePerson.name.trim()) {
      setError("Committee person name is required.");
      return;
    }

    try {
      setLoading(true);
      await api.createCommitteePerson(selectedHospitalId, role, userName, {
        name: newCommitteePerson.name.trim(),
        degrees: newCommitteePerson.degrees.trim()
      });
      setNewCommitteePerson({ name: "", degrees: "" });
      await loadCommitteePeople(selectedHospitalId);
      await loadCommitteeRoleAssignments(selectedHospitalId);
      await loadAuditLogs(selectedHospitalId);
      setNotice("Committee individual added.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create committee person");
    } finally {
      setLoading(false);
    }
  };

  const createRoleAssignment = async () => {
    if (!selectedHospitalId || !detail || role === "auditor") return;
    if (!newRoleAssignment.roleName.trim() || !newRoleAssignment.startDate) {
      setError("Role name and start date are required.");
      return;
    }
    if (!newRoleAssignment.personId && !newRoleAssignment.personName.trim()) {
      setError("Select an existing person or enter a new individual name.");
      return;
    }

    try {
      setLoading(true);
      await api.createRoleAssignment(selectedHospitalId, detail.standard.code, role, userName, {
        roleName: newRoleAssignment.roleName.trim(),
        assignmentType: "primary",
        personId: newRoleAssignment.personId || undefined,
        personName: newRoleAssignment.personId ? undefined : newRoleAssignment.personName.trim(),
        degrees: newRoleAssignment.personId ? undefined : newRoleAssignment.degrees.trim(),
        startDate: newRoleAssignment.startDate,
        endDate: newRoleAssignment.endDate || undefined,
        notes: newRoleAssignment.notes.trim() || undefined
      });
      setNewRoleAssignment({
        roleName: detail.roleList[0] || committeeRoleData.roleList[0] || "",
        personId: "",
        personName: "",
        degrees: "",
        startDate: "",
        endDate: "",
        notes: ""
      });
      await refreshStandardData(selectedHospitalId, detail.standard.code);
      await refreshVisibleOperationsData(selectedHospitalId);
      setNotice("Role assignment saved.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create role assignment");
    } finally {
      setLoading(false);
    }
  };

  const updateRoleAssignmentEndDate = async (assignment: StandardRoleAssignment, endDate: string) => {
    if (!selectedHospitalId || role === "auditor") return;
    try {
      setLoading(true);
      await api.updateRoleAssignment(selectedHospitalId, assignment.standardCode, assignment.id, role, userName, { endDate });
      await refreshStandardData(selectedHospitalId, assignment.standardCode);
      await refreshVisibleOperationsData(selectedHospitalId);
      setNotice(endDate ? "Role assignment ended." : "Role assignment reactivated.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role assignment");
    } finally {
      setLoading(false);
    }
  };

  const deleteRoleAssignment = async (assignment: StandardRoleAssignment) => {
    if (!selectedHospitalId || role === "auditor") return;
    try {
      setLoading(true);
      await api.deleteRoleAssignment(selectedHospitalId, assignment.standardCode, assignment.id, role, userName);
      await refreshStandardData(selectedHospitalId, assignment.standardCode);
      await refreshVisibleOperationsData(selectedHospitalId);
      setNotice("Role assignment deleted.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete role assignment");
    } finally {
      setLoading(false);
    }
  };

  const queueStandardMinutesAppendix = (draft: CommitteeAppendixDraft) => {
    let added = false;
    setStandardMinutesEntry((prev) => {
      if (prev.appendices.some((item) => buildCommitteeAppendixKey(item) === buildCommitteeAppendixKey(draft))) {
        return prev;
      }
      added = true;
      return {
        ...prev,
        appendices: [...prev.appendices, draft]
      };
    });
    setNotice(added ? "Appendix added to the minutes draft." : "That appendix is already in the minutes draft.");
    setError("");
  };

  const updateStandardMinutesAppendixExplanation = (appendix: CommitteeAppendixDraft, explanation: string) => {
    const appendixKey = buildCommitteeAppendixKey(appendix);
    setStandardMinutesEntry((prev) => ({
      ...prev,
      appendices: prev.appendices.map((item) => buildCommitteeAppendixKey(item) === appendixKey ? { ...item, explanation } : item)
    }));
  };

  const removeStandardMinutesAppendix = (appendix: CommitteeAppendixDraft) => {
    const appendixKey = buildCommitteeAppendixKey(appendix);
    setStandardMinutesEntry((prev) => ({
      ...prev,
      appendices: prev.appendices.filter((item) => buildCommitteeAppendixKey(item) !== appendixKey)
    }));
  };

  const rebuildStandardAppendixTemplate = () => {
    if (!detail) return;
    setAppendixTemplateTitle(`${detail.standard.code} ${detail.standard.name} Committee Appendix`);
    setAppendixTemplateBody(buildStandardCommitteeAppendixTemplate(
      detail,
      editableMetricLabels.length > 0 ? editableMetricLabels : detail.state.metricLabels
    ));
    setNotice("Committee appendix template rebuilt from the current standard view.");
    setError("");
  };

  const saveCommitteeAppendixDraft = async () => {
    if (!detail || !selectedHospitalId || role === "auditor") return;

    const cleanTitle = appendixTemplateTitle.trim() || `${detail.standard.code} ${detail.standard.name} Committee Appendix`;
    const cleanBody = appendixTemplateBody.trim();
    if (!cleanBody) {
      setError("Appendix template content cannot be blank.");
      return;
    }

    try {
      setLoading(true);
      await api.saveTemplateDraft(selectedHospitalId, detail.standard.code, role, userName, {
        kind: "committee-appendix",
        title: cleanTitle,
        body: cleanBody
      });
      await refreshStandardData(selectedHospitalId, detail.standard.code);
      setNotice("Committee appendix draft saved.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save the committee appendix draft");
    } finally {
      setLoading(false);
    }
  };

  const saveStandardAppendixTemplate = async (addToMinutes: boolean) => {
    if (!detail || !selectedHospitalId || role === "auditor") return;

    const cleanTitle = appendixTemplateTitle.trim() || `${detail.standard.code} ${detail.standard.name} Committee Appendix`;
    const cleanBody = appendixTemplateBody.trim();

    if (!cleanBody) {
      setError("Appendix template content cannot be blank.");
      return;
    }

    try {
      setLoading(true);
      const fileName = `${sanitizeFileStem(cleanTitle)}.doc`;
      const html = buildWordDocumentHtml(cleanTitle, cleanBody);
      const file = new File([html], fileName, { type: "application/msword" });

      const downloadUrl = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);

      const uploaded = await api.uploadEvidence(selectedHospitalId, detail.standard.code, role, userName, file);
      if (addToMinutes) {
        queueStandardMinutesAppendix({
          ...createCommitteeAppendixDraft(uploaded, "upload"),
          explanation: `Program-generated appendix template for ${detail.standard.code} ${detail.standard.name}.`
        });
      }
      await refreshStandardData(selectedHospitalId, detail.standard.code);
      await refreshVisibleOperationsData(selectedHospitalId);
      setNotice(addToMinutes ? "Word appendix saved and added to the minutes appendix draft." : "Word appendix saved to the file list for this standard.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save the committee appendix document");
    } finally {
      setLoading(false);
    }
  };

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const createExportedTemplateFile = async (title: string, body: string, format: DocumentExportFormat): Promise<File> => {
    const fileName = `${sanitizeFileStem(title)}.${format}`;
    const blob = await api.exportDocumentTemplate({ title, body, fileName: sanitizeFileStem(title), format });
    return new File([blob], fileName, {
      type: format === "docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "application/msword"
    });
  };

  const startStandardEvidenceTemplate = () => {
    if (!detail) return;
    setStandardEvidenceDraft({
      title: `${detail.standard.code} ${detail.standard.name} Working Evidence`,
      body: buildStandardEvidenceTemplate(detail, editableMetricLabels)
    });
    setError("");
  };

  const startProcessTemplateDraft = (processIndex: number, displayedStepLabel: string) => {
    if (!detail) return;
    setProcessTemplateDrafts((prev) => ({
      ...prev,
      [processIndex]: {
        title: `${detail.standard.code} Step ${processIndex + 1} ${detail.standard.name}`,
        body: buildProcessStepTemplate(detail, processIndex, displayedStepLabel)
      }
    }));
    setError("");
  };

  const downloadTemplateDraft = async (title: string, body: string, format: DocumentExportFormat) => {
    try {
      const blob = await api.exportDocumentTemplate({ title, body, fileName: sanitizeFileStem(title), format });
      downloadBlob(blob, `${sanitizeFileStem(title)}.${format}`);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export the template document");
    }
  };

  const restoreTemplateDraftRevision = async (draft: TemplateDraft, revisionId: string) => {
    if (!selectedHospitalId || role === "auditor") return;
    try {
      setLoading(true);
      await api.restoreTemplateDraftRevision(selectedHospitalId, draft.standardCode, draft.id, revisionId, role, userName);
      await refreshStandardData(selectedHospitalId, draft.standardCode);
      setNotice("Template draft version restored.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restore the template draft version");
    } finally {
      setLoading(false);
    }
  };

  const deleteSavedTemplateDraft = async (draft: TemplateDraft) => {
    if (!selectedHospitalId || role === "auditor") return;
    try {
      setLoading(true);
      await api.deleteTemplateDraft(selectedHospitalId, draft.standardCode, draft.id, role, userName);
      await refreshStandardData(selectedHospitalId, draft.standardCode);
      await refreshVisibleOperationsData(selectedHospitalId);
      setNotice("Saved template draft deleted.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete the saved template draft");
    } finally {
      setLoading(false);
    }
  };

  const renderTemplateDraftHistory = (draft?: TemplateDraft) => {
    if (!draft || draft.revisionHistory.length === 0) return null;
    return (
      <div className="list-compact">
        {draft.revisionHistory.map((revision: TemplateDraftRevision) => (
          <div key={revision.id} className="audit-item">
            <div className="audit-row"><strong>Previous version</strong><span>{new Date(revision.savedAt).toLocaleString()}</span></div>
            <div className="muted">Saved by {revision.savedBy}</div>
            <div className="button-row">
              <button type="button" disabled={role === "auditor"} onClick={() => restoreTemplateDraftRevision(draft, revision.id)}>Restore Version</button>
              <button type="button" onClick={() => downloadTemplateDraft(revision.title, revision.body, "docx")}>Download .docx</button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const saveStandardEvidenceDraft = async () => {
    if (!detail || !selectedHospitalId || !standardEvidenceDraft || role === "auditor") return;
    if (!standardEvidenceDraft.body.trim()) {
      setError("Standard template content cannot be blank.");
      return;
    }

    try {
      setLoading(true);
      await api.saveTemplateDraft(selectedHospitalId, detail.standard.code, role, userName, {
        kind: "standard-evidence",
        title: standardEvidenceDraft.title.trim() || `${detail.standard.code} ${detail.standard.name} Working Evidence`,
        body: standardEvidenceDraft.body.trim()
      });
      await refreshStandardData(selectedHospitalId, detail.standard.code);
      setNotice("Standard template draft saved.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save the standard template draft");
    } finally {
      setLoading(false);
    }
  };

  const saveStandardEvidenceTemplate = async () => {
    if (!detail || !selectedHospitalId || !standardEvidenceDraft || role === "auditor") return;
    if (!standardEvidenceDraft.body.trim()) {
      setError("Standard template content cannot be blank.");
      return;
    }

    try {
      setLoading(true);
      const file = await createExportedTemplateFile(standardEvidenceDraft.title, standardEvidenceDraft.body, "docx");
      await api.uploadEvidence(selectedHospitalId, detail.standard.code, role, userName, file);
      await refreshStandardData(selectedHospitalId, detail.standard.code);
      await refreshVisibleOperationsData(selectedHospitalId);
      setNotice("Standard template saved to the standard file list.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save the standard template");
    } finally {
      setLoading(false);
    }
  };

  const saveProcessTemplateEditor = async (processIndex: number) => {
    if (!detail || !selectedHospitalId || role === "auditor") return;
    const draft = processTemplateDrafts[processIndex];
    if (!draft) return;
    if (!draft.body.trim()) {
      setError("Process step template content cannot be blank.");
      return;
    }

    try {
      setLoading(true);
      await api.saveTemplateDraft(selectedHospitalId, detail.standard.code, role, userName, {
        kind: "process-step",
        processIndex,
        title: draft.title.trim() || `${detail.standard.code} Step ${processIndex + 1} ${detail.standard.name}`,
        body: draft.body.trim()
      });
      await refreshStandardData(selectedHospitalId, detail.standard.code);
      setNotice(`Step ${processIndex + 1} template draft saved.`);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save the process template draft");
    } finally {
      setLoading(false);
    }
  };

  const saveProcessTemplateDraft = async (processIndex: number) => {
    if (!detail || !selectedHospitalId || role === "auditor") return;
    const draft = processTemplateDrafts[processIndex];
    if (!draft) return;
    if (!draft.body.trim()) {
      setError("Process step template content cannot be blank.");
      return;
    }

    try {
      setLoading(true);
      const file = await createExportedTemplateFile(draft.title, draft.body, "docx");
      await api.uploadProcessDoc(selectedHospitalId, detail.standard.code, role, userName, processIndex, file);
      await refreshStandardData(selectedHospitalId, detail.standard.code);
      await refreshVisibleOperationsData(selectedHospitalId);
      setNotice(`Step ${processIndex + 1} template saved to the process file list.`);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save the process template");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="top-bar-brand">
          <h1>Standards Workplace</h1>
          <details className="framework-picker">
            <summary>Frameworks: {formatSelectedFrameworks(selectedFrameworks)}</summary>
            <div className="framework-picker-menu">
              {frameworkOptions.map((framework) => (
                <label key={framework} className="framework-option-row">
                  <input
                    type="checkbox"
                    checked={selectedFrameworks.includes(framework)}
                    onChange={() => setSelectedFrameworks((current) => current.includes(framework)
                      ? current.filter((item) => item !== framework)
                      : [...current, framework])}
                  />
                  <span>{framework}</span>
                </label>
              ))}
            </div>
          </details>
        </div>
        <div className="top-bar-controls">
          <button
            className={`toolbar-button analyzer-nav-btn${showAnalyzer ? " analyzer-nav-active" : ""}`}
            type="button"
            onClick={() => setShowAnalyzer((v) => !v)}
          >
            {showAnalyzer ? "← Standards" : "Analyzer ◆"}
          </button>
          <button className="toolbar-button" type="button" onClick={() => setOperationsOpen((current) => !current)}>
            {operationsOpen ? "Close Operations" : "Open Operations"}
          </button>
          <div className="identity-panel">
          <label>
            User Name
            <input value={userName} onChange={(e) => setUserName(e.target.value)} />
          </label>
          <label>
            Role
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
              {userRoles.map((entry) => (
                <option key={entry} value={entry}>{entry}</option>
              ))}
            </select>
          </label>
          <label>
            Hospital
            <select value={selectedHospitalId} onChange={(e) => { setSelectedHospitalId(e.target.value); setSelectedStandardCode(""); }}>
              {hospitals.map((hospital) => (
                <option key={hospital.id} value={hospital.id}>{hospital.name}</option>
              ))}
            </select>
          </label>
          </div>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="notice-banner">{notice}</div>}

      {showAnalyzer ? (
        <AnalyzerPage />
      ) : (
      <main className="layout-grid">
        <aside className="card standards-panel">
          <h2>Standards</h2>
          <p className="muted">Showing standards and quality metrics for: {formatSelectedFrameworks(selectedFrameworks)}.</p>
          <div className="standards-list">
            {filteredStandards.map((item) => (
              <button
                key={item.code}
                className={`standard-item ${item.code === selectedStandardCode ? "selected" : ""}`}
                onClick={() => setSelectedStandardCode(item.code)}
              >
                <div className="standard-top-row">
                  <span className="standard-code">{item.code}</span>
                  <span className={`pill ${item.meets ? "pill-good" : "pill-warn"}`}>{item.compliancePercent}%</span>
                </div>
                <strong>{item.name}</strong>
                <div className="standard-meta">
                  <span>{item.category}</span>
                  <span>{item.framework}</span>
                </div>
                <div className="standard-meta">
                  <span>Tasks: {item.assignmentCount}</span>
                  <span>Uploads: {item.uploadCount}</span>
                </div>
              </button>
            ))}
            {filteredStandards.length === 0 && <div className="empty-state">No standards match the selected frameworks.</div>}
          </div>
          <div className="standards-footer">
            <p className="muted">CoC standards stay visible when CoC is selected. Additional framework metrics appear inside each standard only when those frameworks are selected.</p>
          </div>
        </aside>

        <section className="card detail-panel" ref={detailPanelRef as React.RefObject<HTMLElement>}>
          {!detail ? (
            <div className="empty-state">Select a standard to begin.</div>
          ) : (
            <>
              <div className="detail-header">
                <div>
                  <h2>{detail.standard.code} {detail.standard.name}</h2>
                  <p>{detail.standard.description}</p>
                  {usesOncoLensFeatures(detail.standard.code) && (
                    <div className="oncolens-banner">Use OncoLens features for this standard.</div>
                  )}
                  {detail.standard.retired && <p className="muted"><strong>Retired standard:</strong> pre-marked as N/A.</p>}
                  <p className="reference-note"><strong>Reference:</strong> {detail.standard.referenceNote}</p>
                </div>
                <div className="result-panel">
                  <div>Completed Required Metrics: <strong>{detail.results.numerator}</strong></div>
                  <div>Completed Tracking Items: <strong>{trackedCompletedCount}</strong></div>
                  <div>Tracked Metrics: <strong>{trackedMetricCount}</strong></div>
                  {!isMetricsOnlyStandard(detail.standard.code) && (
                    <div>Denominator: <strong>{detail.results.denominator}</strong></div>
                  )}
                  <div>Compliance: <strong>{detail.results.compliancePercent}%</strong></div>
                  <div>Target: <strong>{detail.standard.threshold.label}</strong></div>
                </div>
              </div>

              <div className="detail-grid">
                <article className="section-card full-width-card standard-start-card">
                  <h3>Start Here: Create Working Template</h3>
                  <p className="muted">{buildEvidenceUploadGuidance(detail.standard.code)}</p>
                  <div className="button-row">
                    <button type="button" disabled={role === "auditor"} onClick={startStandardEvidenceTemplate}>
                      {standardEvidenceDraft ? "Reset Standard Template" : "Start New Standard Template"}
                    </button>
                    <button type="button" disabled={!standardEvidenceDraft || role === "auditor"} onClick={saveStandardEvidenceDraft}>Save Draft</button>
                    <button type="button" disabled={!standardEvidenceDraft} onClick={() => standardEvidenceDraft && downloadTemplateDraft(standardEvidenceDraft.title, standardEvidenceDraft.body, "doc")}>Download .doc</button>
                    <button type="button" disabled={!standardEvidenceDraft} onClick={() => standardEvidenceDraft && downloadTemplateDraft(standardEvidenceDraft.title, standardEvidenceDraft.body, "docx")}>Download .docx</button>
                    <button type="button" className="primary" disabled={!standardEvidenceDraft || role === "auditor"} onClick={saveStandardEvidenceTemplate}>Save To Standard Files</button>
                    <button
                      type="button"
                      disabled={!standardEvidenceSavedDraft || standardMinutesAppendixKeys.has(buildCommitteeAppendixKey({ sourceType: "template-draft", sourceId: standardEvidenceSavedDraft?.id || "" }))}
                      onClick={() => standardEvidenceSavedDraft && queueStandardMinutesAppendix(createTemplateDraftAppendixDraft(standardEvidenceSavedDraft))}
                    >
                      {standardEvidenceSavedDraft && standardMinutesAppendixKeys.has(buildCommitteeAppendixKey({ sourceType: "template-draft", sourceId: standardEvidenceSavedDraft.id })) ? "Added To Minutes" : "Add Saved Draft As Appendix"}
                    </button>
                    <button type="button" disabled={!standardEvidenceSavedDraft || role === "auditor"} onClick={() => standardEvidenceSavedDraft && deleteSavedTemplateDraft(standardEvidenceSavedDraft)}>Delete Saved Draft</button>
                  </div>
                  <p className="muted">{formatSavedDraftNote(standardEvidenceSavedDraft)}</p>
                  {renderTemplateDraftHistory(standardEvidenceSavedDraft)}
                  {standardEvidenceDraft && (
                    <div className="template-editor-panel">
                      <input
                        value={standardEvidenceDraft.title}
                        disabled={role === "auditor"}
                        onChange={(e) => setStandardEvidenceDraft((prev) => prev ? { ...prev, title: e.target.value } : prev)}
                      />
                      <textarea
                        className="template-editor template-editor-compact"
                        value={standardEvidenceDraft.body}
                        disabled={role === "auditor"}
                        onChange={(e) => setStandardEvidenceDraft((prev) => prev ? { ...prev, body: e.target.value } : prev)}
                      />
                    </div>
                  )}
                </article>

                <article className="section-card full-width-card">
                  <h3>Template Coverage</h3>
                  <p className="muted">Saved draft coverage for this standard: {detail.templateCoverage.savedDraftCount}/{detail.templateCoverage.expectedDraftCount} required templates.</p>
                  <div className="list-compact">
                    {detail.templateCoverage.items.map((item) => (
                      <div key={`${item.kind}-${item.processIndex ?? "core"}`} className="audit-item">
                        <div className="audit-row"><strong>{item.label}</strong><span>{item.hasSavedDraft ? "Draft saved" : "Draft missing"}</span></div>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="section-card full-width-card" ref={processSectionRef as React.RefObject<HTMLElement>}>
                  <h3>Hospital Process</h3>
                  <p className="muted">Start by uploading your current tracking document above. Then mark required steps by quarter, store supporting documents, and let admins mark any step as not required for this hospital.</p>
                  <div className="process-steps-list">
                    {detail.standard.hospitalProcess.map((step, idx) => {
                      const key = String(idx);
                      const hidden = !!detail.state.processHiddenSteps?.[key];
                      const qChecks = detail.state.processQuarterChecks?.[key] || {};
                      const stepDocs = (detail.processDocuments || []).filter((d) => d.processIndex === idx);
                      const _pendingFile = processDocFiles[idx];
                      const displayedStepLabel = getDisplayedProcessStepLabel(step, idx);
                      return (
                        <div key={idx} className={`process-step-card ${hidden ? "process-step-hidden" : ""}`}>
                          <div className="process-step-header">
                            <span className="process-step-num">Step {idx + 1}</span>
                            <div className="process-step-title-block">
                              <span className="process-step-text">{displayedStepLabel}</span>
                              {hidden && <span className="process-step-flag">Not Required</span>}
                              {displayedStepLabel !== step && <div className="muted">Guidance: {step}</div>}
                            </div>
                          </div>
                          <p className="muted process-admin-note">
                            {hidden
                              ? "Marked not required for this hospital. Restore the requirement at any time and the previous quarter checks and supporting documents will still be available."
                              : "Program users can mark completed quarters, store supporting documents, or mark this step as not required for this hospital."}
                          </p>
                          <div className="button-row process-step-actions">
                            {role !== "auditor" && (
                              <button
                                type="button"
                                className={hidden ? "primary" : undefined}
                                onClick={() => updateProcessVisibility(idx, !hidden)}
                              >
                                {hidden ? "Restore Requirement" : "Mark Not Required"}
                              </button>
                            )}
                          </div>
                          {hidden ? null : (
                            <>
                              <div className="quarter-checks">
                                {(["Q1", "Q2", "Q3", "Q4"] as const).map((q) => (
                                  <label key={q} className={`quarter-label ${qChecks[q] ? "quarter-done" : ""}`}>
                                    <input
                                      type="checkbox"
                                      checked={!!qChecks[q]}
                                      disabled={role === "auditor"}
                                      onChange={(e) => updateProcessQuarter(idx, q, e.target.checked)}
                                    />
                                    {q}
                                  </label>
                                ))}
                                <span className="muted" style={{ fontSize: "0.75rem" }}>Quarter completion tracking</span>
                              </div>
                              <div className="process-doc-upload process-template-actions">
                                <button type="button" disabled={role === "auditor"} onClick={() => startProcessTemplateDraft(idx, displayedStepLabel)}>
                                  {processTemplateDrafts[idx] ? "Reset Step Template" : "Start New Step Template"}
                                </button>
                                <button type="button" disabled={!processTemplateDrafts[idx] || role === "auditor"} onClick={() => saveProcessTemplateEditor(idx)}>Save Draft</button>
                                <button type="button" disabled={!processTemplateDrafts[idx]} onClick={() => processTemplateDrafts[idx] && downloadTemplateDraft(processTemplateDrafts[idx].title, processTemplateDrafts[idx].body, "doc")}>Download .doc</button>
                                <button type="button" disabled={!processTemplateDrafts[idx]} onClick={() => processTemplateDrafts[idx] && downloadTemplateDraft(processTemplateDrafts[idx].title, processTemplateDrafts[idx].body, "docx")}>Download .docx</button>
                                <button type="button" className="primary" disabled={!processTemplateDrafts[idx] || role === "auditor"} onClick={() => saveProcessTemplateDraft(idx)}>Save Step Document</button>
                                <button
                                  type="button"
                                  disabled={!findSavedTemplateDraft(detail, "process-step", idx) || standardMinutesAppendixKeys.has(buildCommitteeAppendixKey({ sourceType: "template-draft", sourceId: findSavedTemplateDraft(detail, "process-step", idx)?.id || "" }))}
                                  onClick={() => {
                                    const savedDraft = findSavedTemplateDraft(detail, "process-step", idx);
                                    if (savedDraft) queueStandardMinutesAppendix(createTemplateDraftAppendixDraft(savedDraft));
                                  }}
                                >
                                  {(() => {
                                    const savedDraft = findSavedTemplateDraft(detail, "process-step", idx);
                                    return savedDraft && standardMinutesAppendixKeys.has(buildCommitteeAppendixKey({ sourceType: "template-draft", sourceId: savedDraft.id })) ? "Added To Minutes" : "Add Saved Draft As Appendix";
                                  })()}
                                </button>
                                <button type="button" disabled={!findSavedTemplateDraft(detail, "process-step", idx) || role === "auditor"} onClick={() => {
                                  const savedDraft = findSavedTemplateDraft(detail, "process-step", idx);
                                  if (savedDraft) void deleteSavedTemplateDraft(savedDraft);
                                }}>Delete Saved Draft</button>
                              </div>
                              <p className="muted">{formatSavedDraftNote(findSavedTemplateDraft(detail, "process-step", idx))}</p>
                              {renderTemplateDraftHistory(findSavedTemplateDraft(detail, "process-step", idx))}
                              {processTemplateDrafts[idx] && (
                                <div className="template-editor-panel template-editor-panel-step">
                                  <input
                                    value={processTemplateDrafts[idx].title}
                                    disabled={role === "auditor"}
                                    onChange={(e) => setProcessTemplateDrafts((prev) => ({
                                      ...prev,
                                      [idx]: { ...prev[idx], title: e.target.value }
                                    }))}
                                  />
                                  <textarea
                                    className="template-editor template-editor-compact"
                                    value={processTemplateDrafts[idx].body}
                                    disabled={role === "auditor"}
                                    onChange={(e) => setProcessTemplateDrafts((prev) => ({
                                      ...prev,
                                      [idx]: { ...prev[idx], body: e.target.value }
                                    }))}
                                  />
                                </div>
                              )}
                            </>
                          )}
                          {stepDocs.length > 0 && (
                            <div className="process-doc-list">
                              {stepDocs.map((doc) => (
                                <div key={doc.id} className="process-doc-item">
                                  <a href={`http://localhost:4000${doc.filePath}`} target="_blank" rel="noreferrer">{doc.originalName}</a>
                                  <span className="muted">{Math.round(doc.sizeBytes / 1024)} KB  {doc.uploadedBy}</span>
                                  <button
                                    type="button"
                                    disabled={role === "auditor" || standardMinutesAppendixKeys.has(buildCommitteeAppendixKey({ sourceType: "process-document", sourceId: doc.id }))}
                                    onClick={() => queueStandardMinutesAppendix(createCommitteeAppendixDraft(doc, "process-document"))}
                                  >
                                    {standardMinutesAppendixKeys.has(buildCommitteeAppendixKey({ sourceType: "process-document", sourceId: doc.id })) ? "Added To Minutes" : "Add As Appendix"}
                                  </button>
                                  <button className="btn-danger-sm" disabled={role === "auditor"} onClick={() => deleteProcessDoc(doc)}>Remove</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </article>

                {detail.standard.code === committeeRoleStandardCode && (
                  <article className="section-card full-width-card">
                    <h3>Committee Role Roster</h3>
                    <p className="muted">Add individuals with degrees, assign them to required or custom roles, and track the start and end dates for each role assignment.</p>
                    <div className="roster-grid">
                      <div className="section-card roster-subcard">
                        <h4>Individuals</h4>
                        <div className="ops-form role-entry-form">
                          <input
                            placeholder="Full name"
                            value={newCommitteePerson.name}
                            disabled={role === "auditor"}
                            onChange={(e) => setNewCommitteePerson((prev) => ({ ...prev, name: e.target.value }))}
                          />
                          <input
                            placeholder="Degrees / credentials"
                            value={newCommitteePerson.degrees}
                            disabled={role === "auditor"}
                            onChange={(e) => setNewCommitteePerson((prev) => ({ ...prev, degrees: e.target.value }))}
                          />
                          <button disabled={role === "auditor"} onClick={createCommitteePerson}>Add Individual</button>
                        </div>
                        <div className="list-compact role-person-list">
                          {committeePeople.map((person) => (
                            <div key={person.id} className="audit-item">
                              <div className="audit-row"><strong>{person.name}</strong><span>{person.degrees || "No degrees listed"}</span></div>
                              <div className="muted">Updated {new Date(person.updatedAt).toLocaleDateString()}</div>
                            </div>
                          ))}
                          {committeePeople.length === 0 && <div className="empty-state">No committee individuals added yet.</div>}
                        </div>
                      </div>

                      <div className="section-card roster-subcard">
                        <h4>Role Assignments</h4>
                        <div className="ops-form role-entry-form">
                          <input
                            list="committee-role-options"
                            placeholder="Role name"
                            value={newRoleAssignment.roleName}
                            disabled={role === "auditor"}
                            onChange={(e) => setNewRoleAssignment((prev) => ({ ...prev, roleName: e.target.value }))}
                          />
                          <datalist id="committee-role-options">
                            {committeeRoleOptions.map((roleName) => (
                              <option key={roleName} value={roleName} />
                            ))}
                          </datalist>
                          <select
                            value={newRoleAssignment.personId}
                            disabled={role === "auditor"}
                            onChange={(e) => setNewRoleAssignment((prev) => ({ ...prev, personId: e.target.value, personName: "", degrees: "" }))}
                          >
                            <option value="">Add new individual in assignment</option>
                            {committeePeople.map((person) => (
                              <option key={person.id} value={person.id}>{person.name}{person.degrees ? `, ${person.degrees}` : ""}</option>
                            ))}
                          </select>
                          {!newRoleAssignment.personId && (
                            <>
                              <input
                                placeholder="New individual name"
                                value={newRoleAssignment.personName}
                                disabled={role === "auditor"}
                                onChange={(e) => setNewRoleAssignment((prev) => ({ ...prev, personName: e.target.value }))}
                              />
                              <input
                                placeholder="Degrees / credentials"
                                value={newRoleAssignment.degrees}
                                disabled={role === "auditor"}
                                onChange={(e) => setNewRoleAssignment((prev) => ({ ...prev, degrees: e.target.value }))}
                              />
                            </>
                          )}
                          <input
                            type="date"
                            value={newRoleAssignment.startDate}
                            disabled={role === "auditor"}
                            onChange={(e) => setNewRoleAssignment((prev) => ({ ...prev, startDate: e.target.value }))}
                          />
                          <input
                            type="date"
                            value={newRoleAssignment.endDate}
                            disabled={role === "auditor"}
                            onChange={(e) => setNewRoleAssignment((prev) => ({ ...prev, endDate: e.target.value }))}
                          />
                          <button disabled={role === "auditor"} onClick={createRoleAssignment}>Assign Role</button>
                        </div>
                        <textarea
                          placeholder="Optional role assignment notes"
                          value={newRoleAssignment.notes}
                          disabled={role === "auditor"}
                          onChange={(e) => setNewRoleAssignment((prev) => ({ ...prev, notes: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="role-coverage-grid">
                      {detail.roleList.map((roleName) => {
                        const activeAssignments = detail.roleAssignments.filter((assignment) => assignment.roleName === roleName && isCurrentRoleAssignment(assignment));
                        return (
                          <div key={roleName} className="summary-chip">
                            <strong>{roleName}</strong>
                            <span>{activeAssignments.length > 0 ? activeAssignments.map((assignment) => assignment.personName).join(", ") : "Unassigned"}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="list-compact role-assignment-list">
                      {detail.roleAssignments.map((assignment) => (
                        <div key={assignment.id} className="audit-item">
                          <div className="audit-row"><strong>{assignment.roleName}</strong><span>{isCurrentRoleAssignment(assignment) ? "Active" : "Ended"}</span></div>
                          <div>{assignment.personName}{assignment.degrees ? `, ${assignment.degrees}` : ""}</div>
                          <div className="muted">{assignment.startDate} {assignment.endDate ? `to ${assignment.endDate}` : "to present"}</div>
                          {assignment.notes && <div className="muted">{assignment.notes}</div>}
                          <div className="button-row">
                            <button
                              disabled={role === "auditor" || Boolean(assignment.endDate)}
                              onClick={() => updateRoleAssignmentEndDate(assignment, new Date().toISOString().slice(0, 10))}
                            >End Today</button>
                            <button
                              disabled={role === "auditor" || !assignment.endDate}
                              onClick={() => updateRoleAssignmentEndDate(assignment, "")}
                            >Clear End Date</button>
                            <button disabled={role === "auditor"} onClick={() => deleteRoleAssignment(assignment)}>Delete</button>
                          </div>
                        </div>
                      ))}
                      {detail.roleAssignments.length === 0 && <div className="empty-state">No role assignments tracked yet.</div>}
                    </div>
                  </article>
                )}

                <article className="section-card">
                  <h3>Metric Wording (Editable)</h3>
                  <p className="muted">Use program-owned language; do not pre-publish restricted manual text.</p>
                  <p className="muted">{buildMetricWordingGuidance(detail.standard.code)}</p>
                  {role === "auditor" && <p className="muted">Editing is disabled while role is {role}.</p>}
                  <div className="component-list">
                    {editableMetricLabels.map((component, index) => (
                      <div key={`metric-line-${index}`} className="metric-edit-row">
                        <label className="component-item">
                          <input
                            type="checkbox"
                            checked={detail.state.componentsComplete[index] || false}
                            disabled={role === "auditor" || Boolean(detail.standard.retired)}
                            onChange={(e) => updateComponent(index, e.target.checked)}
                          />
                        </label>
                        <input
                          value={component}
                          disabled={role === "auditor" || Boolean(detail.standard.retired)}
                          onFocus={(e) => {
                            if (isDefaultProgramMetricLabel(component)) {
                              e.currentTarget.select();
                            }
                          }}
                          onClick={(e) => {
                            if (isDefaultProgramMetricLabel(component)) {
                              e.currentTarget.select();
                            }
                          }}
                          onChange={(e) => {
                            const next = [...editableMetricLabels];
                            next[index] = e.target.value;
                            setEditableMetricLabels(next);
                          }}
                        />
                        {index >= requiredMetricCount && (
                          <button
                            type="button"
                            disabled={role === "auditor" || Boolean(detail.standard.retired)}
                            onClick={() => removeMetricLabel(index)}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="muted">Program users can revise every required line and add extra tracking lines. Added lines appear in tracking, while official compliance stays tied to the required metric lines for the standard.</p>
                  <div className="button-row">
                    <button onClick={addMetricLabel} disabled={role === "auditor" || Boolean(detail.standard.retired)}>Add Tracking Line</button>
                    <button className="primary" onClick={saveMetricLabels} disabled={role === "auditor"}>Save Metric Wording</button>
                  </div>
                </article>

                <article className="section-card full-width-card">
                  <h3>Committee Appendix Template</h3>
                  <p className="muted">Each standard now gets a built-out appendix draft based on the sections on this page. Edit it here, save it as a Word file, and optionally queue it for the cancer committee minutes.</p>
                  <div className="ops-form committee-form">
                    <input
                      placeholder="Appendix title"
                      value={appendixTemplateTitle}
                      disabled={role === "auditor"}
                      onChange={(e) => setAppendixTemplateTitle(e.target.value)}
                    />
                    <button type="button" onClick={rebuildStandardAppendixTemplate}>Rebuild Template</button>
                    <button type="button" disabled={role === "auditor"} onClick={saveCommitteeAppendixDraft}>Save Draft</button>
                    <button
                      type="button"
                      disabled={!committeeAppendixSavedDraft || standardMinutesAppendixKeys.has(buildCommitteeAppendixKey({ sourceType: "template-draft", sourceId: committeeAppendixSavedDraft?.id || "" }))}
                      onClick={() => committeeAppendixSavedDraft && queueStandardMinutesAppendix(createTemplateDraftAppendixDraft(committeeAppendixSavedDraft))}
                    >
                      {committeeAppendixSavedDraft && standardMinutesAppendixKeys.has(buildCommitteeAppendixKey({ sourceType: "template-draft", sourceId: committeeAppendixSavedDraft.id })) ? "Added To Minutes" : "Add Saved Draft As Appendix"}
                    </button>
                    <button type="button" disabled={!committeeAppendixSavedDraft || role === "auditor"} onClick={() => committeeAppendixSavedDraft && deleteSavedTemplateDraft(committeeAppendixSavedDraft)}>Delete Saved Draft</button>
                    <button type="button" disabled={role === "auditor"} onClick={() => saveStandardAppendixTemplate(false)}>Save Word File</button>
                    <button type="button" className="primary" disabled={role === "auditor"} onClick={() => saveStandardAppendixTemplate(true)}>Save Word File + Add To Minutes</button>
                  </div>
                  <p className="muted">{formatSavedDraftNote(committeeAppendixSavedDraft)}</p>
                  {renderTemplateDraftHistory(committeeAppendixSavedDraft)}
                  <textarea
                    className="template-editor"
                    placeholder="Editable appendix template"
                    value={appendixTemplateBody}
                    disabled={role === "auditor"}
                    onChange={(e) => setAppendixTemplateBody(e.target.value)}
                  />
                </article>

                <article className="section-card full-width-card">
                  <h3>Add To Cancer Committee Minutes</h3>
                  <p className="muted">Create the minutes entry for this standard, then use the appendix buttons in the process and uploads sections on this page to move supporting files into the appendix list with an explanation.</p>
                  <div className="ops-form committee-form">
                    <input placeholder="Minutes title" value={standardMinutesEntry.title} disabled={role === "auditor"} onChange={(e) => setStandardMinutesEntry((prev) => ({ ...prev, title: e.target.value }))} />
                    <input type="date" value={standardMinutesEntry.meetingDate} disabled={role === "auditor"} onChange={(e) => setStandardMinutesEntry((prev) => ({ ...prev, meetingDate: e.target.value }))} />
                    <select value={standardMinutesEntry.quarter} disabled={role === "auditor"} onChange={(e) => setStandardMinutesEntry((prev) => ({ ...prev, quarter: e.target.value as CommitteeMeeting["quarter"] }))}>
                      <option value="Q1">Q1</option>
                      <option value="Q2">Q2</option>
                      <option value="Q3">Q3</option>
                      <option value="Q4">Q4</option>
                    </select>
                    <input placeholder="Presenter / owner" value={standardMinutesEntry.presenter} disabled={role === "auditor"} onChange={(e) => setStandardMinutesEntry((prev) => ({ ...prev, presenter: e.target.value }))} />
                    <button disabled={role === "auditor"} onClick={createStandardCommitteeMeeting}>Add This Standard To Minutes</button>
                  </div>
                  <textarea placeholder="Agenda summary or action-item notes" value={standardMinutesEntry.notes} disabled={role === "auditor"} onChange={(e) => setStandardMinutesEntry((prev) => ({ ...prev, notes: e.target.value }))} />
                  <textarea placeholder="Formal minutes text" value={standardMinutesEntry.minutes} disabled={role === "auditor"} onChange={(e) => setStandardMinutesEntry((prev) => ({ ...prev, minutes: e.target.value }))} />
                  {standardMinutesEntry.appendices.length > 0 && (
                    <div className="selection-panel">
                      <strong>Appendices queued for these minutes</strong>
                      <div className="appendix-draft-list">
                        {standardMinutesEntry.appendices.map((appendix) => (
                          <div key={buildCommitteeAppendixKey(appendix)} className="appendix-draft-item">
                            <div className="audit-row"><strong>{appendix.label}</strong><span>{appendix.processIndex !== null ? `Step ${appendix.processIndex + 1}` : "Standard upload"}</span></div>
                            <textarea
                              placeholder="Explain why this file belongs in the appendix"
                              value={appendix.explanation}
                              disabled={role === "auditor"}
                              onChange={(e) => updateStandardMinutesAppendixExplanation(appendix, e.target.value)}
                            />
                            <div className="button-row">
                              {appendix.sourceType === "template-draft" ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={!detail.templateDrafts.some((item) => item.id === appendix.sourceId)}
                                    onClick={() => {
                                      const savedDraft = detail.templateDrafts.find((item) => item.id === appendix.sourceId);
                                      if (savedDraft) void downloadTemplateDraft(savedDraft.title, savedDraft.body, "doc");
                                    }}
                                  >Download .doc</button>
                                  <button
                                    type="button"
                                    disabled={!detail.templateDrafts.some((item) => item.id === appendix.sourceId)}
                                    onClick={() => {
                                      const savedDraft = detail.templateDrafts.find((item) => item.id === appendix.sourceId);
                                      if (savedDraft) void downloadTemplateDraft(savedDraft.title, savedDraft.body, "docx");
                                    }}
                                  >Download .docx</button>
                                </>
                              ) : (
                                <a href={`http://localhost:4000${appendix.filePath}`} target="_blank" rel="noreferrer">Open file</a>
                              )}
                              <button type="button" disabled={role === "auditor"} onClick={() => removeStandardMinutesAppendix(appendix)}>Remove Appendix</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {detail.uploads.length > 0 && (
                    <div className="selection-panel">
                      <strong>Link uploaded files from this standard</strong>
                      <div className="list-compact roster-reference-list">
                        {detail.uploads.map((item) => (
                          <label key={item.id} className={`selection-row ${standardMinutesEntry.referencedUploadIds.includes(item.id) ? "selection-row-active" : ""}`}>
                            <input
                              type="checkbox"
                              checked={standardMinutesEntry.referencedUploadIds.includes(item.id)}
                              disabled={role === "auditor"}
                              onChange={(e) => setStandardMinutesEntry((prev) => ({
                                ...prev,
                                referencedUploadIds: e.target.checked
                                  ? [...prev.referencedUploadIds, item.id]
                                  : prev.referencedUploadIds.filter((entry) => entry !== item.id)
                              }))}
                            />
                            <span>{item.originalName}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </article>

                {!isMetricsOnlyStandard(detail.standard.code) && (
                  <article className="section-card">
                    <h3>Denominator</h3>
                    <p>{detail.standard.denominator.label}</p>
                    {detail.standard.denominator.mode === "fixed" ? (
                      <div className="readonly-box">Fixed at {detail.standard.denominator.defaultValue}</div>
                    ) : (
                      <input
                        className="number-input"
                        type="number"
                        min={0}
                        value={detail.state.denominatorValue}
                        disabled={role === "auditor"}
                        onChange={(e) => updateDenominator(Number(e.target.value))}
                      />
                    )}
                  </article>
                )}

                <article className="section-card full-width-card">
                  <h3>Selected Quality Metrics</h3>
                  <p className="muted">Framework suggestions and custom metrics now follow the framework picker above.</p>
                  <p className="muted">Active frameworks: {formatSelectedFrameworks(selectedFrameworks)}</p>
                  <div className="list-compact">
                    {visibleQualityMetricTemplates.map((tpl, idx) => (
                      <div key={`${tpl.framework}-${idx}`} className="audit-item">
                        <div className="audit-row"><strong>{tpl.framework}</strong><span>Template</span></div>
                        <div>{tpl.title}</div>
                        <div className="muted">{tpl.description}</div>
                        <div className="muted">Target: {tpl.target}</div>
                        <button disabled={role === "auditor"} onClick={() => quickAddTemplate(tpl)}>Add To Program Metrics</button>
                      </div>
                    ))}
                    {visibleQualityMetricTemplates.length === 0 && <div className="empty-state">No framework templates are available for the selected frameworks on this standard.</div>}
                  </div>

                  <div className="assignment-form">
                    <select
                      value={newCustomMetric.framework}
                      disabled={role === "auditor" || selectableCustomMetricFrameworks.length === 0}
                      onChange={(e) => setNewCustomMetric((p) => ({ ...p, framework: e.target.value as AccreditationFramework }))}
                    >
                      {selectableCustomMetricFrameworks.map((framework) => (
                        <option key={framework} value={framework}>{framework}</option>
                      ))}
                    </select>
                    <input
                      placeholder="Metric title"
                      value={newCustomMetric.title}
                      disabled={role === "auditor"}
                      onChange={(e) => setNewCustomMetric((p) => ({ ...p, title: e.target.value }))}
                    />
                    <input
                      placeholder="Target (e.g., >=90%)"
                      value={newCustomMetric.target}
                      disabled={role === "auditor"}
                      onChange={(e) => setNewCustomMetric((p) => ({ ...p, target: e.target.value }))}
                    />
                    <button disabled={role === "auditor" || selectableCustomMetricFrameworks.length === 0} onClick={() => createCustomMetric(newCustomMetric)}>Create Metric</button>
                  </div>
                  <textarea
                    placeholder="Optional metric description"
                    value={newCustomMetric.description}
                    disabled={role === "auditor"}
                    onChange={(e) => setNewCustomMetric((p) => ({ ...p, description: e.target.value }))}
                  />

                  <div className="list-compact">
                    {visibleCustomQualityMetrics.map((item) => (
                      <div key={item.id} className="audit-item">
                        <div className="audit-row"><strong>{item.framework}: {item.title}</strong><span>{item.status}</span></div>
                        <div className="muted">Target: {item.target}</div>
                        {item.description && <div className="muted">{item.description}</div>}
                        <div className="button-row">
                          <button disabled={role === "auditor"} onClick={() => setCustomMetricStatus(item, "active")}>Active</button>
                          <button disabled={role === "auditor"} onClick={() => setCustomMetricStatus(item, "met")}>Mark Met</button>
                          <button disabled={role === "auditor"} onClick={() => setCustomMetricStatus(item, "needs-review")}>Needs Review</button>
                          <button disabled={role === "auditor"} onClick={() => setCustomMetricStatus(item, "paused")}>Pause</button>
                          <button disabled={role === "auditor"} onClick={() => deleteCustomMetric(item)}>Delete</button>
                        </div>
                      </div>
                    ))}
                    {visibleCustomQualityMetrics.length === 0 && <div className="empty-state">No custom quality metrics match the selected frameworks yet.</div>}
                  </div>
                </article>

                <article className="section-card">
                  <h3>Additional Evidence Templates</h3>
                  <p className="muted">Use the working template above to create and save authored standard documents. Saved documents appear below and can still be added to the cancer committee appendix.</p>
                  <div className="button-row">
                    <button type="button" disabled={role === "auditor"} onClick={startStandardEvidenceTemplate}>
                      {standardEvidenceDraft ? "Continue Standard Template" : "Start New Supporting Template"}
                    </button>
                    <button type="button" disabled={!standardEvidenceDraft || role === "auditor"} onClick={saveStandardEvidenceDraft}>Save Draft</button>
                    <button type="button" disabled={!standardEvidenceDraft} onClick={() => standardEvidenceDraft && downloadTemplateDraft(standardEvidenceDraft.title, standardEvidenceDraft.body, "doc")}>Download .doc</button>
                    <button type="button" disabled={!standardEvidenceDraft} onClick={() => standardEvidenceDraft && downloadTemplateDraft(standardEvidenceDraft.title, standardEvidenceDraft.body, "docx")}>Download .docx</button>
                    <button type="button" className="primary" disabled={!standardEvidenceDraft || role === "auditor"} onClick={saveStandardEvidenceTemplate}>Save To Standard Files</button>
                  </div>
                  <p className="muted">{formatSavedDraftNote(findSavedTemplateDraft(detail, "standard-evidence"))}</p>
                  <div className="list-compact">
                    {detail.uploads.map((item) => (
                      <div key={item.id} className="audit-item">
                        <div className="audit-row"><strong>{item.originalName}</strong><span>{Math.round(item.sizeBytes / 1024)} KB</span></div>
                        <div className="muted">Uploaded by {item.uploadedBy} at {new Date(item.uploadedAt).toLocaleString()}</div>
                        <div className="button-row evidence-actions-row">
                          <a href={`http://localhost:4000${item.filePath}`} target="_blank" rel="noreferrer">Open file</a>
                          <button
                            type="button"
                            disabled={role === "auditor" || standardMinutesAppendixKeys.has(buildCommitteeAppendixKey({ sourceType: "upload", sourceId: item.id }))}
                            onClick={() => queueStandardMinutesAppendix(createCommitteeAppendixDraft(item, "upload"))}
                          >
                            {standardMinutesAppendixKeys.has(buildCommitteeAppendixKey({ sourceType: "upload", sourceId: item.id })) ? "Added To Minutes" : "Add As Appendix"}
                          </button>
                        </div>
                      </div>
                    ))}
                    {detail.uploads.length === 0 && <div className="empty-state">No uploads yet.</div>}
                  </div>
                </article>


                <article className="section-card full-width-card">
                  <h3>Assignments</h3>
                  <p className="muted">Assign metric work items to staff with due dates.</p>
                  <div className="assignment-form">
                    <input
                      placeholder="Component label"
                      value={newAssignment.componentLabel}
                      disabled={role === "auditor"}
                      onChange={(e) => setNewAssignment((prev) => ({ ...prev, componentLabel: e.target.value }))}
                    />
                    <input
                      placeholder="Assignee"
                      value={newAssignment.assignee}
                      disabled={role === "auditor"}
                      onChange={(e) => setNewAssignment((prev) => ({ ...prev, assignee: e.target.value }))}
                    />
                    <input
                      type="date"
                      value={newAssignment.dueDate}
                      disabled={role === "auditor"}
                      onChange={(e) => setNewAssignment((prev) => ({ ...prev, dueDate: e.target.value }))}
                    />
                    <button onClick={createAssignment} disabled={role === "auditor"}>Create Assignment</button>
                  </div>
                  <div className="list-compact">
                    {detail.assignments.map((item) => (
                      <div key={item.id} className="audit-item">
                        <div className="audit-row"><strong>{item.componentLabel}</strong><span>{item.status}</span></div>
                        <div>Assignee: {item.assignee}</div>
                        <div className="muted">Due {item.dueDate}</div>
                        <button onClick={() => toggleAssignment(item)} disabled={role === "auditor"}>Mark {item.status === "open" ? "Done" : "Open"}</button>
                      </div>
                    ))}
                    {detail.assignments.length === 0 && <div className="empty-state">No assignments yet.</div>}
                  </div>
                </article>
              </div>
            </>
          )}
        </section>

        {operationsOpen && (
          <div className="drawer-overlay" onClick={() => setOperationsOpen(false)}>
            <aside className="card audit-panel drawer-panel" onClick={(e) => e.stopPropagation()}>
              <div className="drawer-header">
                <div>
                  <h2>Operations</h2>
                  <p className="muted">Program operations, supporting materials, and recent activity stay here. Open this workspace only when needed.</p>
                </div>
                <button type="button" onClick={() => setOperationsOpen(false)}>Close</button>
              </div>
          <div className="ops-panel">
            <h3>PRQ / Site review strategy room</h3>
            <p className="muted">Track pre-review questionnaire items, evidence gaps, policy requests, and site-review strategy deliverables with owners and due dates.</p>
            <div className="ops-form">
              <select value={newPrqItem.category} disabled={role === "auditor"} onChange={(e) => setNewPrqItem((prev) => ({ ...prev, category: e.target.value as PrqWarRoomItem["category"] }))}>
                <option value="PRQ">PRQ</option>
                <option value="Site Review">Site Review</option>
                <option value="Evidence">Evidence</option>
                <option value="Policy">Policy</option>
                <option value="Other">Other</option>
              </select>
              <input placeholder="Deliverable title" value={newPrqItem.title} disabled={role === "auditor"} onChange={(e) => setNewPrqItem((prev) => ({ ...prev, title: e.target.value }))} />
              <input placeholder="Owner" value={newPrqItem.owner} disabled={role === "auditor"} onChange={(e) => setNewPrqItem((prev) => ({ ...prev, owner: e.target.value }))} />
              <input type="date" value={newPrqItem.dueDate} disabled={role === "auditor"} onChange={(e) => setNewPrqItem((prev) => ({ ...prev, dueDate: e.target.value }))} />
              <button disabled={role === "auditor" || !!prqItemValidationMessage} onClick={createPrqWarRoomItem} title={prqItemValidationMessage || "Add strategy item"}>Add Item</button>
            </div>
            {role !== "auditor" && prqItemValidationMessage && <div className="inline-validation">{prqItemValidationMessage}</div>}
            <textarea placeholder="Notes / missing evidence / blocker details" value={newPrqItem.notes} disabled={role === "auditor"} onChange={(e) => setNewPrqItem((prev) => ({ ...prev, notes: e.target.value }))} />
            <div className="list-compact ops-list">
              {prqWarRoomItems.map((item) => (
                <div key={item.id} className="audit-item">
                  <div className="audit-row"><strong>{item.category}: {item.title}</strong><span>{item.status}</span></div>
                  <div>Owner: {item.owner}</div>
                  <div className="muted">Due {item.dueDate}</div>
                  {item.notes && <div className="muted">{item.notes}</div>}
                  <div className="button-row">
                    <button disabled={role === "auditor"} onClick={() => setPrqWarRoomItemStatus(item, "not-started")}>Not Started</button>
                    <button disabled={role === "auditor"} onClick={() => setPrqWarRoomItemStatus(item, "collecting")}>Collecting</button>
                    <button disabled={role === "auditor"} onClick={() => setPrqWarRoomItemStatus(item, "ready")}>Ready</button>
                    <button disabled={role === "auditor"} onClick={() => setPrqWarRoomItemStatus(item, "blocked")}>Blocked</button>
                    <button disabled={role === "auditor"} onClick={() => deletePrqWarRoomItem(item.id)}>Delete</button>
                  </div>
                </div>
              ))}
              {prqWarRoomItems.length === 0 && <div className="empty-state">No PRQ or site review strategy items yet.</div>}
            </div>
          </div>

          <div className="ops-panel">
            <h3>Cancer Committee Minutes</h3>
            <p className="muted">Create committee minutes entries, tag the standards discussed, and attach the current 2.1 role holders with their tracked start and end dates.</p>
            <div className="ops-form committee-form">
              <input placeholder="Meeting title" value={newCommitteeMeeting.title} disabled={role === "auditor"} onChange={(e) => setNewCommitteeMeeting((prev) => ({ ...prev, title: e.target.value }))} />
              <input type="date" value={newCommitteeMeeting.meetingDate} disabled={role === "auditor"} onChange={(e) => setNewCommitteeMeeting((prev) => ({ ...prev, meetingDate: e.target.value }))} />
              <select value={newCommitteeMeeting.quarter} disabled={role === "auditor"} onChange={(e) => setNewCommitteeMeeting((prev) => ({ ...prev, quarter: e.target.value as CommitteeMeeting["quarter"] }))}>
                <option value="Q1">Q1</option>
                <option value="Q2">Q2</option>
                <option value="Q3">Q3</option>
                <option value="Q4">Q4</option>
              </select>
              <input placeholder="Presenter / CLP lead" value={newCommitteeMeeting.presenter} disabled={role === "auditor"} onChange={(e) => setNewCommitteeMeeting((prev) => ({ ...prev, presenter: e.target.value }))} />
              <input type="number" min={0} placeholder="Conference cases" value={newCommitteeMeeting.conferenceCaseCount} disabled={role === "auditor"} onChange={(e) => setNewCommitteeMeeting((prev) => ({ ...prev, conferenceCaseCount: Number(e.target.value) || 0 }))} />
              <button disabled={role === "auditor"} onClick={createCommitteeMeeting}>Add Minutes</button>
            </div>
            <textarea placeholder="Agenda summary or action-item notes" value={newCommitteeMeeting.notes} disabled={role === "auditor"} onChange={(e) => setNewCommitteeMeeting((prev) => ({ ...prev, notes: e.target.value }))} />
            <textarea placeholder="Formal minutes text" value={newCommitteeMeeting.minutes} disabled={role === "auditor"} onChange={(e) => setNewCommitteeMeeting((prev) => ({ ...prev, minutes: e.target.value }))} />
            <div className="selection-panel">
              <strong>Standards in these minutes</strong>
              <div className="tag-grid">
                {standards.map((standard) => (
                  <label key={standard.code} className={`selection-chip ${newCommitteeMeeting.standardCodes.includes(standard.code) ? "selection-chip-active" : ""}`}>
                    <input
                      type="checkbox"
                      checked={newCommitteeMeeting.standardCodes.includes(standard.code)}
                      disabled={role === "auditor"}
                      onChange={(e) => setNewCommitteeMeeting((prev) => ({
                        ...prev,
                        standardCodes: e.target.checked
                          ? [...prev.standardCodes, standard.code]
                          : prev.standardCodes.filter((code) => code !== standard.code),
                        referencedRoleAssignmentIds: e.target.checked || standard.code !== committeeRoleStandardCode
                          ? prev.referencedRoleAssignmentIds
                          : []
                      }))}
                    />
                    {standard.code}
                  </label>
                ))}
              </div>
            </div>
            {newCommitteeMeeting.standardCodes.includes(committeeRoleStandardCode) && (
              <div className="selection-panel">
                <strong>Standard 2.1 roles referenced in these minutes</strong>
                <div className="list-compact roster-reference-list">
                  {committeeMinuteRoleAssignments.map((assignment) => (
                    <label key={assignment.id} className={`selection-row ${newCommitteeMeeting.referencedRoleAssignmentIds.includes(assignment.id) ? "selection-row-active" : ""}`}>
                      <input
                        type="checkbox"
                        checked={newCommitteeMeeting.referencedRoleAssignmentIds.includes(assignment.id)}
                        disabled={role === "auditor"}
                        onChange={(e) => setNewCommitteeMeeting((prev) => ({
                          ...prev,
                          referencedRoleAssignmentIds: e.target.checked
                            ? [...prev.referencedRoleAssignmentIds, assignment.id]
                            : prev.referencedRoleAssignmentIds.filter((entry) => entry !== assignment.id)
                        }))}
                      />
                      <span>{assignment.roleName}: {assignment.personName}{assignment.degrees ? `, ${assignment.degrees}` : ""} ({assignment.startDate}{assignment.endDate ? ` to ${assignment.endDate}` : " to present"})</span>
                    </label>
                  ))}
                  {committeeMinuteRoleAssignments.length === 0 && <div className="empty-state">No standard 2.1 role assignments are available yet.</div>}
                </div>
              </div>
            )}
            <div className="list-compact ops-list">
              {committeeMeetings.map((item) => {
                const referencedAssignments = committeeRoleData.assignments.filter((assignment) => item.referencedRoleAssignmentIds.includes(assignment.id));
                return (
                  <div key={item.id} className="audit-item">
                    <div className="audit-row"><strong>{item.quarter}: {item.title}</strong><span>{item.status}</span></div>
                    <div>{item.meetingDate}</div>
                    {item.presenter && <div className="muted">Presenter: {item.presenter}</div>}
                    <div className="muted">Conference cases: {item.conferenceCaseCount} | OncoLens assist: {item.oncoLensAssist ? "Yes" : "No"}</div>
                    {item.standardCodes.length > 0 && <div className="muted">Standards: {item.standardCodes.join(", ")}</div>}
                    {item.minutes && <div className="muted">Minutes: {item.minutes}</div>}
                    {item.notes && <div className="muted">Notes: {item.notes}</div>}
                    {item.referencedUploadIds.length > 0 && <div className="muted">Linked evidence files: {item.referencedUploadIds.length}</div>}
                    {item.appendices.length > 0 && <div className="muted">Appendices: {item.appendices.map((appendix) => `${appendix.sourceType === "template-draft" ? "Saved draft" : "File"}: ${appendix.originalName}`).join("; ")}</div>}
                    {referencedAssignments.length > 0 && (
                      <div className="muted">Roles: {referencedAssignments.map((assignment) => `${assignment.roleName} - ${assignment.personName}`).join("; ")}</div>
                    )}
                    <div className="button-row">
                      <button disabled={role === "auditor"} onClick={() => setCommitteeMeetingStatus(item, "agenda-ready")}>Agenda Ready</button>
                      <button disabled={role === "auditor"} onClick={() => setCommitteeMeetingStatus(item, "held")}>Held</button>
                      <button disabled={role === "auditor"} onClick={() => setCommitteeMeetingStatus(item, "minutes-uploaded")}>Minutes Uploaded</button>
                      <button disabled={role === "auditor"} onClick={() => setCommitteeMeetingStatus(item, "closed")}>Closed</button>
                      <button disabled={role === "auditor"} onClick={() => deleteCommitteeMeeting(item.id)}>Delete</button>
                    </div>
                  </div>
                );
              })}
              {committeeMeetings.length === 0 && <div className="empty-state">No committee minutes entries yet.</div>}
            </div>
          </div>

          <div className="ops-panel">
            <h3>Registry Dashboard</h3>
            <p className="muted">{registryDashboard?.oncoLensAssistNote ?? "OncoLens automation assists with conference workflow coordination and registry dashboard readiness tracking."}</p>
            {registryDashboard ? (
              <>
              <div className="ops-summary-grid">
                <div className="summary-chip"><strong>Total Standards</strong><span>{registryDashboard.totalStandards}</span></div>
                <div className="summary-chip"><strong>Ready for Admin</strong><span>{registryDashboard.readyForAdminStandards}</span></div>
                <div className="summary-chip"><strong>Open Assignments</strong><span>{registryDashboard.openAssignments}</span></div>
                <div className="summary-chip"><strong>No Uploads Yet</strong><span>{registryDashboard.standardsWithoutUploads}</span></div>
                <div className="summary-chip"><strong>Registry Metrics</strong><span>{registryDashboard.registryMetricCount}</span></div>
                <div className="summary-chip"><strong>Template Drafts</strong><span>{registryDashboard.templateDraftsSaved}/{registryDashboard.templateDraftsExpected}</span></div>
                <div className="summary-chip"><strong>Standards Missing Templates</strong><span>{registryDashboard.standardsWithMissingTemplates}</span></div>
                <div className="summary-chip"><strong>Meetings Planned</strong><span>{registryDashboard.committeeMeetingsPlanned}</span></div>
                <div className="summary-chip"><strong>Meetings Completed</strong><span>{registryDashboard.committeeMeetingsCompleted}</span></div>
              </div>
              <div className="list-compact ops-list">
                {registryDashboard.templateCoverageByStandard.filter((item) => item.missingDraftCount > 0).map((item) => (
                  <div key={item.standardCode} className="audit-item">
                    <div className="audit-row"><strong>{item.standardCode} {item.standardName}</strong><span>{item.savedDraftCount}/{item.expectedDraftCount} saved</span></div>
                    <div className="muted">Missing: {item.missingItems.join("; ")}</div>
                  </div>
                ))}
                {registryDashboard.templateCoverageByStandard.every((item) => item.missingDraftCount === 0) && (
                  <div className="empty-state">All standards currently have their required saved template drafts.</div>
                )}
              </div>
              </>
            ) : (
              <div className="empty-state">Registry dashboard is loading.</div>
            )}
          </div>

          <div className="quality-source-panel">
            <h3>Quality Metric Source Library</h3>
            <p className="muted">Hospital users can upload licensed ACS, ASCO, ASTRO, or internal quality documents for this hospital.</p>
            <div className="quality-source-form">
              <select value={qualityReferenceFramework} disabled={role === "auditor"} onChange={(e) => setQualityReferenceFramework(e.target.value as "ACS" | "ASCO" | "ASTRO" | "Other")}>
                <option value="ACS">ACS</option>
                <option value="ASCO">ASCO</option>
                <option value="ASTRO">ASTRO</option>
                <option value="Other">Other</option>
              </select>
              <input
                placeholder="Document title (optional)"
                value={qualityReferenceTitle}
                disabled={role === "auditor"}
                onChange={(e) => setQualityReferenceTitle(e.target.value)}
              />
              <input
                type="file"
                disabled={role === "auditor"}
                onChange={(e) => setQualityReferenceFile(e.target.files?.[0] || null)}
              />
              <button className="primary" disabled={role === "auditor" || !qualityReferenceFile} onClick={uploadQualityReferenceDoc}>Store Quality Doc</button>
            </div>
            <div className="list-compact quality-source-list">
              {qualityReferenceDocs.map((doc) => (
                <div key={doc.id} className="audit-item">
                  <div className="audit-row"><strong>{doc.framework}: {doc.title || doc.originalName}</strong><span>{Math.round(doc.sizeBytes / 1024)} KB</span></div>
                  <div className="muted">Uploaded by {doc.uploadedBy} at {new Date(doc.uploadedAt).toLocaleString()}</div>
                  <div className="button-row">
                    <a href={`http://localhost:4000${doc.filePath}`} target="_blank" rel="noreferrer">Open file</a>
                    <button disabled={role === "auditor"} onClick={() => deleteQualityReferenceDoc(doc.id)}>Delete</button>
                  </div>
                </div>
              ))}
              {qualityReferenceDocs.length === 0 && <div className="empty-state">No quality source documents uploaded yet.</div>}
            </div>
          </div>
          <div className="button-row" style={{ marginBottom: "0.75rem" }}>
            <button onClick={downloadQualityMetricsCsv} disabled={!selectedHospitalId}>Export Quality Metrics CSV</button>
          </div>
          {qualitySummary && (
            <div className="summary-grid">
              <div className="summary-chip"><strong>Total Metrics</strong><span>{qualitySummary.total}</span></div>
              {qualitySummary.byFramework.map((f) => (
                <div key={f.framework} className="summary-chip">
                  <strong>{f.framework}</strong>
                  <span>{f.total} total</span>
                  <small>Met: {f.byStatus.met || 0} | Active: {f.byStatus.active || 0} | Review: {f.byStatus["needs-review"] || 0}</small>
                </div>
              ))}
            </div>
          )}
          <div className="audit-list">
            {auditLogs.map((log) => (
              <div key={log.id} className="audit-item">
                <div className="audit-row"><strong>{log.standardCode}</strong><span>{new Date(log.timestamp).toLocaleString()}</span></div>
                <div>{log.action}</div>
                <div className="muted">{log.details}</div>
                <div className="muted">{log.userName} ({log.userRole})</div>
              </div>
            ))}
            {auditLogs.length === 0 && <div className="empty-state">No audit logs yet.</div>}
          </div>
            </aside>
          </div>
        )}
      </main>
      )}


      {loading && <div className="loading-indicator">Loading...</div>}
      {!showAnalyzer && selectedStandard && <footer className="footer">Focused standard: {selectedStandard.code} {selectedStandard.name}</footer>}
    </div>
  );
}

export default App;



























































