import cors from "cors";
import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { AccreditationFramework, standards, StandardDefinition, standardRoleLists } from "./standards";
import { loadPersistedData, savePersistedData } from "./lib/persistence";
import { supabaseAdmin, isSupabaseConfigured } from "./lib/supabase";

type StandardStatus = "in-progress" | "ready-for-admin" | "locked";
type UserRole = "admin" | "owner" | "staff" | "auditor";

interface Hospital {
  id: string;
  name: string;
}

interface StandardState {
  componentsComplete: boolean[];
  metricLabels: string[];
  denominatorValue: number;
  status: StandardStatus;
  lockNote: string;
  lastUpdatedAt: string;
  lastUpdatedBy: string;
  processQuarterChecks: Record<string, Record<string, boolean>>;
  processHiddenSteps: Record<string, boolean>;
}

interface AuditLogEntry {
  id: string;
  hospitalId: string;
  standardCode: string;
  action: string;
  details: string;
  userName: string;
  userRole: UserRole;
  timestamp: string;
}

interface AssignmentItem {
  id: string;
  hospitalId: string;
  standardCode: string;
  componentLabel: string;
  assignee: string;
  dueDate: string;
  status: "open" | "done";
  updatedAt: string;
  updatedBy: string;
}

interface UploadItem {
  id: string;
  hospitalId: string;
  standardCode: string;
  originalName: string;
  storedName: string;
  filePath: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy: string;
}
interface ProcessDocument {
  id: string;
  hospitalId: string;
  standardCode: string;
  processIndex: number;
  originalName: string;
  storedName: string;
  filePath: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy: string;
}
type TemplateDraftKind = "standard-evidence" | "committee-appendix" | "process-step";

interface TemplateDraftRevision {
  id: string;
  title: string;
  body: string;
  savedAt: string;
  savedBy: string;
}

interface TemplateDraft {
  id: string;
  hospitalId: string;
  standardCode: string;
  kind: TemplateDraftKind;
  processIndex: number | null;
  title: string;
  body: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  revisionHistory: TemplateDraftRevision[];
}

interface TemplateCoverageItem {
  kind: TemplateDraftKind;
  label: string;
  processIndex: number | null;
  hasSavedDraft: boolean;
  savedDraftId: string | null;
}

interface TemplateCoverageSummary {
  expectedDraftCount: number;
  savedDraftCount: number;
  items: TemplateCoverageItem[];
}
interface QualityReferenceDocument {
  id: string;
  hospitalId: string;
  framework: "ACS" | "ASCO" | "ASTRO" | "Other";
  title: string;
  originalName: string;
  storedName: string;
  filePath: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy: string;
}
interface PrqWarRoomItem {
  id: string;
  hospitalId: string;
  title: string;
  category: "PRQ" | "Site Review" | "Evidence" | "Policy" | "Other";
  owner: string;
  dueDate: string;
  status: "not-started" | "collecting" | "ready" | "blocked";
  notes: string;
  updatedAt: string;
  updatedBy: string;
}

interface RoleAttendanceEntry {
  participantType: "primary" | "alternate" | "absent";
  assignmentId: string;
  personName: string;
  updatedAt: string;
  updatedBy: string;
}

interface CommitteeMeetingAppendixInput {
  sourceType: "upload" | "process-document" | "template-draft";
  sourceId: string;
  explanation: string;
}

interface CommitteeMeetingAppendix extends CommitteeMeetingAppendixInput {
  id: string;
  standardCode: string;
  originalName: string;
  filePath: string;
  processIndex: number | null;
  templateDraftKind: TemplateDraftKind | null;
}

interface CommitteeMeeting {
  id: string;
  hospitalId: string;
  title: string;
  meetingDate: string;
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  presenter: string;
  conferenceCaseCount: number;
  status: "planned" | "agenda-ready" | "held" | "minutes-uploaded" | "closed";
  oncoLensAssist: boolean;
  notes: string;
  standardCodes: string[];
  referencedRoleAssignmentIds: string[];
  referencedUploadIds: string[];
  appendices: CommitteeMeetingAppendix[];
  minutes: string;
  roleAttendance: Record<string, RoleAttendanceEntry>;
  updatedAt: string;
  updatedBy: string;
}
interface CommitteePerson {
  id: string;
  hospitalId: string;
  name: string;
  degrees: string;
  updatedAt: string;
  updatedBy: string;
}

interface QuarterlyEvidenceItem {
  id: string;
  hospitalId: string;
  standardCode: string;
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  originalName: string;
  storedName: string;
  filePath: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy: string;
}

interface StrategyChecklistItem {
  id: string;
  hospitalId: string;
  title: string;
  standardCode: string;
  checked: boolean;
  notes: string;
  updatedAt: string;
  updatedBy: string;
}

interface StandardRoleAssignment {
  id: string;
  hospitalId: string;
  standardCode: string;
  roleName: string;
  assignmentType: "primary" | "alternate";
  personId: string;
  personName: string;
  degrees: string;
  startDate: string;
  endDate: string;
  notes: string;
  updatedAt: string;
  updatedBy: string;
}
interface CustomQualityMetric {
  id: string;
  hospitalId: string;
  standardCode: string;
  framework: AccreditationFramework;
  title: string;
  description: string;
  target: string;
  status: "active" | "met" | "needs-review" | "paused";
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

interface QualityMetricTemplate {
  framework: AccreditationFramework;
  title: string;
  description: string;
  target: string;
}

interface PersistedData {
  stateEntries: Array<{ key: string; value: StandardState }>;
  auditLog: AuditLogEntry[];
  assignments: AssignmentItem[];
  uploads: UploadItem[];
  templateDrafts: TemplateDraft[];
  customQualityMetrics: CustomQualityMetric[];
  processDocuments: ProcessDocument[];
  qualityReferenceDocuments: QualityReferenceDocument[];
  prqWarRoomItems: PrqWarRoomItem[];
  committeeMeetings: CommitteeMeeting[];
  committeePeople: CommitteePerson[];
  quarterlyEvidence: QuarterlyEvidenceItem[];
  strategyChecklistItems: StrategyChecklistItem[];
  standardRoleAssignments: StandardRoleAssignment[];
}

interface RequestContext {
  userName: string;
  userRole: UserRole;
}

type DocumentExportFormat = "doc" | "docx";

interface DocumentExportPayload {
  title?: string;
  body?: string;
  fileName?: string;
  format?: DocumentExportFormat;
}

const app = express();
const port = Number(process.env.PORT || 4000);

const hospitals: Hospital[] = [{ id: "hosp-001", name: "Augusta Regional Cancer Center" }];

const supportedAccreditationFrameworks: AccreditationFramework[] = ["CoC", "NAPBC", "NCPRC", "NQF", "ASCO", "ASTRO", "ACR", "Other"];

const normalizeAccreditationFramework = (value: unknown): AccreditationFramework => {
  const raw = String(value || "").trim().toUpperCase();
  switch (raw) {
    case "COC": return "CoC";
    case "NAPBC": return "NAPBC";
    case "NCPRC": return "NCPRC";
    case "NQF": return "NQF";
    case "ASCO":
    case "ASCO QOPI": return "ASCO";
    case "ASTRO": return "ASTRO";
    case "ACR": return "ACR";
    case "CUSTOM":
    case "OTHER": return "Other";
    default: return "Other";
  }
};

const allowedCorsOrigins = (process.env.CORS_ORIGIN || "").split(",").map((entry) => entry.trim()).filter(Boolean);

const isServerlessRuntime = Boolean(
  process.env.VERCEL ||
  process.env.VERCEL_ENV ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT ||
  /[\\/]var[\\/]task(?:[\\/]|$)/.test(__dirname)
);

const resolveWritableRuntimeRoot = (): string => {
  const candidateRoots = isServerlessRuntime
    ? [path.join("/tmp", "standardsworkplace"), path.resolve(__dirname, "..")]
    : [path.resolve(__dirname, ".."), path.join("/tmp", "standardsworkplace")];

  for (const candidateRoot of candidateRoots) {
    const candidateDataDir = path.join(candidateRoot, "data");
    const candidateUploadsDir = path.join(candidateRoot, "uploads");

    try {
      fs.mkdirSync(candidateDataDir, { recursive: true });
      fs.mkdirSync(candidateUploadsDir, { recursive: true });
      return candidateRoot;
    } catch (error) {
      console.warn(`Runtime root unavailable: ${candidateRoot}`, error);
    }
  }

  throw new Error("No writable runtime root is available for backend storage.");
};

const runtimeRoot = resolveWritableRuntimeRoot();
const dataDir = path.join(runtimeRoot, "data");
const uploadsDir = path.join(runtimeRoot, "uploads");
const dataFile = path.join(dataDir, "store.json");

const stateStore = new Map<string, StandardState>();
let auditLog: AuditLogEntry[] = [];
let assignments: AssignmentItem[] = [];
let uploads: UploadItem[] = [];
let templateDrafts: TemplateDraft[] = [];
let customQualityMetrics: CustomQualityMetric[] = [];
let processDocuments: ProcessDocument[] = [];
let qualityReferenceDocuments: QualityReferenceDocument[] = [];
let prqWarRoomItems: PrqWarRoomItem[] = [];
let committeeMeetings: CommitteeMeeting[] = [];
let committeePeople: CommitteePerson[] = [];
let quarterlyEvidence: QuarterlyEvidenceItem[] = [];
let strategyChecklistItems: StrategyChecklistItem[] = [];
let standardRoleAssignments: StandardRoleAssignment[] = [];

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      cb(null, `${Date.now()}_${safeName}`);
    }
  }),
  limits: {
    fileSize: 20 * 1024 * 1024
  }
});

app.use(cors(allowedCorsOrigins.length === 0 ? undefined : { origin: allowedCorsOrigins }));
app.use(express.json());
app.use("/uploads", express.static(uploadsDir));

const storeKey = (hospitalId: string, standardCode: string): string => `${hospitalId}::${standardCode}`;

const getContext = (req: Request): RequestContext => {
  const userNameHeader = req.header("x-user-name") || "Local User";
  const roleHeader = (req.header("x-user-role") || "owner").toLowerCase();
  const role: UserRole = ["admin", "owner", "staff", "auditor"].includes(roleHeader)
    ? (roleHeader as UserRole)
    : "owner";
  return { userName: userNameHeader, userRole: role };
};

const getDefinition = (standardCode: string): StandardDefinition | undefined =>
  standards.find((entry) => entry.code === standardCode);

const sanitizeDocumentFileStem = (value: string): string => {
  const cleaned = String(value || "document")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "document";
};

const escapeHtml = (value: string): string => String(value || "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

const buildWordCompatibleHtml = (title: string, body: string): string => `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: Calibri, Arial, sans-serif; color: #1f2937; margin: 36px; }
      h1 { font-size: 18pt; margin-bottom: 8px; }
      p.meta { color: #4b5563; margin: 0 0 18px; }
      pre { white-space: pre-wrap; word-break: break-word; font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.45; margin: 0; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <p class="meta">Generated ${escapeHtml(new Date().toLocaleString())}</p>
    <pre>${escapeHtml(body)}</pre>
  </body>
</html>`;

const buildDocxBuffer = async (title: string, body: string): Promise<Buffer> => {
  const children = [
    new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ children: [new TextRun(`Generated ${new Date().toLocaleString()}`)] }),
    ...body.split(/\r?\n/).map((line) => new Paragraph({ children: [new TextRun(line.length > 0 ? line : " ")] }))
  ];

  const doc = new Document({
    sections: [{ children }]
  });

  return Packer.toBuffer(doc);
};

const makeDefaultMetricLabels = (standardCode: string, count: number): string[] =>
  Array.from({ length: count }, (_, idx) => `Program-defined metric ${idx + 1} (${standardCode})`);
const currentLocalDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isMetricsOnlyStandard = (definition: StandardDefinition): boolean => /^[1-4]\./.test(definition.code);

const getEffectiveHospitalProcess = (definition: StandardDefinition, state: StandardState): string[] => {
  const baseSteps = [...definition.hospitalProcess];
  const targetLength = Math.max(baseSteps.length, state.metricLabels.length);

  while (baseSteps.length < targetLength) {
    const metricLabel = state.metricLabels[baseSteps.length]?.trim();
    baseSteps.push(
      metricLabel && metricLabel.length > 0
        ? `Define how ${metricLabel} is tracked, reviewed, and documented for this hospital.`
        : `Define how this additional metric is tracked, reviewed, and documented for this hospital.`
    );
  }

  return baseSteps;
};

const qualityMetricLibraryByCategory: Record<string, QualityMetricTemplate[]> = {
  Governance: [
    { framework: "NQF", title: "Timely Treatment Pathway Review", description: "Track percentage of new oncology cases reviewed against internal treatment pathway timelines.", target: ">=90% reviewed within program-defined timeline" },
    { framework: "ASCO", title: "Care Plan Documentation Completeness", description: "Track completeness of core oncology care plan documentation elements.", target: ">=85% complete care plans" }
  ],
  Committee: [
    { framework: "ASCO", title: "Case Conference Action Closure", description: "Track closure of action items generated from multidisciplinary case conferences.", target: ">=80% action items closed in 60 days" },
    { framework: "NQF", title: "Committee Decision Documentation", description: "Track complete documentation of major committee decisions and assigned owners.", target: ">=95% decision documentation completeness" }
  ],
  Facility: [
    { framework: "NQF", title: "Diagnostic Service Turnaround", description: "Track turnaround time for key imaging/pathology steps used in treatment planning.", target: "Median turnaround within program target" },
    { framework: "ASCO", title: "Referral Completion Reliability", description: "Track completion of external referrals for core cancer services.", target: ">=90% completed referrals" }
  ],
  Staffing: [
    { framework: "ASCO", title: "Credential Compliance Rate", description: "Track annual credential or education compliance for in-scope oncology staff.", target: ">=95% compliant" },
    { framework: "NQF", title: "Critical Role Coverage", description: "Track uninterrupted coverage for required oncology program roles.", target: "No uncovered required roles >30 days" }
  ],
  Services: [
    { framework: "ASCO", title: "Support Service Referral Follow-through", description: "Track patient follow-through after referral to supportive oncology services.", target: ">=80% referral follow-through" },
    { framework: "NQF", title: "Service Access Equity Check", description: "Track equitable access across demographic groups for supportive care services.", target: "No major disparity beyond program threshold" }
  ],
  Quality: [
    { framework: "ASCO", title: "Treatment Plan Concordance", description: "Track concordance with institution-approved treatment pathways.", target: ">=85% concordance" },
    { framework: "NQF", title: "Adverse Event Documentation Timeliness", description: "Track timeliness of documenting key treatment-related adverse events.", target: ">=90% documented within target window" }
  ],
  Registry: [
    { framework: "NQF", title: "Data Completeness Reliability", description: "Track completeness of required registry data fields.", target: ">=95% complete required fields" },
    { framework: "ASCO", title: "Abstraction Timeliness", description: "Track timeliness of case abstraction against program policy.", target: ">=90% on time" }
  ],
  "Program Improvement": [
    { framework: "ASCO", title: "Improvement Initiative Impact", description: "Track whether annual QI initiatives meet defined impact goals.", target: ">=1 initiative meets goal annually" },
    { framework: "NQF", title: "Guideline Variance Reduction", description: "Track reduction in non-concordant care patterns over time.", target: "Year-over-year reduction" }
  ],
  Community: [
    { framework: "NQF", title: "Community Outreach Reach", description: "Track engagement in outreach events by target audience segment.", target: "Annual reach target achieved" },
    { framework: "ASCO", title: "Screening Follow-up Completion", description: "Track follow-up completion for abnormal community screening findings.", target: ">=85% follow-up completion" }
  ],
  Research: [
    { framework: "ASCO", title: "Trial Screening Rate", description: "Track percentage of eligible patients screened for trial opportunities.", target: ">=70% eligible patients screened" },
    { framework: "NQF", title: "Enrollment Equity Monitoring", description: "Track representation of enrolled participants across major demographic groups.", target: "Variance within program-defined range" }
  ]
};

const getRoleListForStandard = (hospitalId: string, standardCode: string): string[] => {
  const requiredRoles = standardRoleLists[standardCode] || [];
  const assignedRoles = standardRoleAssignments
    .filter((entry) => entry.hospitalId === hospitalId && entry.standardCode === standardCode)
    .map((entry) => entry.roleName.trim())
    .filter((entry) => entry.length > 0);

  return Array.from(new Set([...requiredRoles, ...assignedRoles]));
};

const legacyMetricLabelsByStandard: Record<string, string[]> = {
  "2.2": [
    "First NCDB data presentation by CLP (or approved alternate) at a documented cancer committee meeting  meeting date and agenda confirmed",
    "Second NCDB data presentation at a distinct cancer committee meeting  must be a different meeting date from the first",
    "First CLP or approved alternate NCDB presentation documented with agenda, minutes, and meeting date",
    "Second CLP or approved alternate NCDB presentation documented at a different committee meeting date"
  ],
  "2.3": [
    "Q1 (January 1 - March 31): Meeting held, minutes document attendance and quality agenda items",
    "Q2 (April 1 - June 30): Meeting held, minutes document attendance and quality agenda items",
    "Q3 (July 1 - September 30): Meeting held, minutes document attendance and quality agenda items",
    "Q4 (October 1 - December 31): Meeting held, minutes document attendance and quality agenda items",
    "Q1 meeting completed and minutes capture attendance plus quality discussion",
    "Q2 meeting completed and minutes capture attendance plus quality discussion",
    "Q3 meeting completed and minutes capture attendance plus quality discussion",
    "Q4 meeting completed and minutes capture attendance plus quality discussion"
  ],
  "3.2": [
    "Diagnostic imaging services available (CT, MRI, PET, nuclear medicine)  on-site or documented referral arrangement",
    "Radiation oncology treatment services available  on-site or documented referral arrangement",
    "Systemic therapy (chemotherapy/immunotherapy/targeted therapy) administration available  on-site or documented referral arrangement"
  ],
  "2.5": [
    "Percentage of analytic caseload presented at multidisciplinary cancer case conference (target per category threshold)",
    "Percentage of presented cases that were prospective (presented before initiation of first cancer-directed treatment)"
  ],
  "4.2": [
    "Each oncology nurse meets education/certification criterion: current oncology nursing certification OR documentation of 18 oncology-specific nursing continuing professional development (NCPD) contact hours within the past 3 years",
    "Each oncology nurse demonstrates annual oncology-specific clinical competency as documented per facility process",
    "The annual evaluation of oncology nursing continuing education and oncology nursing competency is documented in the cancer committee meeting minutes.",
    "A protocol is in place to ensure oncology nursing continuing education and oncology nursing competency are reviewed and assessed by the facility.",
    "The oncology nursing education and competency protocol is reviewed once each accreditation cycle and documented in the meeting minutes."
  ],
  "4.4": [
    "Referral criteria used to identify patients who may benefit from genetic counseling or hereditary risk assessment are defined and documented",
    "Genetics professionals available for pre-test counseling are identified (on-site or referral agreement)",
    "Professionals providing post-test counseling and result disclosure are identified",
    "Risk assessment process is based on current published clinical guidelines (e.g., NCCN, ACMG, ASCO)",
    "Cancer risk assessment, genetic counseling, and genetic testing services are provided on-site or by referral through a qualified genetics professional.",
    "A protocol for genetic counseling and risk-assessment services is in place and includes all required elements.",
    "A process based on evidence-based national guidelines is in place for genetic assessment for a selected cancer site and includes all required elements."
  ],
  "4.5": [
    "Approximate number of cancer patients referred to palliative care and types of services/resources used during the reporting year documented",
    "Criteria or triggers used for palliative care referral are defined and documented",
    "Areas identified for improvement in the palliative care program are documented with planned actions",
    "Palliative care services are available to patients with cancer on-site or by referral.",
    "A protocol for palliative care services is in place and includes all required elements.",
    "The process for providing or referring palliative care services is monitored and evaluated, and the required annual report is documented in the cancer committee meeting minutes."
  ],
  "4.6": [
    "Available rehabilitation services (physical therapy, occupational therapy, speech-language pathology, lymphedema management, etc.) identified and documented",
    "Annual evaluation of rehabilitation services completed and presented to cancer committee",
    "The cancer committee develops protocols to guide referral to appropriate rehabilitation care services on-site or by referral.",
    "The process for referring or providing rehabilitation care services is monitored and evaluated and documented in the cancer committee meeting minutes."
  ],
  "4.7": [
    "Available oncology nutrition services (registered dietitian access, nutritional counseling, enteral/parenteral support, etc.) identified and documented",
    "Annual evaluation of oncology nutrition services completed and presented to cancer committee",
    "Oncology nutrition services are provided on-site or by referral through a Registered Dietitian Nutritionist.",
    "The process for referring or providing oncology nutrition services is monitored and evaluated and documented in the cancer committee meeting minutes."
  ],
  "4.8": [
    "Estimated number of patients participating in identified survivorship services during the reporting year documented",
    "Resources or program improvements identified to enhance the survivorship program documented",
    "The cancer committee identifies the survivorship program team, including the designated coordinator and members.",
    "The survivorship program is monitored and evaluated, and the Survivorship Program Coordinator''s annual report is documented in the cancer committee meeting minutes."
  ],
  "5.2": [
    "Annual report includes: total number of patients screened, distress screening tool used, referral process for positive screens, and outcomes  presented to cancer committee in Q1",
    "Annual report includes total number of patients screened, distress screening tool used, referral process for positive screens, and outcomes, and is presented to the cancer committee in Q1",
    "Protocols are in place to provide patient access to psychosocial services on-site or by referral.",
    "The cancer committee implements a protocol that includes all requirements for providing and monitoring psychosocial distress screening and referral for psychosocial care.",
    "Cancer patients are screened for psychosocial distress at least once during the first course of treatment.",
    "The psychosocial distress screening process is evaluated, and the Psychosocial Services Coordinator''s annual report is documented in the cancer committee meeting minutes."
  ],
  "5.9": [
    "Cancer patients screened for current tobacco use status using a validated instrument at or near the time of initial oncology consultation  screening rate calculated",
    "Of patients identified as current tobacco users, those who received cessation counseling or were referred to a cessation resource  referral/counsel rate calculated"
  ],
  "6.2": ["Retired standard  marked Not Applicable"],
  "6.3": ["Retired standard  marked Not Applicable"],
  "8.1": [
    "Evaluation of strategy effectiveness  outcome data or progress indicator documented"
  ],
  "9.1": [
    "List of studies with accrued subjects  study name and enrollment count per study documented",
    "Total subjects accrued across all studies during the reporting year documented",
    "Status of open studies noted, including anticipated end dates or enrollment targets nearing completion",
    "New clinical trials in planning or recently opened during the reporting year listed",
    "Action plan documented if required minimum accrual level is unmet"
  ],
  "9.2": [
    "All required data elements and participation criteria for the current CoC-assigned special study are met per the program'\''s accreditation category"
  ]
};

const isProgramDefinedMetricLabel = (value: string): boolean =>
  /^Program-defined metric\s+\d+\s+\([^)]+\)$/.test(value.trim());

const isLoosePlaceholderMetricLabel = (value: string): boolean =>
  /^new metric\s+\d+$/i.test(value.trim());

const shouldUseFallbackMetricLabel = (
  standardCode: string,
  persistedLabel: string | undefined,
  fallbackLabel: string,
  index: number
): boolean => {
  const trimmed = String(persistedLabel || "").trim();
  if (!trimmed) return true;
  if (isProgramDefinedMetricLabel(trimmed)) return true;
  if (isLoosePlaceholderMetricLabel(trimmed)) return true;
  const legacyLabels = legacyMetricLabelsByStandard[standardCode] || [];
  return legacyLabels.includes(trimmed);
};

const getDefaultMetricLabels = (definition: StandardDefinition): string[] =>
  standardRoleLists[definition.code]
    ? standardRoleLists[definition.code].map((roleName) => `${roleName} appointed and documented`)
    : [...definition.numeratorComponents];

const getRequiredMetricLabels = (hospitalId: string, definition: StandardDefinition): string[] =>
  standardRoleLists[definition.code]
    ? getRoleListForStandard(hospitalId, definition.code).map((roleName) => `${roleName} appointed and documented`)
    : getDefaultMetricLabels(definition);

const getPreservedExtraMetricLabels = (existingLabels: string[], requiredLabels: string[]): string[] => {
  const seen = new Set(requiredLabels.map((label) => label.trim().toLowerCase()));
  const extras: string[] = [];

  existingLabels.slice(requiredLabels.length).forEach((label) => {
    const trimmed = String(label || "").trim();
    if (!trimmed) return;

    const normalized = trimmed.toLowerCase();
    if (seen.has(normalized)) return;
    seen.add(normalized);
    extras.push(trimmed);
  });

  return extras;
};

const getTrackingMetricLabels = (hospitalId: string, definition: StandardDefinition, existingLabels: string[] = []): string[] => {
  const requiredLabels = getRequiredMetricLabels(hospitalId, definition);
  return [...requiredLabels, ...getPreservedExtraMetricLabels(existingLabels, requiredLabels)];
};

const getRequiredMetricCount = (hospitalId: string, definition: StandardDefinition): number =>
  getRequiredMetricLabels(hospitalId, definition).length;

const normalizeRoleName = (value: string): string => value.trim().toLowerCase();

const isRoleAssignmentCurrent = (assignment: StandardRoleAssignment): boolean =>
  !assignment.endDate || assignment.endDate >= currentLocalDate();

const ensureStrategyChecklist = (hospitalId: string) => {
  const defaults: Array<{ id: string; title: string; standardCode: string }> = [
    {
      id: "2.2-site-visit-clp-presence",
      title: "The CLP is present during the CoC site visit and meets with the site reviewer to discuss CLP activities and responsibilities.",
      standardCode: "2.2"
    }
  ];

  defaults.forEach((item) => {
    const exists = strategyChecklistItems.some((entry) => entry.hospitalId === hospitalId && entry.id === item.id);
    if (!exists) {
      strategyChecklistItems.push({
        ...item,
        hospitalId,
        checked: false,
        notes: "",
        updatedAt: new Date().toISOString(),
        updatedBy: "system"
      });
    }
  });
};

const syncStandard22QuarterEvidenceState = (hospitalId: string, updatedBy = "system") => {
  const definition = getDefinition("2.2");
  if (!definition) return;

  const state = ensureState(hospitalId, definition.code);
  const documentedQuarterCount = new Set(
    quarterlyEvidence
      .filter((entry) => entry.hospitalId === hospitalId && entry.standardCode === definition.code)
      .map((entry) => entry.quarter)
  ).size;

  const previousComponents = [...state.componentsComplete];
  const requiredCount = getRequiredMetricCount(hospitalId, definition);
  const trackingLabels = getTrackingMetricLabels(hospitalId, definition, state.metricLabels);

  state.metricLabels = trackingLabels;
  state.componentsComplete = [
    documentedQuarterCount >= 1,
    documentedQuarterCount >= 2,
    ...trackingLabels.slice(requiredCount).map((_, idx) => Boolean(previousComponents[requiredCount + idx]))
  ];
  state.lastUpdatedAt = new Date().toISOString();
  state.lastUpdatedBy = updatedBy;
};

const isQualifyingCommitteeMeetingFor23 = (meeting: CommitteeMeeting): boolean => {
  const completedStatuses: CommitteeMeeting["status"][] = ["held", "minutes-uploaded", "closed"];
  const hasMinutesContent = meeting.minutes.trim().length > 0 || meeting.notes.trim().length > 0;
  return completedStatuses.includes(meeting.status) && hasMinutesContent;
};

const syncStandard23CommitteeMeetingState = (hospitalId: string, updatedBy = "system") => {
  const definition = getDefinition("2.3");
  if (!definition) return;

  const state = ensureState(hospitalId, definition.code);
  const qualifyingQuarters = new Set(
    committeeMeetings
      .filter((entry) => entry.hospitalId === hospitalId)
      .filter(isQualifyingCommitteeMeetingFor23)
      .map((entry) => entry.quarter)
  );

  const previousComponents = [...state.componentsComplete];
  const requiredCount = getRequiredMetricCount(hospitalId, definition);
  const trackingLabels = getTrackingMetricLabels(hospitalId, definition, state.metricLabels);

  state.metricLabels = trackingLabels;
  state.componentsComplete = [
    ...(["Q1", "Q2", "Q3", "Q4"] as const).map((quarter) => qualifyingQuarters.has(quarter)),
    ...trackingLabels.slice(requiredCount).map((_, idx) => Boolean(previousComponents[requiredCount + idx]))
  ];
  state.denominatorValue = 4;
  state.lastUpdatedAt = new Date().toISOString();
  state.lastUpdatedBy = updatedBy;
};

const syncStandardRoleState = (hospitalId: string, standardCode: string, updatedBy = "system") => {
  const definition = getDefinition(standardCode);
  if (!definition || !standardRoleLists[standardCode]) {
    return;
  }

  const state = ensureState(hospitalId, standardCode);
  const roleList = getRoleListForStandard(hospitalId, standardCode);
  const currentAssignments = standardRoleAssignments.filter(
    (entry) =>
      entry.hospitalId === hospitalId &&
      entry.standardCode === standardCode &&
      entry.personName.trim().length > 0 &&
      isRoleAssignmentCurrent(entry)
  );
  const currentRoleNames = new Set(currentAssignments.map((entry) => normalizeRoleName(entry.roleName)));

  const previousComponents = [...state.componentsComplete];
  const requiredCount = getRequiredMetricCount(hospitalId, definition);
  const trackingLabels = getTrackingMetricLabels(hospitalId, definition, state.metricLabels);

  state.metricLabels = trackingLabels;
  state.componentsComplete = [
    ...roleList.map((roleName) => currentRoleNames.has(normalizeRoleName(roleName))),
    ...trackingLabels.slice(requiredCount).map((_, idx) => Boolean(previousComponents[requiredCount + idx]))
  ];
  state.denominatorValue = roleList.length;
  state.lastUpdatedAt = new Date().toISOString();
  state.lastUpdatedBy = updatedBy;
};

const calculate = (hospitalId: string, definition: StandardDefinition, state: StandardState) => {
  const requiredCount = getRequiredMetricCount(hospitalId, definition);
  const numerator = state.componentsComplete.slice(0, requiredCount).filter(Boolean).length;
  const denominator = isMetricsOnlyStandard(definition)
    ? Math.max(requiredCount, 1)
    : definition.denominator.mode === "fixed"
      ? definition.denominator.defaultValue
      : Math.max(state.denominatorValue, 0);
  const compliancePercent = denominator > 0 ? Number(((numerator / denominator) * 100).toFixed(2)) : 0;

  let meets = false;
  if (definition.retired) {
    meets = true;
  } else if (definition.threshold.type === "equal") {
    meets = numerator === definition.threshold.value;
  } else if (definition.threshold.type === "gteCount") {
    meets = numerator >= definition.threshold.value;
  } else {
    meets = compliancePercent >= definition.threshold.value;
  }

  return { numerator, denominator, compliancePercent, meets };
};

const addAuditLog = (
  hospitalId: string,
  standardCode: string,
  action: string,
  details: string,
  context: RequestContext
) => {
  auditLog.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    hospitalId,
    standardCode,
    action,
    details,
    userName: context.userName,
    userRole: context.userRole,
    timestamp: new Date().toISOString()
  });
  if (auditLog.length > 5000) {
    auditLog.length = 5000;
  }
};

const ensureState = (hospitalId: string, standardCode: string): StandardState => {
  const key = storeKey(hospitalId, standardCode);
  const found = stateStore.get(key);
  if (found) {
    if (found.status === "locked") {
      found.status = "in-progress";
      if (found.lockNote === "Retired standard auto-marked as N/A.") {
        found.lockNote = "";
      }
    }
    return found;
  }

  const definition = getDefinition(standardCode);
  if (!definition) throw new Error(`Unknown standard ${standardCode}`);

  const labels = getDefaultMetricLabels(definition);
  const initial: StandardState = {
    componentsComplete: labels.map(() => definition.retired || false),
    metricLabels: labels,
    denominatorValue: definition.denominator.defaultValue,
    status: "in-progress",
    lockNote: "",
    lastUpdatedAt: new Date().toISOString(),
    lastUpdatedBy: "system",
    processQuarterChecks: {},
    processHiddenSteps: {}
  };
  stateStore.set(key, initial);
  return initial;
};

const buildCommitteeMeetingAppendices = (
  hospitalId: string,
  appendices: unknown,
  referencedUploadIds: string[] = []
): CommitteeMeetingAppendix[] => {
  const appendixMap = new Map<string, CommitteeMeetingAppendix>();

  const addUploadAppendix = (uploadItem: UploadItem, explanation: string) => {
    appendixMap.set(`upload:${uploadItem.id}`, {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      sourceType: "upload",
      sourceId: uploadItem.id,
      standardCode: uploadItem.standardCode,
      originalName: uploadItem.originalName,
      filePath: uploadItem.filePath,
      processIndex: null,
      templateDraftKind: null,
      explanation
    });
  };

  const addProcessDocAppendix = (doc: ProcessDocument, explanation: string) => {
    appendixMap.set(`process-document:${doc.id}`, {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      sourceType: "process-document",
      sourceId: doc.id,
      standardCode: doc.standardCode,
      originalName: doc.originalName,
      filePath: doc.filePath,
      processIndex: doc.processIndex,
      templateDraftKind: null,
      explanation
    });
  };

  const addTemplateDraftAppendix = (draft: TemplateDraft, explanation: string) => {
    appendixMap.set(`template-draft:${draft.id}`, {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      sourceType: "template-draft",
      sourceId: draft.id,
      standardCode: draft.standardCode,
      originalName: draft.title,
      filePath: "",
      processIndex: draft.processIndex,
      templateDraftKind: draft.kind,
      explanation
    });
  };

  if (Array.isArray(appendices)) {
    appendices.forEach((item) => {
      if (!item || typeof item !== "object") return;
      const entry = item as Partial<CommitteeMeetingAppendixInput>;
      const sourceType = entry.sourceType === "process-document"
        ? "process-document"
        : entry.sourceType === "template-draft"
          ? "template-draft"
          : entry.sourceType === "upload"
            ? "upload"
            : null;
      const sourceId = String(entry.sourceId || "").trim();
      const explanation = String(entry.explanation || "").trim();
      if (!sourceType || !sourceId) return;

      if (sourceType === "upload") {
        const uploadItem = uploads.find((candidate) => candidate.hospitalId === hospitalId && candidate.id === sourceId);
        if (uploadItem) addUploadAppendix(uploadItem, explanation);
        return;
      }

      if (sourceType === "process-document") {
        const doc = processDocuments.find((candidate) => candidate.hospitalId === hospitalId && candidate.id === sourceId);
        if (doc) addProcessDocAppendix(doc, explanation);
        return;
      }

      const draft = templateDrafts.find((candidate) => candidate.hospitalId === hospitalId && candidate.id === sourceId);
      if (draft) addTemplateDraftAppendix(draft, explanation);
    });
  }

  referencedUploadIds.forEach((uploadId) => {
    const uploadItem = uploads.find((candidate) => candidate.hospitalId === hospitalId && candidate.id === uploadId);
    if (uploadItem && !appendixMap.has(`upload:${uploadItem.id}`)) {
      addUploadAppendix(uploadItem, "");
    }
  });

  return Array.from(appendixMap.values());
};

const templateDraftKindOrder: Record<TemplateDraftKind, number> = {
  "standard-evidence": 0,
  "committee-appendix": 1,
  "process-step": 2
};

const isTemplateDraftKind = (value: unknown): value is TemplateDraftKind =>
  value === "standard-evidence" || value === "committee-appendix" || value === "process-step";

const sortTemplateDrafts = (items: TemplateDraft[]): TemplateDraft[] =>
  [...items].sort((left, right) => {
    const kindDelta = templateDraftKindOrder[left.kind] - templateDraftKindOrder[right.kind];
    if (kindDelta !== 0) return kindDelta;
    return (left.processIndex ?? -1) - (right.processIndex ?? -1);
  });

const getTemplateDraftsForStandard = (hospitalId: string, standardCode: string): TemplateDraft[] =>
  sortTemplateDrafts(templateDrafts.filter((item) => item.hospitalId === hospitalId && item.standardCode === standardCode));

const buildTemplateDraftRevisionSnapshot = (draft: Pick<TemplateDraft, "title" | "body" | "updatedAt" | "updatedBy">): TemplateDraftRevision => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  title: draft.title,
  body: draft.body,
  savedAt: draft.updatedAt,
  savedBy: draft.updatedBy
});

const buildTemplateCoverage = (
  hospitalId: string,
  definition: StandardDefinition,
  state: StandardState
): TemplateCoverageSummary => {
  const processSteps = getEffectiveHospitalProcess(definition, state);
  const savedDrafts = getTemplateDraftsForStandard(hospitalId, definition.code);
  const findSavedDraft = (kind: TemplateDraftKind, processIndex: number | null = null) =>
    savedDrafts.find((item) => item.kind === kind && item.processIndex === processIndex);

  const standardEvidenceDraft = findSavedDraft("standard-evidence");
  const committeeAppendixDraft = findSavedDraft("committee-appendix");
  const items: TemplateCoverageItem[] = [
    {
      kind: "standard-evidence",
      label: "Standard working evidence",
      processIndex: null,
      hasSavedDraft: Boolean(standardEvidenceDraft),
      savedDraftId: standardEvidenceDraft?.id || null
    },
    {
      kind: "committee-appendix",
      label: "Cancer committee appendix",
      processIndex: null,
      hasSavedDraft: Boolean(committeeAppendixDraft),
      savedDraftId: committeeAppendixDraft?.id || null
    },
    ...processSteps.map((step, index) => {
      const savedDraft = findSavedDraft("process-step", index);
      return {
        kind: "process-step" as const,
        label: `Step ${index + 1}: ${step}`,
        processIndex: index,
        hasSavedDraft: Boolean(savedDraft),
        savedDraftId: savedDraft?.id || null
      };
    })
  ];

  return {
    expectedDraftCount: items.length,
    savedDraftCount: items.filter((item) => item.hasSavedDraft).length,
    items
  };
};

const persist = async () => {
  const payload: PersistedData = {
    stateEntries: Array.from(stateStore.entries()).map(([key, value]) => ({ key, value })),
    auditLog,
    assignments,
    uploads,
    templateDrafts,
    customQualityMetrics,
    processDocuments,
    qualityReferenceDocuments,
    prqWarRoomItems,
    committeeMeetings,
    committeePeople,
    quarterlyEvidence,
    strategyChecklistItems,
    standardRoleAssignments
  };
  await savePersistedData(payload, dataFile);
};

const loadPersisted = async () => {
  const parsed = await loadPersistedData<PersistedData>(dataFile);
  if (!parsed) return;
  let didNormalizeMetricLabels = false;

  parsed.stateEntries?.forEach((entry) => {
    const [hospitalId, standardCode] = entry.key.split("::");
    const definition = getDefinition(standardCode);
    const fallbackCount = definition?.numeratorComponents.length || entry.value.componentsComplete.length || 0;
    const persistedLabels = Array.isArray((entry.value as any).metricLabels)
      ? ((entry.value as any).metricLabels as string[]).map((label) => String(label || "").trim())
      : [];
    const defaultLabels = definition ? getRequiredMetricLabels(hospitalId, definition) : makeDefaultMetricLabels(standardCode, fallbackCount);
    const requiredLabels = defaultLabels.map((fallback, idx) => {
      const persistedLabel = persistedLabels[idx];
      if (shouldUseFallbackMetricLabel(standardCode, persistedLabel, fallback, idx)) {
        if (String(persistedLabel || "").trim() !== fallback.trim()) {
          didNormalizeMetricLabels = true;
        }
        return fallback;
      }
      return String(persistedLabel).trim();
    });
    const labels = definition
      ? [...requiredLabels, ...getPreservedExtraMetricLabels(persistedLabels, requiredLabels)]
      : requiredLabels;

    const components = Array.isArray(entry.value.componentsComplete)
      ? labels.map((_, idx) => Boolean(entry.value.componentsComplete[idx]))
      : labels.map(() => false);

    stateStore.set(entry.key, {
      ...entry.value,
      status: entry.value.status === "locked" ? "in-progress" : entry.value.status,
      lockNote: entry.value.status === "locked" && String(entry.value.lockNote || "") === "Retired standard auto-marked as N/A." ? "" : String(entry.value.lockNote || ""),
      metricLabels: labels,
      componentsComplete: components,
      denominatorValue: definition
        ? (definition.denominator.mode === "fixed"
          ? definition.denominator.defaultValue
          : (Number.isFinite(entry.value.denominatorValue) && entry.value.denominatorValue > 0
            ? Math.round(entry.value.denominatorValue)
            : definition.denominator.defaultValue))
        : (Number.isFinite(entry.value.denominatorValue) && entry.value.denominatorValue > 0
          ? Math.round(entry.value.denominatorValue)
          : labels.length),
      processQuarterChecks: (entry.value as any).processQuarterChecks || {},
      processHiddenSteps: (entry.value as any).processHiddenSteps || {}
    });
  });
  auditLog = parsed.auditLog || [];
  assignments = parsed.assignments || [];
  uploads = parsed.uploads || [];
  templateDrafts = ((parsed as any).templateDrafts || [])
    .map((item: Partial<TemplateDraft>) => {
      const kind = isTemplateDraftKind(item.kind) ? item.kind : "standard-evidence";
      const normalizedProcessIndex = kind === "process-step" && Number.isInteger(item.processIndex)
        ? Number(item.processIndex)
        : null;
      return {
        id: String(item.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`),
        hospitalId: String(item.hospitalId || ""),
        standardCode: String(item.standardCode || ""),
        kind,
        processIndex: normalizedProcessIndex,
        title: String(item.title || ""),
        body: String(item.body || ""),
        createdAt: String(item.createdAt || item.updatedAt || new Date().toISOString()),
        createdBy: String(item.createdBy || item.updatedBy || "system"),
        updatedAt: String(item.updatedAt || item.createdAt || new Date().toISOString()),
        updatedBy: String(item.updatedBy || item.createdBy || "system"),
        revisionHistory: Array.isArray((item as any).revisionHistory)
          ? ((item as any).revisionHistory as Array<Partial<TemplateDraftRevision>>).map((revision) => ({
              id: String(revision.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`),
              title: String(revision.title || ""),
              body: String(revision.body || ""),
              savedAt: String(revision.savedAt || new Date().toISOString()),
              savedBy: String(revision.savedBy || "system")
            })).filter((revision) => revision.title.trim() || revision.body.trim())
          : []
      };
    })
    .filter((item: TemplateDraft) => item.hospitalId && item.standardCode && item.title.trim() && item.body.trim());
  customQualityMetrics = (parsed.customQualityMetrics || []).map((item) => ({ ...item, framework: normalizeAccreditationFramework(item.framework) }));
  processDocuments = (parsed as any).processDocuments || [];
  qualityReferenceDocuments = (parsed as any).qualityReferenceDocuments || [];
  prqWarRoomItems = (parsed as any).prqWarRoomItems || [];
  committeeMeetings = ((parsed as any).committeeMeetings || []).map((item: Partial<CommitteeMeeting>) => ({
    id: String(item.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`),
    hospitalId: String(item.hospitalId || ""),
    title: String(item.title || ""),
    meetingDate: String(item.meetingDate || ""),
    quarter: ["Q1", "Q2", "Q3", "Q4"].includes(String(item.quarter)) ? item.quarter as CommitteeMeeting["quarter"] : "Q1",
    presenter: String(item.presenter || ""),
    conferenceCaseCount: Math.max(Number(item.conferenceCaseCount || 0), 0),
    status: ["planned", "agenda-ready", "held", "minutes-uploaded", "closed"].includes(String(item.status)) ? item.status as CommitteeMeeting["status"] : "planned",
    oncoLensAssist: item.oncoLensAssist !== false,
    notes: String(item.notes || ""),
    standardCodes: Array.isArray(item.standardCodes) ? item.standardCodes.map((entry) => String(entry)) : [],
    referencedRoleAssignmentIds: Array.isArray(item.referencedRoleAssignmentIds) ? item.referencedRoleAssignmentIds.map((entry) => String(entry)) : [],
    referencedUploadIds: Array.isArray(item.referencedUploadIds) ? item.referencedUploadIds.map((entry) => String(entry)) : [],
    appendices: buildCommitteeMeetingAppendices(
      String(item.hospitalId || ""),
      (item).appendices,
      Array.isArray(item.referencedUploadIds) ? item.referencedUploadIds.map((entry) => String(entry)) : []
    ),
    minutes: String(item.minutes || item.notes || ""),
    roleAttendance: (item.roleAttendance && typeof item.roleAttendance === "object") ? item.roleAttendance as Record<string, RoleAttendanceEntry> : {},
    updatedAt: String(item.updatedAt || new Date().toISOString()),
    updatedBy: String(item.updatedBy || "system")
  }));
  committeePeople = ((parsed as any).committeePeople || []).map((item: Partial<CommitteePerson>) => ({
    id: String(item.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`),
    hospitalId: String(item.hospitalId || ""),
    name: String(item.name || ""),
    degrees: String(item.degrees || ""),
    updatedAt: String(item.updatedAt || new Date().toISOString()),
    updatedBy: String(item.updatedBy || "system")
  }));
  quarterlyEvidence = ((parsed as any).quarterlyEvidence || []).map((item: Partial<QuarterlyEvidenceItem>) => ({
    id: String(item.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`),
    hospitalId: String(item.hospitalId || ""),
    standardCode: String(item.standardCode || ""),
    quarter: ["Q1", "Q2", "Q3", "Q4"].includes(String(item.quarter)) ? item.quarter as QuarterlyEvidenceItem["quarter"] : "Q1",
    originalName: String(item.originalName || ""),
    storedName: String(item.storedName || ""),
    filePath: String(item.filePath || ""),
    sizeBytes: Math.max(Number(item.sizeBytes || 0), 0),
    uploadedAt: String(item.uploadedAt || new Date().toISOString()),
    uploadedBy: String(item.uploadedBy || "system")
  }));
  strategyChecklistItems = ((parsed as any).strategyChecklistItems || []).map((item: Partial<StrategyChecklistItem>) => ({
    id: String(item.id || ""),
    hospitalId: String(item.hospitalId || ""),
    title: String(item.title || ""),
    standardCode: String(item.standardCode || "GLOBAL"),
    checked: Boolean(item.checked),
    notes: String(item.notes || ""),
    updatedAt: String(item.updatedAt || new Date().toISOString()),
    updatedBy: String(item.updatedBy || "system")
  }));
  standardRoleAssignments = ((parsed as any).standardRoleAssignments || []).map((item: Partial<StandardRoleAssignment>) => ({
    id: String(item.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`),
    hospitalId: String(item.hospitalId || ""),
    standardCode: String(item.standardCode || ""),
    roleName: String(item.roleName || ""),
    assignmentType: String((item as { assignmentType?: string }).assignmentType || "primary") === "alternate" ? "alternate" : "primary",
    personId: String(item.personId || ""),
    personName: String(item.personName || ""),
    degrees: String(item.degrees || ""),
    startDate: String(item.startDate || ""),
    endDate: String(item.endDate || ""),
    notes: String(item.notes || ""),
    updatedAt: String(item.updatedAt || new Date().toISOString()),
    updatedBy: String(item.updatedBy || "system")
  }));
  hospitals.forEach((hospital) => {
    ensureStrategyChecklist(hospital.id);
    Object.keys(standardRoleLists).forEach((standardCode) => {
      syncStandardRoleState(hospital.id, standardCode);
    });
    syncStandard22QuarterEvidenceState(hospital.id);
    syncStandard23CommitteeMeetingState(hospital.id);
  });

  if (didNormalizeMetricLabels) {
    void persist();
  }
};

let startupError: Error | null = null;
const dataLoadPromise = loadPersisted().catch((error: unknown) => {
  startupError = error instanceof Error ? error : new Error(String(error));
  console.error("Failed to initialize persisted backend state", startupError);
});

app.use(async (_req, res, next) => {
  await dataLoadPromise;
  if (startupError) {
    return res.status(500).json({
      error: "Backend startup failed",
      details: startupError.message,
    });
  }
  next();
});

app.get("/", async (_req: Request, res: Response) => {
  await dataLoadPromise;
  if (startupError) {
    return res.status(500).json({
      status: "error",
      service: "coc-backend",
      now: new Date().toISOString(),
      details: startupError.message,
    });
  }

  return res.json({
    status: "ok",
    service: "coc-backend",
    health: "/api/health",
  });
});

app.get("/favicon.ico", (_req: Request, res: Response) => {
  res.status(204).end();
});

app.get("/api/health", async (_req: Request, res: Response) => {
  await dataLoadPromise;
  if (startupError) {
    return res.status(500).json({
      status: "error",
      service: "coc-backend",
      now: new Date().toISOString(),
      details: startupError.message,
    });
  }

  res.json({ status: "ok", service: "coc-backend", now: new Date().toISOString() });
});

app.get("/api/hospitals", (_req: Request, res: Response) => {
  res.json(hospitals);
});

app.post("/api/document-exports", async (req: Request, res: Response) => {
  const { title, body, fileName, format } = req.body as DocumentExportPayload;
  const safeTitle = String(title || "CoC Template").trim() || "CoC Template";
  const safeBody = String(body || "").trim();
  const selectedFormat: DocumentExportFormat = format === "docx" ? "docx" : "doc";
  const fileStem = sanitizeDocumentFileStem(fileName || safeTitle);

  if (!safeBody) return res.status(400).json({ error: "Document body is required" });

  if (selectedFormat === "docx") {
    const buffer = await buildDocxBuffer(safeTitle, safeBody);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename=${fileStem}.docx`);
    return res.send(buffer);
  }

  const html = buildWordCompatibleHtml(safeTitle, safeBody);
  res.setHeader("Content-Type", "application/msword");
  res.setHeader("Content-Disposition", `attachment; filename=${fileStem}.doc`);
  return res.send(html);
});



app.get("/api/hospitals/:hospitalId/standards", (req: Request, res: Response) => {
  const hospital = hospitals.find((h) => h.id === req.params.hospitalId);
  if (!hospital) return res.status(404).json({ error: "Hospital not found" });

  const payload = standards.map((definition) => {
    const state = ensureState(hospital.id, definition.code);
    const results = calculate(hospital.id, definition, state);

    return {
      code: definition.code,
      name: definition.name,
      category: definition.category,
      framework: definition.framework,
      retired: Boolean(definition.retired),
      status: state.status,
      compliancePercent: results.compliancePercent,
      meets: results.meets,
      assignmentCount: assignments.filter((a) => a.hospitalId === hospital.id && a.standardCode === definition.code).length,
      uploadCount: uploads.filter((u) => u.hospitalId === hospital.id && u.standardCode === definition.code).length
    };
  });

  return res.json(payload);
});

app.get("/api/hospitals/:hospitalId/standards/:standardCode", (req: Request, res: Response) => {
  const hospital = hospitals.find((h) => h.id === req.params.hospitalId);
  if (!hospital) return res.status(404).json({ error: "Hospital not found" });

  const definition = getDefinition(req.params.standardCode);
  if (!definition) return res.status(404).json({ error: "Standard not found" });

  const state = ensureState(hospital.id, definition.code);
  const results = calculate(hospital.id, definition, state);
  const hospitalProcess = getEffectiveHospitalProcess(definition, state);

  return res.json({
    hospital,
    standard: { ...definition, numeratorComponents: state.metricLabels, hospitalProcess, requiredMetricCount: getRequiredMetricCount(hospital.id, definition) },
    state,
    results,
    assignments: assignments.filter((a) => a.hospitalId === hospital.id && a.standardCode === definition.code),
    uploads: uploads.filter((u) => u.hospitalId === hospital.id && u.standardCode === definition.code),
    qualityMetricLibrary: qualityMetricLibraryByCategory[definition.category] || [],
    customQualityMetrics: customQualityMetrics.filter((m) => m.hospitalId === hospital.id && m.standardCode === definition.code),
    processDocuments: processDocuments.filter((d) => d.hospitalId === hospital.id && d.standardCode === definition.code),
    templateDrafts: getTemplateDraftsForStandard(hospital.id, definition.code),
    templateCoverage: buildTemplateCoverage(hospital.id, definition, state),
    roleList: getRoleListForStandard(hospital.id, definition.code),
    roleAssignments: standardRoleAssignments.filter((entry) => entry.hospitalId === hospital.id && entry.standardCode === definition.code),
    quarterlyEvidence: quarterlyEvidence.filter((entry) => entry.hospitalId === hospital.id && entry.standardCode === definition.code)
  });
});

app.post("/api/hospitals/:hospitalId/standards/:standardCode/template-drafts", async (req: Request, res: Response) => {
  const context = getContext(req);
  if (context.userRole === "auditor") return res.status(403).json({ error: "Auditors have read-only access" });

  const hospital = hospitals.find((h) => h.id === req.params.hospitalId);
  if (!hospital) return res.status(404).json({ error: "Hospital not found" });

  const definition = getDefinition(req.params.standardCode);
  if (!definition) return res.status(404).json({ error: "Standard not found" });

  const { kind, processIndex, title, body } = req.body as {
    kind?: TemplateDraftKind;
    processIndex?: number | null;
    title?: string;
    body?: string;
  };

  if (!isTemplateDraftKind(kind)) {
    return res.status(400).json({ error: "Invalid template draft type" });
  }

  const trimmedTitle = String(title || "").trim();
  const trimmedBody = String(body || "").trim();
  if (!trimmedTitle || !trimmedBody) {
    return res.status(400).json({ error: "Template drafts require a title and body" });
  }

  const state = ensureState(req.params.hospitalId, definition.code);
  const hospitalProcess = getEffectiveHospitalProcess(definition, state);
  const normalizedProcessIndex = kind === "process-step"
    ? (Number.isInteger(processIndex) ? Number(processIndex) : -1)
    : null;

  if (kind === "process-step") {
    if (normalizedProcessIndex === null || normalizedProcessIndex < 0 || normalizedProcessIndex >= hospitalProcess.length) {
      return res.status(400).json({ error: "Invalid process step index for template draft" });
    }
  }

  const existingIndex = templateDrafts.findIndex((item) =>
    item.hospitalId === req.params.hospitalId
    && item.standardCode === definition.code
    && item.kind === kind
    && item.processIndex === normalizedProcessIndex
  );
  const timestamp = new Date().toISOString();
  const existing = existingIndex >= 0 ? templateDrafts[existingIndex] : null;
  const draft: TemplateDraft = {
    id: existing?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    hospitalId: req.params.hospitalId,
    standardCode: definition.code,
    kind,
    processIndex: normalizedProcessIndex,
    title: trimmedTitle,
    body: trimmedBody,
    createdAt: existing?.createdAt || timestamp,
    createdBy: existing?.createdBy || context.userName,
    updatedAt: timestamp,
    updatedBy: context.userName,
    revisionHistory: existing
      ? [buildTemplateDraftRevisionSnapshot(existing), ...existing.revisionHistory].slice(0, 20)
      : []
  };

  if (existingIndex >= 0) {
    templateDrafts[existingIndex] = draft;
  } else {
    templateDrafts.unshift(draft);
  }

  addAuditLog(
    req.params.hospitalId,
    definition.code,
    existing ? "template-draft-updated" : "template-draft-created",
    `${kind}${normalizedProcessIndex !== null ? ` step ${normalizedProcessIndex + 1}` : ""}: ${trimmedTitle}`,
    context
  );
  await persist();

  return res.json(draft);
});

app.post("/api/hospitals/:hospitalId/standards/:standardCode/template-drafts/:draftId/restore", async (req: Request, res: Response) => {
  const context = getContext(req);
  if (context.userRole === "auditor") return res.status(403).json({ error: "Auditors have read-only access" });

  const definition = getDefinition(req.params.standardCode);
  if (!definition) return res.status(404).json({ error: "Standard not found" });

  const draft = templateDrafts.find((item) => item.id === req.params.draftId && item.hospitalId === req.params.hospitalId && item.standardCode === definition.code);
  if (!draft) return res.status(404).json({ error: "Template draft not found" });

  const revisionId = String((req.body as { revisionId?: string }).revisionId || "").trim();
  const revisionIndex = draft.revisionHistory.findIndex((item) => item.id === revisionId);
  if (revisionIndex < 0) return res.status(404).json({ error: "Template draft revision not found" });

  const revision = draft.revisionHistory[revisionIndex];
  const currentSnapshot = buildTemplateDraftRevisionSnapshot(draft);
  draft.title = revision.title;
  draft.body = revision.body;
  draft.updatedAt = new Date().toISOString();
  draft.updatedBy = context.userName;
  draft.revisionHistory = [currentSnapshot, ...draft.revisionHistory.filter((item) => item.id !== revisionId)].slice(0, 20);

  addAuditLog(req.params.hospitalId, definition.code, "template-draft-restored", `${draft.kind}${draft.processIndex !== null ? ` step ${draft.processIndex + 1}` : ""}: ${draft.title}`, context);
  await persist();
  return res.json(draft);
});

app.delete("/api/hospitals/:hospitalId/standards/:standardCode/template-drafts/:draftId", async (req: Request, res: Response) => {
  const context = getContext(req);
  if (context.userRole === "auditor") return res.status(403).json({ error: "Auditors have read-only access" });

  const definition = getDefinition(req.params.standardCode);
  if (!definition) return res.status(404).json({ error: "Standard not found" });

  const existingIndex = templateDrafts.findIndex((item) => item.id === req.params.draftId && item.hospitalId === req.params.hospitalId && item.standardCode === definition.code);
  if (existingIndex < 0) return res.status(404).json({ error: "Template draft not found" });

  const [deletedDraft] = templateDrafts.splice(existingIndex, 1);
  committeeMeetings = committeeMeetings.map((meeting) => {
    if (meeting.hospitalId !== req.params.hospitalId) return meeting;
    const nextAppendices = meeting.appendices.filter((appendix) => !(appendix.sourceType === "template-draft" && appendix.sourceId === deletedDraft.id));
    return nextAppendices.length === meeting.appendices.length
      ? meeting
      : {
          ...meeting,
          appendices: nextAppendices,
          updatedAt: new Date().toISOString(),
          updatedBy: context.userName
        };
  });

  addAuditLog(req.params.hospitalId, definition.code, "template-draft-deleted", `${deletedDraft.kind}${deletedDraft.processIndex !== null ? ` step ${deletedDraft.processIndex + 1}` : ""}: ${deletedDraft.title}`, context);
  await persist();
  return res.status(204).send();
});

app.post("/api/hospitals/:hospitalId/standards/:standardCode/metrics", (req: Request, res: Response) => {
  const context = getContext(req);
  if (context.userRole === "auditor") return res.status(403).json({ error: "Auditors have read-only access" });

  const definition = getDefinition(req.params.standardCode);
  if (!definition) return res.status(404).json({ error: "Standard not found" });

  const state = ensureState(req.params.hospitalId, definition.code);
  const { componentsComplete, denominatorValue } = req.body as {
    componentsComplete?: boolean[];
    denominatorValue?: number;
  };

  if (Array.isArray(componentsComplete)) {
    if (componentsComplete.length !== state.metricLabels.length) {
      return res.status(400).json({ error: "componentsComplete length mismatch" });
    }
    state.componentsComplete = componentsComplete;
  }

  if (!isMetricsOnlyStandard(definition) && definition.denominator.mode === "editable" && typeof denominatorValue === "number") {
    if (!Number.isFinite(denominatorValue) || denominatorValue < 1) {
      return res.status(400).json({ error: "denominatorValue must be a number greater than or equal to 1" });
    }
    state.denominatorValue = Math.round(denominatorValue);
  }

  state.lastUpdatedAt = new Date().toISOString();
  state.lastUpdatedBy = context.userName;

  const results = calculate(req.params.hospitalId, definition, state);
  addAuditLog(req.params.hospitalId, definition.code, "metrics-updated", `Numerator ${results.numerator}/${results.denominator} (${results.compliancePercent}%)`, context);
  persist();

  return res.json({ state, results });
});


app.patch("/api/hospitals/:hospitalId/standards/:standardCode/metric-labels", (req: Request, res: Response) => {
  const context = getContext(req);
  if (context.userRole === "auditor") return res.status(403).json({ error: "Auditors have read-only access" });

  const definition = getDefinition(req.params.standardCode);
  if (!definition) return res.status(404).json({ error: "Standard not found" });

  const state = ensureState(req.params.hospitalId, definition.code);

  const { metricLabels } = req.body as { metricLabels?: string[] };
  if (!Array.isArray(metricLabels) || metricLabels.length === 0) {
    return res.status(400).json({ error: "metricLabels must be a non-empty array" });
  }

  const cleaned = metricLabels.map((x) => String(x || "").trim()).filter((x) => x.length > 0);
  if (cleaned.length === 0) return res.status(400).json({ error: "At least one non-empty metric label is required" });

  const requiredCount = getRequiredMetricCount(req.params.hospitalId, definition);
  if (cleaned.length < requiredCount) {
    return res.status(400).json({ error: `At least ${requiredCount} required metric lines must remain in place` });
  }
  if (new Set(cleaned.map((label) => label.toLowerCase())).size !== cleaned.length) {
    return res.status(400).json({ error: "Metric labels must be unique" });
  }

  const nextComplete = cleaned.map((_, idx) => Boolean(state.componentsComplete[idx]));
  state.metricLabels = cleaned;
  state.componentsComplete = nextComplete;
  state.lastUpdatedAt = new Date().toISOString();
  state.lastUpdatedBy = context.userName;

  addAuditLog(req.params.hospitalId, definition.code, "metric-labels-updated", `Updated metric wording (${cleaned.length} labels, ${Math.max(cleaned.length - requiredCount, 0)} extra tracking lines)`, context);
  persist();

  const results = calculate(req.params.hospitalId, definition, state);
  return res.json({ state, results });
});
app.post("/api/hospitals/:hospitalId/standards/:standardCode/status", (req: Request, res: Response) => {
  const context = getContext(req);
  const definition = getDefinition(req.params.standardCode);
  if (!definition) return res.status(404).json({ error: "Standard not found" });

  const state = ensureState(req.params.hospitalId, definition.code);
  const { status, lockNote } = req.body as { status?: StandardStatus; lockNote?: string };

  if (!status || !["in-progress", "ready-for-admin", "locked"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }


  if (context.userRole === "auditor") {
    return res.status(403).json({ error: "Auditors have read-only access" });
  }

  state.status = status;
  state.lockNote = lockNote || state.lockNote;
  state.lastUpdatedAt = new Date().toISOString();
  state.lastUpdatedBy = context.userName;

  addAuditLog(req.params.hospitalId, definition.code, "status-updated", `Status changed to ${status}`, context);
  persist();

  const results = calculate(req.params.hospitalId, definition, state);
  return res.json({ state, results });
});

app.get("/api/hospitals/:hospitalId/standards/:standardCode/uploads", (req: Request, res: Response) => {
  const list = uploads.filter((u) => u.hospitalId === req.params.hospitalId && u.standardCode === req.params.standardCode);
  return res.json(list);
});

app.post("/api/hospitals/:hospitalId/standards/:standardCode/uploads", upload.single("file"), (req: Request, res: Response) => {
  const context = getContext(req);
  if (context.userRole === "auditor") return res.status(403).json({ error: "Auditors have read-only access" });

  const definition = getDefinition(req.params.standardCode);
  if (!definition) return res.status(404).json({ error: "Standard not found" });
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const item: UploadItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    hospitalId: req.params.hospitalId,
    standardCode: req.params.standardCode,
    originalName: req.file.originalname,
    storedName: req.file.filename,
    filePath: `/uploads/${req.file.filename}`,
    sizeBytes: req.file.size,
    uploadedAt: new Date().toISOString(),
    uploadedBy: context.userName
  };

  uploads.unshift(item);
  addAuditLog(req.params.hospitalId, req.params.standardCode, "evidence-uploaded", `Uploaded ${item.originalName}`, context);
  persist();

  return res.status(201).json(item);
});

app.get("/api/hospitals/:hospitalId/standards/:standardCode/assignments", (req: Request, res: Response) => {
  const list = assignments.filter((a) => a.hospitalId === req.params.hospitalId && a.standardCode === req.params.standardCode);
  return res.json(list);
});

app.post("/api/hospitals/:hospitalId/standards/:standardCode/assignments", (req: Request, res: Response) => {
  const context = getContext(req);
  if (context.userRole === "auditor") return res.status(403).json({ error: "Auditors have read-only access" });

  const definition = getDefinition(req.params.standardCode);
  if (!definition) return res.status(404).json({ error: "Standard not found" });

  const { componentLabel, assignee, dueDate } = req.body as { componentLabel?: string; assignee?: string; dueDate?: string };

  if (!componentLabel || !assignee || !dueDate) {
    return res.status(400).json({ error: "componentLabel, assignee, and dueDate are required" });
  }

  const item: AssignmentItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    hospitalId: req.params.hospitalId,
    standardCode: req.params.standardCode,
    componentLabel,
    assignee,
    dueDate,
    status: "open",
    updatedAt: new Date().toISOString(),
    updatedBy: context.userName
  };

  assignments.unshift(item);
  addAuditLog(req.params.hospitalId, req.params.standardCode, "assignment-created", `${componentLabel} assigned to ${assignee}`, context);
  persist();

  return res.status(201).json(item);
});

app.patch("/api/hospitals/:hospitalId/standards/:standardCode/assignments/:assignmentId", (req: Request, res: Response) => {
  const context = getContext(req);
  if (context.userRole === "auditor") return res.status(403).json({ error: "Auditors have read-only access" });

  const found = assignments.find(
    (entry) =>
      entry.id === req.params.assignmentId &&
      entry.hospitalId === req.params.hospitalId &&
      entry.standardCode === req.params.standardCode
  );

  if (!found) return res.status(404).json({ error: "Assignment not found" });

  const { status, dueDate, assignee } = req.body as { status?: "open" | "done"; dueDate?: string; assignee?: string };

  if (status) found.status = status;
  if (dueDate) found.dueDate = dueDate;
  if (assignee) found.assignee = assignee;
  found.updatedAt = new Date().toISOString();
  found.updatedBy = context.userName;

  addAuditLog(req.params.hospitalId, req.params.standardCode, "assignment-updated", `Assignment ${found.id} updated`, context);
  persist();

  return res.json(found);
});


app.get("/api/hospitals/:hospitalId/standards/:standardCode/quality-metric-library", (req: Request, res: Response) => {
  const definition = getDefinition(req.params.standardCode);
  if (!definition) return res.status(404).json({ error: "Standard not found" });
  return res.json(qualityMetricLibraryByCategory[definition.category] || []);
});

app.get("/api/hospitals/:hospitalId/standards/:standardCode/custom-quality-metrics", (req: Request, res: Response) => {
  return res.json(customQualityMetrics.filter((m) => m.hospitalId === req.params.hospitalId && m.standardCode === req.params.standardCode));
});

app.post("/api/hospitals/:hospitalId/standards/:standardCode/custom-quality-metrics", (req: Request, res: Response) => {
  const context = getContext(req);
  if (context.userRole === "auditor") return res.status(403).json({ error: "Auditors have read-only access" });

  const definition = getDefinition(req.params.standardCode);
  if (!definition) return res.status(404).json({ error: "Standard not found" });

  const { framework, title, description, target } = req.body as {
    framework?: AccreditationFramework;
    title?: string;
    description?: string;
    target?: string;
  };

  if (!title || !target) {
    return res.status(400).json({ error: "title and target are required" });
  }

  const now = new Date().toISOString();
  const item: CustomQualityMetric = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    hospitalId: req.params.hospitalId,
    standardCode: req.params.standardCode,
    framework: normalizeAccreditationFramework(framework),
    title: title.trim(),
    description: (description || "").trim(),
    target: target.trim(),
    status: "active",
    createdAt: now,
    updatedAt: now,
    createdBy: context.userName,
    updatedBy: context.userName
  };

  customQualityMetrics.unshift(item);
  addAuditLog(req.params.hospitalId, req.params.standardCode, "custom-quality-metric-created", `${item.framework}: ${item.title}`, context);
  persist();
  return res.status(201).json(item);
});

app.patch("/api/hospitals/:hospitalId/standards/:standardCode/custom-quality-metrics/:metricId", (req: Request, res: Response) => {
  const context = getContext(req);
  if (context.userRole === "auditor") return res.status(403).json({ error: "Auditors have read-only access" });

  const found = customQualityMetrics.find((m) =>
    m.id === req.params.metricId &&
    m.hospitalId === req.params.hospitalId &&
    m.standardCode === req.params.standardCode
  );
  if (!found) return res.status(404).json({ error: "Custom quality metric not found" });

  const { framework, title, description, target, status } = req.body as Partial<CustomQualityMetric>;
  if (framework) found.framework = normalizeAccreditationFramework(framework);
  if (typeof title === "string" && title.trim()) found.title = title.trim();
  if (typeof description === "string") found.description = description.trim();
  if (typeof target === "string" && target.trim()) found.target = target.trim();
  if (status && ["active", "met", "needs-review", "paused"].includes(status)) found.status = status as CustomQualityMetric["status"];

  found.updatedAt = new Date().toISOString();
  found.updatedBy = context.userName;

  addAuditLog(req.params.hospitalId, req.params.standardCode, "custom-quality-metric-updated", `${found.framework}: ${found.title}`, context);
  persist();

  return res.json(found);
});

app.delete("/api/hospitals/:hospitalId/standards/:standardCode/custom-quality-metrics/:metricId", (req: Request, res: Response) => {
  const context = getContext(req);
  if (context.userRole === "auditor") return res.status(403).json({ error: "Auditors have read-only access" });

  const before = customQualityMetrics.length;
  customQualityMetrics = customQualityMetrics.filter((m) => !(
    m.id === req.params.metricId &&
    m.hospitalId === req.params.hospitalId &&
    m.standardCode === req.params.standardCode
  ));

  if (customQualityMetrics.length === before) {
    return res.status(404).json({ error: "Custom quality metric not found" });
  }

  addAuditLog(req.params.hospitalId, req.params.standardCode, "custom-quality-metric-deleted", `Deleted custom quality metric ${req.params.metricId}`, context);
  persist();
  return res.status(204).send();
});

app.post("/api/hospitals/:hospitalId/standards/:standardCode/custom-quality-metrics/import-templates", (req: Request, res: Response) => {
  const context = getContext(req);
  if (context.userRole === "auditor") return res.status(403).json({ error: "Auditors have read-only access" });

  const hospital = hospitals.find((h) => h.id === req.params.hospitalId);
  if (!hospital) return res.status(404).json({ error: "Hospital not found" });

  const definition = getDefinition(req.params.standardCode);
  if (!definition) return res.status(404).json({ error: "Standard not found" });

  const templates = qualityMetricLibraryByCategory[definition.category] || [];
  let created = 0;

  for (const tpl of templates) {
    const exists = customQualityMetrics.some((m) =>
      m.hospitalId === hospital.id &&
      m.standardCode === definition.code &&
      m.framework === tpl.framework &&
      m.title.toLowerCase() === tpl.title.toLowerCase()
    );

    if (exists) continue;

    const now = new Date().toISOString();
    customQualityMetrics.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      hospitalId: hospital.id,
      standardCode: definition.code,
      framework: tpl.framework,
      title: tpl.title,
      description: tpl.description,
      target: tpl.target,
      status: "active",
      createdAt: now,
      updatedAt: now,
      createdBy: context.userName,
      updatedBy: context.userName
    });
    created += 1;
  }

  addAuditLog(hospital.id, definition.code, "quality-metric-templates-imported", `Imported ${created} template metrics`, context);
  persist();
  return res.json({ created, totalTemplates: templates.length });
});

app.get("/api/hospitals/:hospitalId/custom-quality-metrics/summary", (req: Request, res: Response) => {
  const hospital = hospitals.find((h) => h.id === req.params.hospitalId);
  if (!hospital) return res.status(404).json({ error: "Hospital not found" });

  const metrics = customQualityMetrics.filter((m) => m.hospitalId === hospital.id);
  const frameworks: AccreditationFramework[] = supportedAccreditationFrameworks;
  const statuses: Array<"active" | "met" | "needs-review" | "paused"> = ["active", "met", "needs-review", "paused"];

  const byFramework = frameworks.map((framework) => {
    const slice = metrics.filter((m) => m.framework === framework);
    const byStatus = statuses.reduce((acc, status) => {
      acc[status] = slice.filter((m) => m.status === status).length;
      return acc;
    }, {} as Record<string, number>);

    return {
      framework,
      total: slice.length,
      byStatus
    };
  });

  const byStandard = standards.map((s) => {
    const slice = metrics.filter((m) => m.standardCode === s.code);
    return {
      standardCode: s.code,
      standardName: s.name,
      category: s.category,
      total: slice.length,
      met: slice.filter((m) => m.status === "met").length,
      needsReview: slice.filter((m) => m.status === "needs-review").length
    };
  }).filter((row) => row.total > 0);

  return res.json({
    hospital,
    total: metrics.length,
    byFramework,
    byStandard
  });
});

app.get("/api/hospitals/:hospitalId/custom-quality-metrics.csv", (req: Request, res: Response) => {
  const hospital = hospitals.find((h) => h.id === req.params.hospitalId);
  if (!hospital) return res.status(404).json({ error: "Hospital not found" });

  const escapeCsv = (value: string): string => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const rows = customQualityMetrics
    .filter((m) => m.hospitalId === hospital.id)
    .map((m) => {
      const standard = standards.find((s) => s.code === m.standardCode);
      return [
        m.id,
        hospital.id,
        hospital.name,
        m.standardCode,
        standard?.name || "",
        standard?.category || "",
        m.framework,
        m.title,
        m.description,
        m.target,
        m.status,
        m.createdAt,
        m.updatedAt,
        m.createdBy,
        m.updatedBy
      ].map(escapeCsv).join(",");
    });

  const header = [
    "id",
    "hospitalId",
    "hospitalName",
    "standardCode",
    "standardName",
    "category",
    "framework",
    "title",
    "description",
    "target",
    "status",
    "createdAt",
    "updatedAt",
    "createdBy",
    "updatedBy"
  ].join(",");

  const csv = [header, ...rows].join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=custom-quality-metrics-${hospital.id}.csv`);
  return res.status(200).send(csv);
});
app.get("/api/hospitals/:hospitalId/audit-logs", (req: Request, res: Response) => {
  const logs = auditLog.filter((entry) => entry.hospitalId === req.params.hospitalId).slice(0, 500);
  return res.json(logs);
});

app.get("/api/hospitals/:hospitalId/auditor-export", (req: Request, res: Response) => {
  const hospital = hospitals.find((h) => h.id === req.params.hospitalId);
  if (!hospital) return res.status(404).json({ error: "Hospital not found" });

  const packageData = standards
    .map((definition) => {
      const state = ensureState(hospital.id, definition.code);
      if (state.status !== "locked") return null;

      const results = calculate(hospital.id, definition, state);
      const stdUploads = uploads.filter((e) => e.hospitalId === hospital.id && e.standardCode === definition.code);
      const stdAssignments = assignments.filter((e) => e.hospitalId === hospital.id && e.standardCode === definition.code);
      const stdProcessDocuments = processDocuments.filter((e) => e.hospitalId === hospital.id && e.standardCode === definition.code);

      return {
        code: definition.code,
        name: definition.name,
        category: definition.category,
      framework: definition.framework,
        status: state.status,
        compliancePercent: results.compliancePercent,
        meets: results.meets,
        numerator: results.numerator,
        denominator: results.denominator,
        thresholdLabel: definition.threshold.label,
        lockNote: state.lockNote,
        uploadCount: stdUploads.length,
        assignmentCount: stdAssignments.length,
        numeratorComponents: state.metricLabels.map((label, idx) => ({
          label,
          complete: state.componentsComplete[idx] || false
        })),
        assignments: stdAssignments,
        uploads: stdUploads,
        processDocuments: stdProcessDocuments
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return res.json({
    hospital,
    generatedAt: new Date().toISOString(),
    standards: packageData,
    auditLogs: auditLog.filter((entry) => entry.hospitalId === hospital.id)
  });
});


// Process quarter check endpoint
app.patch("/api/hospitals/:hospitalId/standards/:standardCode/process-quarters", (req: Request, res: Response) => {
  const context = getContext(req);
  if (context.userRole === "auditor") return res.status(403).json({ error: "Auditors cannot update process quarter checks" });

  const definition = getDefinition(req.params.standardCode);
  if (!definition) return res.status(404).json({ error: "Standard not found" });

  const state = ensureState(req.params.hospitalId, definition.code);
  const hospitalProcess = getEffectiveHospitalProcess(definition, state);
  const { processIndex, quarter, checked } = req.body as { processIndex: number; quarter: string; checked: boolean };

  if (typeof processIndex !== "number" || !quarter || typeof checked !== "boolean") {
    return res.status(400).json({ error: "processIndex (number), quarter (string), and checked (boolean) are required" });
  }

  const validQuarters = ["Q1", "Q2", "Q3", "Q4"];
  if (!validQuarters.includes(quarter)) {
    return res.status(400).json({ error: "quarter must be Q1, Q2, Q3, or Q4" });
  }

  if (processIndex < 0 || processIndex >= hospitalProcess.length) {
    return res.status(400).json({ error: "processIndex out of range" });
  }

  const key = String(processIndex);
  if (!state.processQuarterChecks[key]) {
    state.processQuarterChecks[key] = { Q1: false, Q2: false, Q3: false, Q4: false };
  }
  state.processQuarterChecks[key][quarter] = checked;
  state.lastUpdatedAt = new Date().toISOString();
  state.lastUpdatedBy = context.userName;

  addAuditLog(req.params.hospitalId, definition.code, "process-quarter-updated",
    `Process step ${processIndex + 1} ${quarter} marked ${checked ? "complete" : "incomplete"}`, context);
  persist();

  return res.json({ processQuarterChecks: state.processQuarterChecks });
});

app.patch("/api/hospitals/:hospitalId/standards/:standardCode/process-visibility", (req: Request, res: Response) => {
  const context = getContext(req);
  if (context.userRole === "auditor") return res.status(403).json({ error: "Auditors have read-only access" });

  const definition = getDefinition(req.params.standardCode);
  if (!definition) return res.status(404).json({ error: "Standard not found" });

  const state = ensureState(req.params.hospitalId, definition.code);
  const hospitalProcess = getEffectiveHospitalProcess(definition, state);
  const { processIndex, hidden } = req.body as { processIndex: number; hidden: boolean };

  if (typeof processIndex !== "number" || typeof hidden !== "boolean") {
    return res.status(400).json({ error: "processIndex (number) and hidden (boolean) are required" });
  }

  if (processIndex < 0 || processIndex >= hospitalProcess.length) {
    return res.status(400).json({ error: "processIndex out of range" });
  }

  state.processHiddenSteps[String(processIndex)] = hidden;
  state.lastUpdatedAt = new Date().toISOString();
  state.lastUpdatedBy = context.userName;

  addAuditLog(req.params.hospitalId, definition.code, "process-visibility-updated", `Process step ${processIndex + 1} marked ${hidden ? "not needed" : "required"}`, context);
  persist();

  return res.json({ processHiddenSteps: state.processHiddenSteps });
});

// Process documents upload
app.post("/api/hospitals/:hospitalId/standards/:standardCode/process-docs", upload.single("file"), (req: Request, res: Response) => {
  const context = getContext(req);
  if (context.userRole === "auditor") return res.status(403).json({ error: "Auditors have read-only access" });

  const definition = getDefinition(req.params.standardCode);
  if (!definition) return res.status(404).json({ error: "Standard not found" });
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const state = ensureState(req.params.hospitalId, definition.code);
  const hospitalProcess = getEffectiveHospitalProcess(definition, state);
  const processIndex = parseInt(String(req.body.processIndex), 10);
  if (isNaN(processIndex) || processIndex < 0 || processIndex >= hospitalProcess.length) {
    return res.status(400).json({ error: "Invalid processIndex" });
  }

  const item: ProcessDocument = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    hospitalId: req.params.hospitalId,
    standardCode: req.params.standardCode,
    processIndex,
    originalName: req.file.originalname,
    storedName: req.file.filename,
    filePath: `/uploads/${req.file.filename}`,
    sizeBytes: req.file.size,
    uploadedAt: new Date().toISOString(),
    uploadedBy: context.userName
  };

  processDocuments.unshift(item);
  addAuditLog(req.params.hospitalId, req.params.standardCode, "process-doc-uploaded",
    `Process step ${processIndex + 1}: uploaded ${item.originalName}`, context);
  persist();

  return res.status(201).json(item);
});

// Delete process document
app.delete("/api/hospitals/:hospitalId/standards/:standardCode/process-docs/:docId", (req: Request, res: Response) => {
  const context = getContext(req);
  if (context.userRole === "auditor") return res.status(403).json({ error: "Auditors have read-only access" });

  const before = processDocuments.length;
  const doc = processDocuments.find((d) =>
    d.id === req.params.docId &&
    d.hospitalId === req.params.hospitalId &&
    d.standardCode === req.params.standardCode
  );

  if (!doc) return res.status(404).json({ error: "Process document not found" });

  processDocuments = processDocuments.filter((d) => d.id !== req.params.docId);
  addAuditLog(req.params.hospitalId, req.params.standardCode, "process-doc-deleted",
    `Process step ${doc.processIndex + 1}: deleted ${doc.originalName}`, context);
  persist();
  return res.status(204).send();
});


app.post("/api/hospitals/:hospitalId/standards/:standardCode/quarterly-evidence", upload.single("file"), (req: Request, res: Response) => {
  const context = getContext(req);
  if (context.userRole === "auditor") return res.status(403).json({ error: "Auditors have read-only access" });

  const hospital = hospitals.find((h) => h.id === req.params.hospitalId);
  if (!hospital) return res.status(404).json({ error: "Hospital not found" });

  const definition = getDefinition(req.params.standardCode);
  if (!definition) return res.status(404).json({ error: "Standard not found" });
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const quarter = String(req.body.quarter || "").trim();
  if (!["Q1", "Q2", "Q3", "Q4"].includes(quarter)) {
    return res.status(400).json({ error: "quarter must be Q1, Q2, Q3, or Q4" });
  }

  const item: QuarterlyEvidenceItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    hospitalId: hospital.id,
    standardCode: definition.code,
    quarter: quarter as QuarterlyEvidenceItem["quarter"],
    originalName: req.file.originalname,
    storedName: req.file.filename,
    filePath: `/uploads/${req.file.filename}`,
    sizeBytes: req.file.size,
    uploadedAt: new Date().toISOString(),
    uploadedBy: context.userName
  };

  quarterlyEvidence.unshift(item);
  if (definition.code === "2.2") {
    syncStandard22QuarterEvidenceState(hospital.id, context.userName);
  }
  addAuditLog(hospital.id, definition.code, "quarterly-evidence-uploaded", `${item.quarter}: ${item.originalName}`, context);
  persist();
  return res.status(201).json(item);
});

app.delete("/api/hospitals/:hospitalId/standards/:standardCode/quarterly-evidence/:evidenceId", (req: Request, res: Response) => {
  const context = getContext(req);
  if (context.userRole === "auditor") return res.status(403).json({ error: "Auditors have read-only access" });

  const found = quarterlyEvidence.find(
    (item) => item.id === req.params.evidenceId && item.hospitalId === req.params.hospitalId && item.standardCode === req.params.standardCode
  );
  if (!found) return res.status(404).json({ error: "Quarterly evidence not found" });

  quarterlyEvidence = quarterlyEvidence.filter((item) => item.id !== req.params.evidenceId);
  if (req.params.standardCode === "2.2") {
    syncStandard22QuarterEvidenceState(req.params.hospitalId, context.userName);
  }
  addAuditLog(req.params.hospitalId, req.params.standardCode, "quarterly-evidence-deleted", `${found.quarter}: ${found.originalName}`, context);
  persist();
  return res.status(204).send();
});

app.get("/api/hospitals/:hospitalId/strategy-checklist", (req: Request, res: Response) => {
  const hospital = hospitals.find((h) => h.id === req.params.hospitalId);
  if (!hospital) return res.status(404).json({ error: "Hospital not found" });
  ensureStrategyChecklist(hospital.id);
  return res.json(strategyChecklistItems.filter((item) => item.hospitalId === hospital.id));
});

app.patch("/api/hospitals/:hospitalId/strategy-checklist/:itemId", (req: Request, res: Response) => {
  const context = getContext(req);
  if (context.userRole === "auditor") return res.status(403).json({ error: "Auditors have read-only access" });

  const found = strategyChecklistItems.find((item) => item.id === req.params.itemId && item.hospitalId === req.params.hospitalId);
  if (!found) return res.status(404).json({ error: "Strategy checklist item not found" });

  const { checked, notes } = req.body as Partial<StrategyChecklistItem>;
  if (typeof checked === "boolean") found.checked = checked;
  if (typeof notes === "string") found.notes = notes.trim();
  found.updatedAt = new Date().toISOString();
  found.updatedBy = context.userName;

  addAuditLog(req.params.hospitalId, found.standardCode || "GLOBAL", "strategy-checklist-updated", found.title, context);
  persist();
  return res.json(found);
});

app.get("/api/hospitals/:hospitalId/prq-war-room-items", (req: Request, res: Response) => {
  const hospital = hospitals.find((h) => h.id === req.params.hospitalId);
  if (!hospital) return res.status(404).json({ error: "Hospital not found" });
  return res.json(prqWarRoomItems.filter((item) => item.hospitalId === hospital.id));
});

app.post("/api/hospitals/:hospitalId/prq-war-room-items", (req: Request, res: Response) => {
  const context = getContext(req);
  if (context.userRole === "auditor") return res.status(403).json({ error: "Auditors have read-only access" });
  const hospital = hospitals.find((h) => h.id === req.params.hospitalId);
  if (!hospital) return res.status(404).json({ error: "Hospital not found" });
  const { title, category, owner, dueDate, notes } = req.body as Partial<PrqWarRoomItem>;
  if (!title || !owner || !dueDate) return res.status(400).json({ error: "title, owner, and dueDate are required" });
  const item: PrqWarRoomItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    hospitalId: hospital.id,
    title: String(title).trim(),
    category: ["PRQ", "Site Review", "Evidence", "Policy", "Other"].includes(String(category)) ? category as PrqWarRoomItem["category"] : "PRQ",
    owner: String(owner).trim(),
    dueDate: String(dueDate),
    status: "not-started",
    notes: String(notes || "").trim(),
    updatedAt: new Date().toISOString(),
    updatedBy: context.userName
  };
  prqWarRoomItems.unshift(item);
  addAuditLog(hospital.id, "GLOBAL", "prq-war-room-item-created", item.title, context);
  persist();
  return res.status(201).json(item);
});

app.patch("/api/hospitals/:hospitalId/prq-war-room-items/:itemId", (req: Request, res: Response) => {
  const context = getContext(req);
  if (context.userRole === "auditor") return res.status(403).json({ error: "Auditors have read-only access" });
  const found = prqWarRoomItems.find((item) => item.id === req.params.itemId && item.hospitalId === req.params.hospitalId);
  if (!found) return res.status(404).json({ error: "PRQ war room item not found" });
  const { title, category, owner, dueDate, status, notes } = req.body as Partial<PrqWarRoomItem>;
  if (typeof title === "string" && title.trim()) found.title = title.trim();
  if (typeof owner === "string" && owner.trim()) found.owner = owner.trim();
  if (typeof dueDate === "string" && dueDate.trim()) found.dueDate = dueDate;
  if (typeof notes === "string") found.notes = notes.trim();
  if (category && ["PRQ", "Site Review", "Evidence", "Policy", "Other"].includes(category)) found.category = category as PrqWarRoomItem["category"];
  if (status && ["not-started", "collecting", "ready", "blocked"].includes(status)) found.status = status as PrqWarRoomItem["status"];
  found.updatedAt = new Date().toISOString();
  found.updatedBy = context.userName;
  addAuditLog(req.params.hospitalId, "GLOBAL", "prq-war-room-item-updated", found.title, context);
  persist();
  return res.json(found);
});

app.delete("/api/hospitals/:hospitalId/prq-war-room-items/:itemId", (req: Request, res: Response) => {
  const context = getContext(req);
  if (context.userRole === "auditor") return res.status(403).json({ error: "Auditors have read-only access" });
  const found = prqWarRoomItems.find((item) => item.id === req.params.itemId && item.hospitalId === req.params.hospitalId);
  if (!found) return res.status(404).json({ error: "PRQ war room item not found" });
  prqWarRoomItems = prqWarRoomItems.filter((item) => item.id !== req.params.itemId);
  addAuditLog(req.params.hospitalId, "GLOBAL", "prq-war-room-item-deleted", found.title, context);
  persist();
  return res.status(204).send();
});

app.get("/api/hospitals/:hospitalId/committee-people", (req: Request, res: Response) => {
  const hospital = hospitals.find((h) => h.id === req.params.hospitalId);
  if (!hospital) return res.status(404).json({ error: "Hospital not found" });
  return res.json(committeePeople.filter((item) => item.hospitalId === hospital.id));
});

app.post("/api/hospitals/:hospitalId/committee-people", (req: Request, res: Response) => {
  const context = getContext(req);
  if (context.userRole === "auditor") return res.status(403).json({ error: "Auditors have read-only access" });

  const hospital = hospitals.find((h) => h.id === req.params.hospitalId);
  if (!hospital) return res.status(404).json({ error: "Hospital not found" });

  const { name, degrees } = req.body as Partial<CommitteePerson>;
  if (!name || !String(name).trim()) return res.status(400).json({ error: "name is required" });

  const item: CommitteePerson = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    hospitalId: hospital.id,
    name: String(name).trim(),
    degrees: String(degrees || "").trim(),
    updatedAt: new Date().toISOString(),
    updatedBy: context.userName
  };

  committeePeople.unshift(item);
  addAuditLog(hospital.id, "2.1", "committee-person-created", `${item.name}${item.degrees ? `, ${item.degrees}` : ""}`, context);
  persist();
  return res.status(201).json(item);
});

app.get("/api/hospitals/:hospitalId/standards/:standardCode/role-assignments", (req: Request, res: Response) => {
  const hospital = hospitals.find((h) => h.id === req.params.hospitalId);
  if (!hospital) return res.status(404).json({ error: "Hospital not found" });

  const definition = getDefinition(req.params.standardCode);
  if (!definition) return res.status(404).json({ error: "Standard not found" });

  return res.json({
    roleList: getRoleListForStandard(hospital.id, definition.code),
    assignments: standardRoleAssignments.filter((item) => item.hospitalId === hospital.id && item.standardCode === definition.code)
  });
});

app.post("/api/hospitals/:hospitalId/standards/:standardCode/role-assignments", (req: Request, res: Response) => {
  const context = getContext(req);
  if (context.userRole === "auditor") return res.status(403).json({ error: "Auditors have read-only access" });

  const hospital = hospitals.find((h) => h.id === req.params.hospitalId);
  if (!hospital) return res.status(404).json({ error: "Hospital not found" });

  const definition = getDefinition(req.params.standardCode);
  if (!definition) return res.status(404).json({ error: "Standard not found" });

  const { roleName, assignmentType, personId, personName, degrees, startDate, endDate, notes } = req.body as Partial<StandardRoleAssignment>;
  if (!roleName || !String(roleName).trim()) return res.status(400).json({ error: "roleName is required" });
  if (!startDate || !String(startDate).trim()) return res.status(400).json({ error: "startDate is required" });

  let resolvedPerson = committeePeople.find((item) => item.id === personId && item.hospitalId === hospital.id);
  if (!resolvedPerson) {
    if (!personName || !String(personName).trim()) return res.status(400).json({ error: "personId or personName is required" });
    resolvedPerson = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      hospitalId: hospital.id,
      name: String(personName).trim(),
      degrees: String(degrees || "").trim(),
      updatedAt: new Date().toISOString(),
      updatedBy: context.userName
    };
    committeePeople.unshift(resolvedPerson);
  }

  const item: StandardRoleAssignment = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    hospitalId: hospital.id,
    standardCode: definition.code,
    roleName: String(roleName).trim(),
    assignmentType: assignmentType === "alternate" ? "alternate" : "primary",
    personId: resolvedPerson.id,
    personName: resolvedPerson.name,
    degrees: resolvedPerson.degrees,
    startDate: String(startDate),
    endDate: String(endDate || ""),
    notes: String(notes || "").trim(),
    updatedAt: new Date().toISOString(),
    updatedBy: context.userName
  };

  standardRoleAssignments.unshift(item);
  syncStandardRoleState(hospital.id, definition.code, context.userName);
  addAuditLog(hospital.id, definition.code, "role-assignment-created", `${item.roleName}: ${item.personName} (${item.startDate}${item.endDate ? ` to ${item.endDate}` : " onward"})`, context);
  persist();
  return res.status(201).json(item);
});

app.patch("/api/hospitals/:hospitalId/standards/:standardCode/role-assignments/:assignmentId", (req: Request, res: Response) => {
  const context = getContext(req);
  if (context.userRole === "auditor") return res.status(403).json({ error: "Auditors have read-only access" });

  const definition = getDefinition(req.params.standardCode);
  if (!definition) return res.status(404).json({ error: "Standard not found" });

  const found = standardRoleAssignments.find(
    (item) => item.id === req.params.assignmentId && item.hospitalId === req.params.hospitalId && item.standardCode === definition.code
  );
  if (!found) return res.status(404).json({ error: "Role assignment not found" });

  const { roleName, assignmentType, personId, personName, degrees, startDate, endDate, notes } = req.body as Partial<StandardRoleAssignment>;
  if (typeof roleName === "string" && roleName.trim()) found.roleName = roleName.trim();
  if (typeof startDate === "string" && startDate.trim()) found.startDate = startDate;
  if (typeof endDate === "string") found.endDate = endDate.trim();
  if (typeof notes === "string") found.notes = notes.trim();

  if ((typeof personId === "string" && personId.trim()) || (typeof personName === "string" && personName.trim())) {
    let resolvedPerson = committeePeople.find((item) => item.id === personId && item.hospitalId === req.params.hospitalId);
    if (!resolvedPerson && personName && String(personName).trim()) {
      resolvedPerson = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        hospitalId: req.params.hospitalId,
        name: String(personName).trim(),
        degrees: String(degrees || "").trim(),
        updatedAt: new Date().toISOString(),
        updatedBy: context.userName
      };
      committeePeople.unshift(resolvedPerson);
    }

    if (resolvedPerson) {
      found.personId = resolvedPerson.id;
      found.personName = resolvedPerson.name;
      found.degrees = resolvedPerson.degrees;
    }
  }

  found.updatedAt = new Date().toISOString();
  found.updatedBy = context.userName;
  syncStandardRoleState(req.params.hospitalId, definition.code, context.userName);
  addAuditLog(req.params.hospitalId, definition.code, "role-assignment-updated", `${found.roleName}: ${found.personName}`, context);
  persist();
  return res.json(found);
});

app.delete("/api/hospitals/:hospitalId/standards/:standardCode/role-assignments/:assignmentId", (req: Request, res: Response) => {
  const context = getContext(req);
  if (context.userRole === "auditor") return res.status(403).json({ error: "Auditors have read-only access" });

  const definition = getDefinition(req.params.standardCode);
  if (!definition) return res.status(404).json({ error: "Standard not found" });

  const found = standardRoleAssignments.find(
    (item) => item.id === req.params.assignmentId && item.hospitalId === req.params.hospitalId && item.standardCode === definition.code
  );
  if (!found) return res.status(404).json({ error: "Role assignment not found" });

  standardRoleAssignments = standardRoleAssignments.filter((item) => item.id !== req.params.assignmentId);
  committeeMeetings = committeeMeetings.map((item) => ({
    ...item,
    referencedRoleAssignmentIds: item.referencedRoleAssignmentIds.filter((entry) => entry !== req.params.assignmentId)
  }));
  syncStandardRoleState(req.params.hospitalId, definition.code, context.userName);
  addAuditLog(req.params.hospitalId, definition.code, "role-assignment-deleted", `${found.roleName}: ${found.personName}`, context);
  persist();
  return res.status(204).send();
});

app.get("/api/hospitals/:hospitalId/committee-meetings", (req: Request, res: Response) => {
  const hospital = hospitals.find((h) => h.id === req.params.hospitalId);
  if (!hospital) return res.status(404).json({ error: "Hospital not found" });
  return res.json(
    committeeMeetings
      .filter((item) => item.hospitalId === hospital.id)
      .map((item) => ({
        ...item,
        appendices: buildCommitteeMeetingAppendices(hospital.id, item.appendices, item.referencedUploadIds)
      }))
  );
});

app.post("/api/hospitals/:hospitalId/committee-meetings", (req: Request, res: Response) => {
  const context = getContext(req);
  if (context.userRole === "auditor") return res.status(403).json({ error: "Auditors have read-only access" });
  const hospital = hospitals.find((h) => h.id === req.params.hospitalId);
  if (!hospital) return res.status(404).json({ error: "Hospital not found" });
  const { title, meetingDate, quarter, presenter, conferenceCaseCount, notes, standardCodes, referencedRoleAssignmentIds, referencedUploadIds, appendices, minutes, oncoLensAssist } = req.body as Partial<CommitteeMeeting>;
  if (!title || !meetingDate) return res.status(400).json({ error: "title and meetingDate are required" });
  const validStandardCodes = Array.isArray(standardCodes)
    ? standardCodes.map((entry) => String(entry)).filter((entry) => standards.some((standard) => standard.code === entry))
    : [];
  const validRoleAssignmentIds = Array.isArray(referencedRoleAssignmentIds)
    ? referencedRoleAssignmentIds
        .map((entry) => String(entry))
        .filter((entry) => standardRoleAssignments.some((assignment) => assignment.hospitalId === hospital.id && assignment.id === entry))
    : [];
  const validUploadIds = Array.isArray(referencedUploadIds)
    ? referencedUploadIds
        .map((entry) => String(entry))
        .filter((entry) => uploads.some((uploadItem) => uploadItem.hospitalId === hospital.id && uploadItem.id === entry))
    : [];
  const item: CommitteeMeeting = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    hospitalId: hospital.id,
    title: String(title).trim(),
    meetingDate: String(meetingDate),
    quarter: ["Q1", "Q2", "Q3", "Q4"].includes(String(quarter)) ? quarter as CommitteeMeeting["quarter"] : "Q1",
    presenter: String(presenter || "").trim(),
    conferenceCaseCount: Math.max(Number(conferenceCaseCount || 0), 0),
    status: "planned",
    oncoLensAssist: oncoLensAssist !== false,
    notes: String(notes || "").trim(),
    standardCodes: validStandardCodes,
    referencedRoleAssignmentIds: validRoleAssignmentIds,
    referencedUploadIds: validUploadIds,
    appendices: buildCommitteeMeetingAppendices(hospital.id, appendices, validUploadIds),
    minutes: String(minutes || notes || "").trim(),
    roleAttendance: {},
    updatedAt: new Date().toISOString(),
    updatedBy: context.userName
  };
  committeeMeetings.unshift(item);
  syncStandard23CommitteeMeetingState(hospital.id, context.userName);
  addAuditLog(hospital.id, "GLOBAL", "committee-meeting-created", item.title, context);
  persist();
  return res.status(201).json({ ...item, appendices: buildCommitteeMeetingAppendices(hospital.id, item.appendices, item.referencedUploadIds) });
});

app.patch("/api/hospitals/:hospitalId/committee-meetings/:meetingId", (req: Request, res: Response) => {
  const context = getContext(req);
  if (context.userRole === "auditor") return res.status(403).json({ error: "Auditors have read-only access" });
  const found = committeeMeetings.find((item) => item.id === req.params.meetingId && item.hospitalId === req.params.hospitalId);
  if (!found) return res.status(404).json({ error: "Committee meeting not found" });
  const { title, meetingDate, quarter, presenter, conferenceCaseCount, status, notes, oncoLensAssist, standardCodes, referencedRoleAssignmentIds, referencedUploadIds, appendices, minutes } = req.body as Partial<CommitteeMeeting>;
  if (typeof title === "string" && title.trim()) found.title = title.trim();
  if (typeof meetingDate === "string" && meetingDate.trim()) found.meetingDate = meetingDate;
  if (typeof presenter === "string") found.presenter = presenter.trim();
  if (typeof conferenceCaseCount === "number") found.conferenceCaseCount = Math.max(conferenceCaseCount, 0);
  if (typeof notes === "string") found.notes = notes.trim();
  if (typeof minutes === "string") found.minutes = minutes.trim();
  if (typeof oncoLensAssist === "boolean") found.oncoLensAssist = oncoLensAssist;
  if (quarter && ["Q1", "Q2", "Q3", "Q4"].includes(quarter)) found.quarter = quarter as CommitteeMeeting["quarter"];
  if (status && ["planned", "agenda-ready", "held", "minutes-uploaded", "closed"].includes(status)) found.status = status as CommitteeMeeting["status"];
  if (Array.isArray(standardCodes)) {
    found.standardCodes = standardCodes.map((entry) => String(entry)).filter((entry) => standards.some((standard) => standard.code === entry));
  }
  if (Array.isArray(referencedRoleAssignmentIds)) {
    found.referencedRoleAssignmentIds = referencedRoleAssignmentIds
      .map((entry) => String(entry))
      .filter((entry) => standardRoleAssignments.some((assignment) => assignment.hospitalId === req.params.hospitalId && assignment.id === entry));
  }
  if (Array.isArray(referencedUploadIds)) {
    found.referencedUploadIds = referencedUploadIds
      .map((entry) => String(entry))
      .filter((entry) => uploads.some((uploadItem) => uploadItem.hospitalId === req.params.hospitalId && uploadItem.id === entry));
  }
  if (Array.isArray(appendices) || Array.isArray(referencedUploadIds)) {
    found.appendices = buildCommitteeMeetingAppendices(req.params.hospitalId, appendices ?? found.appendices, found.referencedUploadIds);
  }
  found.updatedAt = new Date().toISOString();
  found.updatedBy = context.userName;
  syncStandard23CommitteeMeetingState(req.params.hospitalId, context.userName);
  addAuditLog(req.params.hospitalId, "GLOBAL", "committee-meeting-updated", found.title, context);
  persist();
  return res.json({ ...found, appendices: buildCommitteeMeetingAppendices(req.params.hospitalId, found.appendices, found.referencedUploadIds) });
});

app.delete("/api/hospitals/:hospitalId/committee-meetings/:meetingId", (req: Request, res: Response) => {
  const context = getContext(req);
  if (context.userRole === "auditor") return res.status(403).json({ error: "Auditors have read-only access" });
  const found = committeeMeetings.find((item) => item.id === req.params.meetingId && item.hospitalId === req.params.hospitalId);
  if (!found) return res.status(404).json({ error: "Committee meeting not found" });
  committeeMeetings = committeeMeetings.filter((item) => item.id !== req.params.meetingId);
  syncStandard23CommitteeMeetingState(req.params.hospitalId, context.userName);
  addAuditLog(req.params.hospitalId, "GLOBAL", "committee-meeting-deleted", found.title, context);
  persist();
  return res.status(204).send();
});

app.get("/api/hospitals/:hospitalId/registry-dashboard", (req: Request, res: Response) => {
  const hospital = hospitals.find((h) => h.id === req.params.hospitalId);
  if (!hospital) return res.status(404).json({ error: "Hospital not found" });
  const hospitalStandards = standards.map((definition) => ({ definition, state: ensureState(hospital.id, definition.code) }));
  const lockedStandards = hospitalStandards.filter((item) => item.state.status === "locked").length;
  const readyForAdminStandards = hospitalStandards.filter((item) => item.state.status === "ready-for-admin").length;
  const standardsWithoutUploads = hospitalStandards.filter((item) => uploads.filter((u) => u.hospitalId === hospital.id && u.standardCode === item.definition.code).length === 0).length;
  const openAssignments = assignments.filter((item) => item.hospitalId === hospital.id && item.status === "open").length;
  const registryMetricCount = customQualityMetrics.filter((item) => item.hospitalId === hospital.id && standards.find((s) => s.code === item.standardCode)?.category === "Registry").length;
  const committeeSlice = committeeMeetings.filter((item) => item.hospitalId === hospital.id);
  const templateCoverageByStandard = hospitalStandards.map(({ definition, state }) => {
    const coverage = buildTemplateCoverage(hospital.id, definition, state);
    const missingItems = coverage.items.filter((item) => !item.hasSavedDraft).map((item) => item.label);
    return {
      standardCode: definition.code,
      standardName: definition.name,
      category: definition.category,
      expectedDraftCount: coverage.expectedDraftCount,
      savedDraftCount: coverage.savedDraftCount,
      missingDraftCount: coverage.expectedDraftCount - coverage.savedDraftCount,
      completionPercent: coverage.expectedDraftCount === 0 ? 100 : Math.round((coverage.savedDraftCount / coverage.expectedDraftCount) * 100),
      missingItems
    };
  });
  const templateDraftsExpected = templateCoverageByStandard.reduce((sum, item) => sum + item.expectedDraftCount, 0);
  const templateDraftsSaved = templateCoverageByStandard.reduce((sum, item) => sum + item.savedDraftCount, 0);
  const standardsWithMissingTemplates = templateCoverageByStandard.filter((item) => item.missingDraftCount > 0).length;
  return res.json({
    hospital,
    totalStandards: hospitalStandards.length,
    lockedStandards,
    readyForAdminStandards,
    openAssignments,
    standardsWithoutUploads,
    registryMetricCount,
    committeeMeetingsPlanned: committeeSlice.filter((item) => item.status === "planned" || item.status === "agenda-ready").length,
    committeeMeetingsCompleted: committeeSlice.filter((item) => item.status === "held" || item.status === "minutes-uploaded" || item.status === "closed").length,
    templateDraftsExpected,
    templateDraftsSaved,
    standardsWithMissingTemplates,
    templateCoverageByStandard,
    oncoLensAssistNote: "OncoLens automation assists with conference workflow coordination and registry dashboard readiness tracking."
  });
});

app.get("/api/hospitals/:hospitalId/quality-reference-docs", (req: Request, res: Response) => {
  const hospital = hospitals.find((h) => h.id === req.params.hospitalId);
  if (!hospital) return res.status(404).json({ error: "Hospital not found" });

  return res.json(qualityReferenceDocuments.filter((d) => d.hospitalId === hospital.id));
});

app.post("/api/hospitals/:hospitalId/quality-reference-docs", upload.single("file"), (req: Request, res: Response) => {
  const context = getContext(req);
  if (context.userRole === "auditor") return res.status(403).json({ error: "Auditors have read-only access" });

  const hospital = hospitals.find((h) => h.id === req.params.hospitalId);
  if (!hospital) return res.status(404).json({ error: "Hospital not found" });
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const frameworkRaw = String(req.body.framework || "").trim().toUpperCase();
  const normalizedFramework: "ACS" | "ASCO" | "ASTRO" | "Other" =
    frameworkRaw === "ACS" || frameworkRaw === "ASCO" || frameworkRaw === "ASTRO"
      ? frameworkRaw
      : "Other";
  const title = String(req.body.title || req.file.originalname).trim() || req.file.originalname;

  const item: QualityReferenceDocument = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    hospitalId: hospital.id,
    framework: normalizedFramework,
    title,
    originalName: req.file.originalname,
    storedName: req.file.filename,
    filePath: `/uploads/${req.file.filename}`,
    sizeBytes: req.file.size,
    uploadedAt: new Date().toISOString(),
    uploadedBy: context.userName
  };

  qualityReferenceDocuments.unshift(item);
  addAuditLog(hospital.id, "GLOBAL", "quality-reference-uploaded", `${item.framework}: ${item.title}`, context);
  persist();

  return res.status(201).json(item);
});

app.delete("/api/hospitals/:hospitalId/quality-reference-docs/:docId", (req: Request, res: Response) => {
  const context = getContext(req);
  if (context.userRole === "auditor") return res.status(403).json({ error: "Auditors have read-only access" });

  const found = qualityReferenceDocuments.find((d) => d.id === req.params.docId && d.hospitalId === req.params.hospitalId);
  if (!found) return res.status(404).json({ error: "Quality reference document not found" });

  qualityReferenceDocuments = qualityReferenceDocuments.filter((d) => d.id !== req.params.docId);
  addAuditLog(req.params.hospitalId, "GLOBAL", "quality-reference-deleted", `${found.framework}: ${found.title}`, context);
  persist();

  return res.status(204).send();
});
// ─────────────────────────────────────────────────────────────────────────────
// ANALYZER ROUTES — NGS/IHC Labs, Oncology Prescribers, Open Payments, Medicaid
// These endpoints query the Supabase analyzer tables loaded by the ETL pipeline.
// All routes return 503 when Supabase is not configured.
// ─────────────────────────────────────────────────────────────────────────────

function analyzerNotAvailable(res: Response): void {
  (res as any).status(503).json({ error: "Analyzer data not available. Supabase must be configured and ETL pipeline must be run first." });
}

function buildCsvFromRows(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => {
      const v = row[h];
      if (v === null || v === undefined) return "";
      const s = String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(","));
  }
  return lines.join("\n");
}

// GET /api/analyzer/ngs-labs
app.get("/api/analyzer/ngs-labs", async (req: Request, res: Response) => {
  if (!isSupabaseConfigured || !supabaseAdmin) return analyzerNotAvailable(res as any);

  const { year, state, code, category, search, page = "1", limit = "50", format } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = format === "csv" ? Math.min(10000, parseInt(limit, 10) || 10000) : Math.min(500, parseInt(limit, 10) || 50);
  const offset = format === "csv" ? 0 : (pageNum - 1) * pageSize;

  let query = supabaseAdmin.from("ngs_lab_utilization").select("*", { count: "exact" });

  if (year) query = query.eq("year", parseInt(year, 10));
  if (state) query = query.eq("nppes_provider_state", state.toUpperCase());
  if (code) query = query.eq("hcpcs_code", code);
  if (category) query = query.eq("test_category", category.toUpperCase());
  if (search) {
    const s = search.trim();
    query = query.or(`provider_last_name.ilike.%${s}%,nppes_provider_city.ilike.%${s}%,npi.eq.${s}`);
  }

  query = query.order("line_srvc_cnt", { ascending: false }).range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;
  if (error) return (res as any).status(500).json({ error: error.message });

  if (format === "csv") {
    (res as any).setHeader("Content-Type", "text/csv");
    (res as any).setHeader("Content-Disposition", "attachment; filename=ngs_labs.csv");
    return (res as any).send(buildCsvFromRows((data || []) as Record<string, unknown>[]));
  }

  return (res as any).json({ data, total: count, page: pageNum, pageSize });
});

// GET /api/analyzer/ngs-labs/summary
app.get("/api/analyzer/ngs-labs/summary", async (req: Request, res: Response) => {
  if (!isSupabaseConfigured || !supabaseAdmin) return analyzerNotAvailable(res as any);

  const { year } = req.query as Record<string, string>;
  let q = supabaseAdmin.from("ngs_lab_utilization").select("*");
  if (year) q = q.eq("year", parseInt(year, 10));

  const { data, error } = await q;
  if (error) return (res as any).status(500).json({ error: error.message });

  const rows = (data || []) as Array<Record<string, any>>;

  // Top 10 labs by total services
  const labTotals = new Map<string, { npi: string; name: string; state: string; total: number }>();
  const stateTotals = new Map<string, number>();
  const codeTotals = new Map<string, number>();
  const categoryTotals = new Map<string, number>();

  for (const row of rows) {
    const npi = row.npi;
    const name = row.provider_last_name || row.npi;
    const state = row.nppes_provider_state || "?";
    const svc = parseFloat(row.line_srvc_cnt || "0");

    const lab = labTotals.get(npi) || { npi, name, state, total: 0 };
    lab.total += svc;
    labTotals.set(npi, lab);

    stateTotals.set(state, (stateTotals.get(state) || 0) + svc);
    codeTotals.set(row.hcpcs_code, (codeTotals.get(row.hcpcs_code) || 0) + svc);
    categoryTotals.set(row.test_category, (categoryTotals.get(row.test_category) || 0) + svc);
  }

  const topLabs = [...labTotals.values()].sort((a, b) => b.total - a.total).slice(0, 10);
  const byState = [...stateTotals.entries()].sort((a, b) => b[1] - a[1]).map(([state, total]) => ({ state, total }));
  const byCode = [...codeTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([code, total]) => ({ code, total }));
  const byCategory = [...categoryTotals.entries()].map(([category, total]) => ({ category, total }));

  return (res as any).json({ totalRows: rows.length, topLabs, byState, byCode, byCategory });
});

// GET /api/analyzer/oncology-prescribers
app.get("/api/analyzer/oncology-prescribers", async (req: Request, res: Response) => {
  if (!isSupabaseConfigured || !supabaseAdmin) return analyzerNotAvailable(res as any);

  const { year, state, drug, requires_companion_dx, search, page = "1", limit = "50", format } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = format === "csv" ? Math.min(10000, parseInt(limit, 10) || 10000) : Math.min(500, parseInt(limit, 10) || 50);
  const offset = format === "csv" ? 0 : (pageNum - 1) * pageSize;

  let query = supabaseAdmin.from("oncology_drug_prescribers").select("*", { count: "exact" });

  if (year) query = query.eq("year", parseInt(year, 10));
  if (state) query = query.eq("nppes_provider_state", state.toUpperCase());
  if (drug) query = query.ilike("drug_name", `%${drug}%`);
  if (requires_companion_dx === "true") query = query.eq("requires_companion_dx", true);
  if (search) {
    const s = search.trim();
    query = query.or(`nppes_provider_last_org_name.ilike.%${s}%,nppes_provider_first_name.ilike.%${s}%,npi.eq.${s}`);
  }

  query = query.order("total_claim_count", { ascending: false }).range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;
  if (error) return (res as any).status(500).json({ error: error.message });

  if (format === "csv") {
    (res as any).setHeader("Content-Type", "text/csv");
    (res as any).setHeader("Content-Disposition", "attachment; filename=oncology_prescribers.csv");
    return (res as any).send(buildCsvFromRows((data || []) as Record<string, unknown>[]));
  }

  return (res as any).json({ data, total: count, page: pageNum, pageSize });
});

// GET /api/analyzer/oncology-prescribers/summary
app.get("/api/analyzer/oncology-prescribers/summary", async (req: Request, res: Response) => {
  if (!isSupabaseConfigured || !supabaseAdmin) return analyzerNotAvailable(res as any);

  const { year } = req.query as Record<string, string>;
  let q = supabaseAdmin.from("oncology_drug_prescribers").select("*");
  if (year) q = q.eq("year", parseInt(year, 10));

  const { data, error } = await q;
  if (error) return (res as any).status(500).json({ error: error.message });

  const rows = (data || []) as Array<Record<string, any>>;

  const prescriberTotals = new Map<string, { npi: string; name: string; state: string; claims: number; drugs: Set<string>; hasCompanion: boolean }>();
  const drugTotals = new Map<string, { drug: string; claims: number; requires_companion_dx: boolean }>();
  const stateTotals = new Map<string, number>();

  for (const row of rows) {
    const npi = row.npi;
    const name = `${row.nppes_provider_first_name || ""} ${row.nppes_provider_last_org_name || ""}`.trim() || npi;
    const state = row.nppes_provider_state || "?";
    const claims = parseInt(row.total_claim_count || "0", 10);

    const p = prescriberTotals.get(npi) || { npi, name, state, claims: 0, drugs: new Set<string>(), hasCompanion: false };
    p.claims += claims;
    p.drugs.add(row.drug_name);
    if (row.requires_companion_dx) p.hasCompanion = true;
    prescriberTotals.set(npi, p);

    const drug = row.drug_name;
    const d = drugTotals.get(drug) || { drug, claims: 0, requires_companion_dx: row.requires_companion_dx };
    d.claims += claims;
    drugTotals.set(drug, d);

    stateTotals.set(state, (stateTotals.get(state) || 0) + claims);
  }

  const topPrescribers = [...prescriberTotals.values()]
    .sort((a, b) => b.claims - a.claims)
    .slice(0, 10)
    .map((p) => ({ ...p, drugCount: p.drugs.size, drugs: [...p.drugs] }));

  const byDrug = [...drugTotals.values()].sort((a, b) => b.claims - a.claims).slice(0, 20);
  const byState = [...stateTotals.entries()].sort((a, b) => b[1] - a[1]).map(([state, total]) => ({ state, total }));
  const companionDxCount = [...prescriberTotals.values()].filter((p) => p.hasCompanion).length;

  return (res as any).json({ totalRows: rows.length, topPrescribers, byDrug, byState, companionDxCount });
});

// GET /api/analyzer/open-payments
app.get("/api/analyzer/open-payments", async (req: Request, res: Response) => {
  if (!isSupabaseConfigured || !supabaseAdmin) return analyzerNotAvailable(res as any);

  const { year, state, npi, drug, page = "1", limit = "50", format } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = format === "csv" ? Math.min(10000, parseInt(limit, 10) || 10000) : Math.min(500, parseInt(limit, 10) || 50);
  const offset = format === "csv" ? 0 : (pageNum - 1) * pageSize;

  let query = supabaseAdmin.from("open_payments_oncology").select("*", { count: "exact" });

  if (year) query = query.eq("year", parseInt(year, 10));
  if (state) query = query.eq("recipient_state", state.toUpperCase());
  if (npi) query = query.eq("physician_npi", npi);
  if (drug) query = query.ilike("drug_name", `%${drug}%`);

  query = query.order("total_amount_usd", { ascending: false }).range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;
  if (error) return (res as any).status(500).json({ error: error.message });

  if (format === "csv") {
    (res as any).setHeader("Content-Type", "text/csv");
    (res as any).setHeader("Content-Disposition", "attachment; filename=open_payments.csv");
    return (res as any).send(buildCsvFromRows((data || []) as Record<string, unknown>[]));
  }

  return (res as any).json({ data, total: count, page: pageNum, pageSize });
});

// GET /api/analyzer/open-payments/summary
app.get("/api/analyzer/open-payments/summary", async (req: Request, res: Response) => {
  if (!isSupabaseConfigured || !supabaseAdmin) return analyzerNotAvailable(res as any);

  const { year } = req.query as Record<string, string>;
  let q = supabaseAdmin.from("open_payments_oncology").select("*");
  if (year) q = q.eq("year", parseInt(year, 10));

  const { data, error } = await q;
  if (error) return (res as any).status(500).json({ error: error.message });

  const rows = (data || []) as Array<Record<string, any>>;

  const physicianTotals = new Map<string, { npi: string; name: string; state: string; total: number; payments: number }>();
  const manufacturerTotals = new Map<string, number>();
  const drugTotals = new Map<string, number>();
  const natureTotals = new Map<string, number>();

  for (const row of rows) {
    const npi = row.physician_npi || "unknown";
    const name = `${row.physician_first_name || ""} ${row.physician_last_name || ""}`.trim() || npi;
    const amount = parseFloat(row.total_amount_usd || "0");

    const p = physicianTotals.get(npi) || { npi, name, state: row.recipient_state || "?", total: 0, payments: 0 };
    p.total += amount;
    p.payments++;
    physicianTotals.set(npi, p);

    const mfr = row.manufacturer_name || "Unknown";
    manufacturerTotals.set(mfr, (manufacturerTotals.get(mfr) || 0) + amount);

    const drug = row.drug_name || "Other";
    drugTotals.set(drug, (drugTotals.get(drug) || 0) + amount);

    const nature = row.nature_of_payment || "Other";
    natureTotals.set(nature, (natureTotals.get(nature) || 0) + 1);
  }

  const topKols = [...physicianTotals.values()].sort((a, b) => b.total - a.total).slice(0, 10);
  const byManufacturer = [...manufacturerTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, total]) => ({ name, total }));
  const byDrug = [...drugTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([drug, total]) => ({ drug, total }));
  const byNature = [...natureTotals.entries()].sort((a, b) => b[1] - a[1]).map(([nature, count]) => ({ nature, count }));
  const totalAmount = [...physicianTotals.values()].reduce((s, p) => s + p.total, 0);

  return (res as any).json({ totalRows: rows.length, totalAmount, topKols, byManufacturer, byDrug, byNature });
});

// GET /api/analyzer/medicaid
app.get("/api/analyzer/medicaid", async (req: Request, res: Response) => {
  if (!isSupabaseConfigured || !supabaseAdmin) return analyzerNotAvailable(res as any);

  const { year, state, drug, page = "1", limit = "50", format } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = format === "csv" ? Math.min(10000, parseInt(limit, 10) || 10000) : Math.min(500, parseInt(limit, 10) || 50);
  const offset = format === "csv" ? 0 : (pageNum - 1) * pageSize;

  let query = supabaseAdmin.from("medicaid_drug_utilization").select("*", { count: "exact" });

  if (year) query = query.eq("year", parseInt(year, 10));
  if (state) query = query.eq("state_code", state.toUpperCase());
  if (drug) query = query.ilike("drug_name", `%${drug}%`);

  query = query.order("total_amount_reimbursed", { ascending: false }).range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;
  if (error) return (res as any).status(500).json({ error: error.message });

  if (format === "csv") {
    (res as any).setHeader("Content-Type", "text/csv");
    (res as any).setHeader("Content-Disposition", "attachment; filename=medicaid_utilization.csv");
    return (res as any).send(buildCsvFromRows((data || []) as Record<string, unknown>[]));
  }

  return (res as any).json({ data, total: count, page: pageNum, pageSize });
});

// GET /api/analyzer/cross-reference?npi=
// Given a prescriber NPI → returns their Part D drugs + Open Payments
app.get("/api/analyzer/cross-reference", async (req: Request, res: Response) => {
  if (!isSupabaseConfigured || !supabaseAdmin) return analyzerNotAvailable(res as any);

  const { npi } = req.query as Record<string, string>;
  if (!npi) return (res as any).status(400).json({ error: "npi query parameter is required" });

  const [prescriptions, payments] = await Promise.all([
    supabaseAdmin.from("oncology_drug_prescribers").select("*").eq("npi", npi).order("year", { ascending: false }),
    supabaseAdmin.from("open_payments_oncology").select("*").eq("physician_npi", npi).order("total_amount_usd", { ascending: false })
  ]);

  if (prescriptions.error) return (res as any).status(500).json({ error: prescriptions.error.message });

  const providerInfo = prescriptions.data?.[0] || null;

  return (res as any).json({
    npi,
    provider: providerInfo ? {
      name: `${providerInfo.nppes_provider_first_name || ""} ${providerInfo.nppes_provider_last_org_name || ""}`.trim(),
      city: providerInfo.nppes_provider_city,
      state: providerInfo.nppes_provider_state,
      specialty: providerInfo.provider_type
    } : null,
    prescriptions: prescriptions.data || [],
    openPayments: payments.data || []
  });
});

// GET /api/analyzer/prospect-list?state=&drug=&min_claims=
// High-value prospects: oncologists prescribing companion-dx drugs in a given state
app.get("/api/analyzer/prospect-list", async (req: Request, res: Response) => {
  if (!isSupabaseConfigured || !supabaseAdmin) return analyzerNotAvailable(res as any);

  const { state, drug, min_claims = "10", year, format } = req.query as Record<string, string>;
  const minClaims = parseInt(min_claims, 10) || 10;

  let query = supabaseAdmin
    .from("oncology_drug_prescribers")
    .select("npi, nppes_provider_first_name, nppes_provider_last_org_name, nppes_provider_city, nppes_provider_state, nppes_provider_zip5, nppes_credentials, provider_type, drug_name, generic_name, companion_test_type, total_claim_count, total_drug_cost, bene_count, requires_companion_dx, year")
    .eq("requires_companion_dx", true)
    .gte("total_claim_count", minClaims);

  if (state) query = query.eq("nppes_provider_state", state.toUpperCase());
  if (drug) query = query.ilike("drug_name", `%${drug}%`);
  if (year) query = query.eq("year", parseInt(year, 10));

  query = query.order("total_claim_count", { ascending: false }).limit(500);

  const { data, error } = await query;
  if (error) return (res as any).status(500).json({ error: error.message });

  const rows = (data || []) as Array<Record<string, any>>;

  // Aggregate by NPI: sum claims across drugs
  type ProspectEntry = {
    npi: string; name: string; city: string; state: string; zip: string;
    credentials: string; specialty: string; totalClaims: number; totalCost: number;
    drugs: Array<{ drug: string; companion_test: string; claims: number }>;
  };
  const byNpi = new Map<string, ProspectEntry>();

  for (const row of rows) {
    const npi = row.npi;
    const name = `${row.nppes_provider_first_name || ""} ${row.nppes_provider_last_org_name || ""}`.trim() || npi;
    const existing: ProspectEntry = byNpi.get(npi) ?? {
      npi, name,
      city: row.nppes_provider_city || "",
      state: row.nppes_provider_state || "",
      zip: row.nppes_provider_zip5 || "",
      credentials: row.nppes_credentials || "",
      specialty: row.provider_type || "",
      totalClaims: 0,
      totalCost: 0,
      drugs: [] as Array<{ drug: string; companion_test: string; claims: number }>
    };
    existing.totalClaims += parseInt(row.total_claim_count || "0", 10);
    existing.totalCost += parseFloat(row.total_drug_cost || "0");
    existing.drugs.push({
      drug: row.drug_name,
      companion_test: row.companion_test_type || "",
      claims: parseInt(row.total_claim_count || "0", 10)
    });
    byNpi.set(npi, existing);
  }

  const prospects = [...byNpi.values()].sort((a, b) => b.totalClaims - a.totalClaims);

  if (format === "csv") {
    const flat = prospects.map((p) => ({
      npi: p.npi,
      name: p.name,
      city: p.city,
      state: p.state,
      zip: p.zip,
      credentials: p.credentials,
      specialty: p.specialty,
      total_claims: p.totalClaims,
      total_drug_cost: p.totalCost.toFixed(2),
      companion_dx_drugs: p.drugs.map((d) => d.drug).join("; "),
      companion_tests_required: [...new Set(p.drugs.map((d) => d.companion_test))].join("; ")
    }));
    (res as any).setHeader("Content-Type", "text/csv");
    (res as any).setHeader("Content-Disposition", "attachment; filename=prospect_list.csv");
    return (res as any).send(buildCsvFromRows(flat as Record<string, unknown>[]));
  }

  return (res as any).json({ prospects, total: prospects.length });
});

if (!isServerlessRuntime) {
  app.listen(port, () => {
    console.log(`CoC backend listening on port ${port}`);
  });
}

export default app;



















































