export type UserRole = "admin" | "owner" | "staff" | "auditor";
export type AccreditationFramework = "CoC" | "NAPBC" | "NCPRC" | "NQF" | "ASCO" | "ASTRO" | "ACR" | "Other";
export type DocumentExportFormat = "doc" | "docx";
export type TemplateDraftKind = "standard-evidence" | "committee-appendix" | "process-step";

export interface TemplateDraftRevision {
  id: string;
  title: string;
  body: string;
  savedAt: string;
  savedBy: string;
}

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

export interface TemplateDraft {
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

export interface TemplateCoverageItem {
  kind: TemplateDraftKind;
  label: string;
  processIndex: number | null;
  hasSavedDraft: boolean;
  savedDraftId: string | null;
}

export interface TemplateCoverageSummary {
  expectedDraftCount: number;
  savedDraftCount: number;
  items: TemplateCoverageItem[];
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
  templateDrafts: TemplateDraft[];
  templateCoverage: TemplateCoverageSummary;
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
  sourceType: "upload" | "process-document" | "template-draft";
  sourceId: string;
  explanation: string;
}

export interface CommitteeMeetingAppendix extends CommitteeMeetingAppendixInput {
  id: string;
  standardCode: string;
  originalName: string;
  filePath: string;
  processIndex: number | null;
  templateDraftKind: TemplateDraftKind | null;
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

export interface TemplateCoverageByStandardItem {
  standardCode: string;
  standardName: string;
  category: string;
  expectedDraftCount: number;
  savedDraftCount: number;
  missingDraftCount: number;
  completionPercent: number;
  missingItems: string[];
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
  templateDraftsExpected: number;
  templateDraftsSaved: number;
  standardsWithMissingTemplates: number;
  templateCoverageByStandard: TemplateCoverageByStandardItem[];
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

// ─── Analyzer Types ───────────────────────────────────────────────────────────

export interface NgsLabRecord {
  id: number;
  year: number;
  npi: string;
  provider_last_name: string;
  provider_first_name: string;
  provider_credentials: string | null;
  provider_gender: string | null;
  provider_entity_type: string | null;
  nppes_provider_street1: string;
  nppes_provider_city: string;
  nppes_provider_state: string | null;
  nppes_provider_zip: string | null;
  provider_country_code: string | null;
  provider_type: string;
  medicare_participation_indicator: string | null;
  hcpcs_code: string;
  hcpcs_description: string;
  test_category: "NGS" | "IHC" | "FISH";
  line_srvc_cnt: number | null;
  bene_unique_cnt: number | null;
  bene_day_srvc_cnt: number | null;
  average_medicare_allowed_amt: number | null;
  average_submitted_chrg_amt: number | null;
  average_medicare_payment_amt: number | null;
  average_medicare_standardized_amt: number | null;
}

export interface OncologyPrescriberRecord {
  id: number;
  year: number;
  npi: string;
  nppes_provider_last_org_name: string;
  nppes_provider_first_name: string;
  nppes_provider_city: string;
  nppes_provider_state: string | null;
  nppes_provider_zip5: string | null;
  nppes_credentials: string | null;
  provider_type: string;
  description: string | null;
  drug_name: string;
  generic_name: string;
  drug_category: string;
  total_claim_count: number | null;
  total_30_day_fill_count: number | null;
  total_day_supply: number | null;
  total_drug_cost: number | null;
  bene_count: number | null;
  total_claim_count_ge65: number | null;
  total_drug_cost_ge65: number | null;
  requires_companion_dx: boolean;
  companion_test_type: string | null;
}

export interface OpenPaymentRecord {
  id: number;
  year: number;
  physician_npi: string | null;
  physician_first_name: string | null;
  physician_last_name: string | null;
  physician_specialty: string | null;
  recipient_city: string | null;
  recipient_state: string | null;
  manufacturer_name: string | null;
  drug_name: string | null;
  total_amount_usd: number;
  nature_of_payment: string | null;
  form_of_payment: string | null;
  number_of_payments: number;
  payment_publication_date: string | null;
}

export interface MedicaidRecord {
  id: number;
  year: number;
  quarter: number | null;
  state_code: string;
  labeler_code: string | null;
  product_code: string | null;
  ndc: string | null;
  utilization_type: string | null;
  suppression_used: string | null;
  units_reimbursed: number | null;
  number_of_prescriptions: number | null;
  total_amount_reimbursed: number | null;
  medicaid_amount_reimbursed: number | null;
  non_medicaid_amount_reimbursed: number | null;
  drug_name: string | null;
  drug_category: string | null;
}

export interface AnalyzerFilters {
  year: string;
  state: string;
  category: string;
  drug: string;
  search: string;
  companionDxOnly: boolean;
  minClaims: string;
}

export interface NgsLabSummary {
  totalRows: number;
  topLabs: Array<{ npi: string; name: string; state: string; total: number }>;
  byState: Array<{ state: string; total: number }>;
  byCode: Array<{ code: string; total: number }>;
  byCategory: Array<{ category: string; total: number }>;
}

export interface PrescriberSummary {
  totalRows: number;
  topPrescribers: Array<{ npi: string; name: string; state: string; claims: number; drugCount: number; drugs: string[]; hasCompanion: boolean }>;
  byDrug: Array<{ drug: string; claims: number; requires_companion_dx: boolean }>;
  byState: Array<{ state: string; total: number }>;
  companionDxCount: number;
}

export interface OpenPaymentsSummary {
  totalRows: number;
  totalAmount: number;
  topKols: Array<{ npi: string; name: string; state: string; total: number; payments: number }>;
  byManufacturer: Array<{ name: string; total: number }>;
  byDrug: Array<{ drug: string; total: number }>;
  byNature: Array<{ nature: string; count: number }>;
}

export interface ProspectRecord {
  npi: string;
  name: string;
  city: string;
  state: string;
  zip: string;
  credentials: string;
  specialty: string;
  totalClaims: number;
  totalCost: number;
  drugs: Array<{ drug: string; companion_test: string; claims: number }>;
}

export interface CrossReferenceResponse {
  npi: string;
  provider: { name: string; city: string; state: string; specialty: string } | null;
  prescriptions: OncologyPrescriberRecord[];
  openPayments: OpenPaymentRecord[];
  ngsLabs: NgsLabRecord[];
}

// ─── Collaboration Network ───────────────────────────────────────────────────

export interface CancerTypeYear {
  type: string;
  years: number[];
}

export interface CollaboratorNode {
  npi: string;
  name: string;
  city: string;
  state: string;
  specialty: string;
  specialtyType?: string;
  sharedDrugs: string[];
  totalClaims: number;
  beneCnt: number;
  drugOverlapScore: number;
  hcpcsOverlapScore: number;
  sharedBeneProxy: number;
  collaborationScore: number;
  collaborationType?: "same_group" | "hcpcs_and_drug" | "hcpcs_overlap" | "drug_overlap" | "cross_specialty";
  cancerTypes?: CancerTypeYear[];
  isFocal?: boolean;
}

export interface CollaborationEdge {
  source: string;
  target: string;
  score: number;
  sharedDrugs: string[];
  drugOverlapScore: number;
  hcpcsOverlapScore: number;
  sharedBeneProxy: number;
  collaborationType?: string;
}

export interface CollaborationNetwork {
  focalProvider: CollaboratorNode & {
    drugs: string[];
    hcpcsCodes: string[];
    groupPacId: string | null;
    groupName: string | null;
    specialtyType: string;
    cancerTypes: CancerTypeYear[];
    prescriptionHistory: OncologyPrescriberRecord[];
    openPayments: OpenPaymentRecord[];
  };
  collaborators: CollaboratorNode[];
  edges: CollaborationEdge[];
}

export interface CollaborationProviderSearchResult {
  npi: string;
  name: string;
  city: string;
  state: string;
  specialty: string;
}

// ─── Physician Locations ─────────────────────────────────────────────────────

export interface PhysicianLocation {
  npi: string;
  provider_name: string;
  specialty: string;
  credentials: string;
  address_line1: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  facility_name: string | null;
  org_pac_id: string | null;
}

// ─── Hospital Network ─────────────────────────────────────────────────────────

export interface HospitalSearchResult {
  ccn: string;
  pac_id: string;
  name: string;
  city: string;
  state: string;
  zip: string;
  hospital_type: string;
  health_system: string;
}

export interface HospitalProvider {
  npi: string;
  name: string;
  specialty: string;
  specialtyType: string;
  credentials: string;
  city: string;
  state: string;
  zip: string;
  totalClaims: number;
  drugs: string[];
  hasCompanionDx: boolean;
  affiliatedHospital: string;
}

export interface HospitalLabRecord {
  npi: string;
  name: string;
  city: string;
  state: string;
  testCategory: "NGS" | "IHC" | "FISH";
  hcpcsCode: string;
  hcpcsDescription: string;
  totalServices: number;
  totalPatients: number;
  isHospitalAffiliated: boolean;
}

export interface HospitalNetwork {
  hospital: HospitalSearchResult;
  affiliateHospitals: HospitalSearchResult[];
  providers: {
    oncology: HospitalProvider[];
    hematology: HospitalProvider[];
    surgery: HospitalProvider[];
    radiology: HospitalProvider[];
    pathology: HospitalProvider[];
    midlevels: HospitalProvider[];
    referrers: HospitalProvider[];
  };
  prescribingHighlights: {
    allDrugs: Array<{ drug: string; claims: number; providers: number; companionDx: boolean }>;
    companionDxCount: number;
    totalProviders: number;
  };
  labTesting: HospitalLabRecord[];
}

// ─── Part B Services ──────────────────────────────────────────────────────────

export interface PartBServiceRecord {
  npi: string;
  provider_name: string;
  provider_type: string;
  city: string;
  state: string;
  zip: string;
  hcpcs_code: string;
  hcpcs_description: string;
  service_category: "NGS" | "CHEMO" | "RADIATION" | "PATHOLOGY";
  place_of_service: string;
  total_services: number;
  total_unique_benes: number;
  avg_submitted_charge: number;
  avg_medicare_payment: number;
  year: number;
}

// ─── ACO ──────────────────────────────────────────────────────────────────────

export interface AcoMembership {
  aco_id: string;
  aco_name: string;
  practice_name: string;
  city: string;
  state: string;
  performance_year: number;
}

// ─── Order & Referring ────────────────────────────────────────────────────────

export interface OrderReferringStatus {
  eligible: boolean;
  provider: { npi: string; last_name: string; first_name: string; org_name: string; state: string; provider_type: string } | null;
  available: boolean;
}












