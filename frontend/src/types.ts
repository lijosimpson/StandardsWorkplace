export type UserRole = "admin" | "owner" | "staff" | "auditor";
export type AccreditationFramework = "CoC" | "NAPBC" | "NCPRC" | "NQF" | "ASCO" | "ASTRO" | "ACR" | "Other";

export interface Hospital {
  id: string;
  name: string;
}

export interface StandardListItem {
  code: string;
  name: string;
  category: string;
  framework: AccreditationFramework;
  retired: boolean;
  status: "in-progress" | "ready-for-admin" | "locked";
  compliancePercent: number;
  meets: boolean;
  assignmentCount: number;
  uploadCount: number;
}

export interface StandardDefinition {
  referenceNote: string;
  code: string;
  name: string;
  category: string;
  framework: AccreditationFramework;
  description: string;
  retired?: boolean;
  hospitalProcess: string[];
  numeratorComponents: string[];
  requiredMetricCount: number;
  denominator: {
    mode: "fixed" | "editable";
    defaultValue: number;
    label: string;
  };
  threshold: {
    type: "equal" | "gtePercent" | "gteCount";
    value: number;
    label: string;
  };
}

export interface StandardState {
  componentsComplete: boolean[];
  metricLabels: string[];
  denominatorValue: number;
  status: "in-progress" | "ready-for-admin" | "locked";
  lockNote: string;
  lastUpdatedAt: string;
  lastUpdatedBy: string;
  processQuarterChecks: Record<string, Record<string, boolean>>;
  processHiddenSteps: Record<string, boolean>;
}

export interface StandardResult {
  numerator: number;
  denominator: number;
  compliancePercent: number;
  meets: boolean;
}

export interface AssignmentItem {
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

export interface UploadItem {
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

export interface ProcessDocument {
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

export interface StandardDetailResponse {
  hospital: Hospital;
  standard: StandardDefinition;
  state: StandardState;
  results: StandardResult;
  assignments: AssignmentItem[];
  uploads: UploadItem[];
  qualityMetricLibrary: QualityMetricTemplate[];
  customQualityMetrics: CustomQualityMetric[];
  processDocuments: ProcessDocument[];
  roleList: string[];
  roleAssignments: StandardRoleAssignment[];
}

export interface PrqWarRoomItem {
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

export interface CommitteeMeetingAppendixInput {
  sourceType: "upload" | "process-document";
  sourceId: string;
  explanation: string;
}

export interface CommitteeMeetingAppendix extends CommitteeMeetingAppendixInput {
  id: string;
  standardCode: string;
  originalName: string;
  filePath: string;
  processIndex: number | null;
}

export interface CommitteeMeeting {
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
  updatedAt: string;
  updatedBy: string;
}

export interface CommitteePerson {
  id: string;
  hospitalId: string;
  name: string;
  degrees: string;
  updatedAt: string;
  updatedBy: string;
}

export interface StandardRoleAssignment {
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

export interface RegistryDashboardSummary {
  hospital: Hospital;
  totalStandards: number;
  lockedStandards: number;
  readyForAdminStandards: number;
  openAssignments: number;
  standardsWithoutUploads: number;
  registryMetricCount: number;
  committeeMeetingsPlanned: number;
  committeeMeetingsCompleted: number;
  oncoLensAssistNote: string;
}
export interface QualityReferenceDocument {
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
export interface AuditLogEntry {
  id: string;
  hospitalId: string;
  standardCode: string;
  action: string;
  details: string;
  userName: string;
  userRole: UserRole;
  timestamp: string;
}

export interface AuditorExportStandard {
  code: string;
  name: string;
  category: string;
  status: "in-progress" | "ready-for-admin" | "locked";
  meets: boolean;
  compliancePercent: number;
  numerator: number;
  denominator: number;
  thresholdLabel: string;
  lockNote: string;
  uploadCount: number;
  assignmentCount: number;
  numeratorComponents: Array<{
    label: string;
    complete: boolean;
  }>;
  assignments: AssignmentItem[];
  uploads: UploadItem[];
  processDocuments: ProcessDocument[];
}

export interface AuditorExportResponse {
  hospital: Hospital;
  generatedAt: string;
  standards: AuditorExportStandard[];
  auditLogs: AuditLogEntry[];
}

export interface QualityMetricTemplate {
  framework: AccreditationFramework;
  title: string;
  description: string;
  target: string;
}

export interface CustomQualityMetric {
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
export interface QualityMetricFrameworkSummary {
  framework: AccreditationFramework;
  total: number;
  byStatus: Record<string, number>;
}

export interface QualityMetricSummaryResponse {
  hospital: Hospital;
  total: number;
  byFramework: QualityMetricFrameworkSummary[];
  byStandard: Array<{
    standardCode: string;
    standardName: string;
    category: string;
    total: number;
    met: number;
    needsReview: number;
  }>;
}










