import type {
  AssignmentItem,
  AuditLogEntry,
  AuditorExportResponse,
  CommitteeMeeting,
  CommitteeMeetingAppendixInput,
  CommitteePerson,
  AccreditationFramework,
  CustomQualityMetric,
  Hospital,
  PrqWarRoomItem,
  ProcessDocument,
  QualityReferenceDocument,
  QualityMetricSummaryResponse,
  RegistryDashboardSummary,
  StandardDetailResponse,
  StandardListItem,
  StandardRoleAssignment,
  UploadItem,
  UserRole
} from "./types";

const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:4000/api").replace(/\/$/, "");

const headers = (role: UserRole, userName: string): HeadersInit => ({
  "x-user-role": role,
  "x-user-name": userName
});

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || "Request failed");
  }
  return res.json() as Promise<T>;
}

export const api = {
  getHospitals: async (): Promise<Hospital[]> => {
    const res = await fetch(`${API_BASE}/hospitals`);
    return parse<Hospital[]>(res);
  },

  getStandards: async (hospitalId: string): Promise<StandardListItem[]> => {
    const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/standards`);
    return parse<StandardListItem[]>(res);
  },

  getStandardDetail: async (hospitalId: string, standardCode: string): Promise<StandardDetailResponse> => {
    const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/standards/${standardCode}`);
    return parse<StandardDetailResponse>(res);
  },

  updateMetrics: async (
    hospitalId: string,
    standardCode: string,
    role: UserRole,
    userName: string,
    payload: { componentsComplete: boolean[]; denominatorValue?: number }
  ): Promise<void> => {
    const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/standards/${standardCode}/metrics`, {
      method: "POST",
      headers: {
        ...headers(role, userName),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    await parse<{ ok: boolean } | Record<string, unknown>>(res);
  },

  updateStatus: async (
    hospitalId: string,
    standardCode: string,
    role: UserRole,
    userName: string,
    payload: { status: "in-progress" | "ready-for-admin" | "locked"; lockNote?: string }
  ): Promise<void> => {
    const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/standards/${standardCode}/status`, {
      method: "POST",
      headers: {
        ...headers(role, userName),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    await parse<{ ok: boolean } | Record<string, unknown>>(res);
  },

  uploadEvidence: async (
    hospitalId: string,
    standardCode: string,
    role: UserRole,
    userName: string,
    file: File
  ): Promise<UploadItem> => {
    const form = new FormData();
    form.append("file", file);

    const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/standards/${standardCode}/uploads`, {
      method: "POST",
      headers: headers(role, userName),
      body: form
    });

    return parse<UploadItem>(res);
  },

  createAssignment: async (
    hospitalId: string,
    standardCode: string,
    role: UserRole,
    userName: string,
    payload: { componentLabel: string; assignee: string; dueDate: string }
  ): Promise<AssignmentItem> => {
    const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/standards/${standardCode}/assignments`, {
      method: "POST",
      headers: {
        ...headers(role, userName),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    return parse<AssignmentItem>(res);
  },

  updateAssignment: async (
    hospitalId: string,
    standardCode: string,
    assignmentId: string,
    role: UserRole,
    userName: string,
    payload: { status?: "open" | "done"; dueDate?: string; assignee?: string }
  ): Promise<AssignmentItem> => {
    const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/standards/${standardCode}/assignments/${assignmentId}`, {
      method: "PATCH",
      headers: {
        ...headers(role, userName),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    return parse<AssignmentItem>(res);
  },


  updateMetricLabels: async (
    hospitalId: string,
    standardCode: string,
    role: UserRole,
    userName: string,
    metricLabels: string[]
  ): Promise<void> => {
    const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/standards/${standardCode}/metric-labels`, {
      method: "PATCH",
      headers: {
        ...headers(role, userName),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ metricLabels })
    });
    await parse<{ ok: boolean } | Record<string, unknown>>(res);
  },

  createCustomQualityMetric: async (
    hospitalId: string,
    standardCode: string,
    role: UserRole,
    userName: string,
    payload: { framework: AccreditationFramework; title: string; description: string; target: string }
  ): Promise<CustomQualityMetric> => {
    const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/standards/${standardCode}/custom-quality-metrics`, {
      method: "POST",
      headers: {
        ...headers(role, userName),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    return parse<CustomQualityMetric>(res);
  },

  updateCustomQualityMetric: async (
    hospitalId: string,
    standardCode: string,
    metricId: string,
    role: UserRole,
    userName: string,
    payload: Partial<Pick<CustomQualityMetric, "framework" | "title" | "description" | "target" | "status">>
  ): Promise<CustomQualityMetric> => {
    const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/standards/${standardCode}/custom-quality-metrics/${metricId}`, {
      method: "PATCH",
      headers: {
        ...headers(role, userName),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    return parse<CustomQualityMetric>(res);
  },

  deleteCustomQualityMetric: async (
    hospitalId: string,
    standardCode: string,
    metricId: string,
    role: UserRole,
    userName: string
  ): Promise<void> => {
    const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/standards/${standardCode}/custom-quality-metrics/${metricId}`, {
      method: "DELETE",
      headers: headers(role, userName)
    });
    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({ error: "Request failed" }));
      throw new Error(err.error || "Request failed");
    }
  },
  importTemplateQualityMetrics: async (
    hospitalId: string,
    standardCode: string,
    role: UserRole,
    userName: string
  ): Promise<{ created: number; totalTemplates: number }> => {
    const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/standards/${standardCode}/custom-quality-metrics/import-templates`, {
      method: "POST",
      headers: headers(role, userName)
    });
    return parse<{ created: number; totalTemplates: number }>(res);
  },

  getQualityMetricSummary: async (hospitalId: string): Promise<QualityMetricSummaryResponse> => {
    const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/custom-quality-metrics/summary`);
    return parse<QualityMetricSummaryResponse>(res);
  },

  downloadCustomQualityMetricsCsv: async (hospitalId: string): Promise<string> => {
    const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/custom-quality-metrics.csv`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Request failed" }));
      throw new Error(err.error || "Request failed");
    }
    return res.text();
  },

  updateProcessQuarter: async (
    hospitalId: string,
    standardCode: string,
    role: UserRole,
    userName: string,
    processIndex: number,
    quarter: string,
    checked: boolean
  ): Promise<void> => {
    const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/standards/${standardCode}/process-quarters`, {
      method: "PATCH",
      headers: { ...headers(role, userName), "Content-Type": "application/json" },
      body: JSON.stringify({ processIndex, quarter, checked })
    });
    await parse<Record<string, unknown>>(res);
  },

  updateProcessVisibility: async (
    hospitalId: string,
    standardCode: string,
    role: UserRole,
    userName: string,
    processIndex: number,
    hidden: boolean
  ): Promise<void> => {
    const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/standards/${standardCode}/process-visibility`, {
      method: "PATCH",
      headers: { ...headers(role, userName), "Content-Type": "application/json" },
      body: JSON.stringify({ processIndex, hidden })
    });
    await parse<Record<string, unknown>>(res);
  },

  uploadProcessDoc: async (
    hospitalId: string,
    standardCode: string,
    role: UserRole,
    userName: string,
    processIndex: number,
    file: File
  ): Promise<ProcessDocument> => {
    const form = new FormData();
    form.append("file", file);
    form.append("processIndex", String(processIndex));
    const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/standards/${standardCode}/process-docs`, {
      method: "POST",
      headers: headers(role, userName),
      body: form
    });
    return parse<ProcessDocument>(res);
  },

  deleteProcessDoc: async (
    hospitalId: string,
    standardCode: string,
    role: UserRole,
    userName: string,
    docId: string
  ): Promise<void> => {
    const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/standards/${standardCode}/process-docs/${docId}`, {
      method: "DELETE",
      headers: headers(role, userName)
    });
    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({ error: "Request failed" }));
      throw new Error(err.error || "Request failed");
    }
  },


  getQualityReferenceDocs: async (hospitalId: string): Promise<QualityReferenceDocument[]> => {
    const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/quality-reference-docs`);
    return parse<QualityReferenceDocument[]>(res);
  },

  uploadQualityReferenceDoc: async (
    hospitalId: string,
    role: UserRole,
    userName: string,
    payload: { framework: "ACS" | "ASCO" | "ASTRO" | "Other"; title: string; file: File }
  ): Promise<QualityReferenceDocument> => {
    const form = new FormData();
    form.append("file", payload.file);
    form.append("framework", payload.framework);
    form.append("title", payload.title);

    const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/quality-reference-docs`, {
      method: "POST",
      headers: headers(role, userName),
      body: form
    });

    return parse<QualityReferenceDocument>(res);
  },

  deleteQualityReferenceDoc: async (
    hospitalId: string,
    docId: string,
    role: UserRole,
    userName: string
  ): Promise<void> => {
    const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/quality-reference-docs/${docId}`, {
      method: "DELETE",
      headers: headers(role, userName)
    });

    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({ error: "Request failed" }));
      throw new Error(err.error || "Request failed");
    }
  },
  getPrqWarRoomItems: async (hospitalId: string): Promise<PrqWarRoomItem[]> => {
    const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/prq-war-room-items`);
    return parse<PrqWarRoomItem[]>(res);
  },

  createPrqWarRoomItem: async (
    hospitalId: string,
    role: UserRole,
    userName: string,
    payload: { title: string; category: "PRQ" | "Site Review" | "Evidence" | "Policy" | "Other"; owner: string; dueDate: string; notes: string }
  ): Promise<PrqWarRoomItem> => {
    const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/prq-war-room-items`, {
      method: "POST",
      headers: { ...headers(role, userName), "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return parse<PrqWarRoomItem>(res);
  },

  updatePrqWarRoomItem: async (
    hospitalId: string,
    itemId: string,
    role: UserRole,
    userName: string,
    payload: Partial<Pick<PrqWarRoomItem, "status" | "owner" | "dueDate" | "notes" | "title" | "category">>
  ): Promise<PrqWarRoomItem> => {
    const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/prq-war-room-items/${itemId}`, {
      method: "PATCH",
      headers: { ...headers(role, userName), "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return parse<PrqWarRoomItem>(res);
  },

  deletePrqWarRoomItem: async (hospitalId: string, itemId: string, role: UserRole, userName: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/prq-war-room-items/${itemId}`, {
      method: "DELETE",
      headers: headers(role, userName)
    });
    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({ error: "Request failed" }));
      throw new Error(err.error || "Request failed");
    }
  },

  getCommitteePeople: async (hospitalId: string): Promise<CommitteePerson[]> => {
    const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/committee-people`);
    return parse<CommitteePerson[]>(res);
  },

  createCommitteePerson: async (
    hospitalId: string,
    role: UserRole,
    userName: string,
    payload: { name: string; degrees: string }
  ): Promise<CommitteePerson> => {
    const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/committee-people`, {
      method: "POST",
      headers: { ...headers(role, userName), "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return parse<CommitteePerson>(res);
  },

  getRoleAssignments: async (
    hospitalId: string,
    standardCode: string
  ): Promise<{ roleList: string[]; assignments: StandardRoleAssignment[] }> => {
    const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/standards/${standardCode}/role-assignments`);
    return parse<{ roleList: string[]; assignments: StandardRoleAssignment[] }>(res);
  },

  createRoleAssignment: async (
    hospitalId: string,
    standardCode: string,
    role: UserRole,
    userName: string,
    payload: { roleName: string; assignmentType?: "primary" | "alternate"; personId?: string; personName?: string; degrees?: string; startDate: string; endDate?: string; notes?: string }
  ): Promise<StandardRoleAssignment> => {
    const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/standards/${standardCode}/role-assignments`, {
      method: "POST",
      headers: { ...headers(role, userName), "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return parse<StandardRoleAssignment>(res);
  },

  updateRoleAssignment: async (
    hospitalId: string,
    standardCode: string,
    assignmentId: string,
    role: UserRole,
    userName: string,
    payload: Partial<Pick<StandardRoleAssignment, "roleName" | "assignmentType" | "personId" | "personName" | "degrees" | "startDate" | "endDate" | "notes">>
  ): Promise<StandardRoleAssignment> => {
    const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/standards/${standardCode}/role-assignments/${assignmentId}`, {
      method: "PATCH",
      headers: { ...headers(role, userName), "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return parse<StandardRoleAssignment>(res);
  },

  deleteRoleAssignment: async (
    hospitalId: string,
    standardCode: string,
    assignmentId: string,
    role: UserRole,
    userName: string
  ): Promise<void> => {
    const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/standards/${standardCode}/role-assignments/${assignmentId}`, {
      method: "DELETE",
      headers: headers(role, userName)
    });
    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({ error: "Request failed" }));
      throw new Error(err.error || "Request failed");
    }
  },

  getCommitteeMeetings: async (hospitalId: string): Promise<CommitteeMeeting[]> => {
    const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/committee-meetings`);
    return parse<CommitteeMeeting[]>(res);
  },

  createCommitteeMeeting: async (
    hospitalId: string,
    role: UserRole,
    userName: string,
    payload: { title: string; meetingDate: string; quarter: "Q1" | "Q2" | "Q3" | "Q4"; presenter: string; conferenceCaseCount: number; notes: string; standardCodes: string[]; referencedRoleAssignmentIds: string[]; referencedUploadIds: string[]; appendices: CommitteeMeetingAppendixInput[]; minutes: string }
  ): Promise<CommitteeMeeting> => {
    const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/committee-meetings`, {
      method: "POST",
      headers: { ...headers(role, userName), "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return parse<CommitteeMeeting>(res);
  },

  updateCommitteeMeeting: async (
    hospitalId: string,
    meetingId: string,
    role: UserRole,
    userName: string,
    payload: Partial<Pick<CommitteeMeeting, "title" | "meetingDate" | "quarter" | "presenter" | "conferenceCaseCount" | "status" | "notes" | "oncoLensAssist" | "standardCodes" | "referencedRoleAssignmentIds" | "referencedUploadIds" | "appendices" | "minutes">>
  ): Promise<CommitteeMeeting> => {
    const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/committee-meetings/${meetingId}`, {
      method: "PATCH",
      headers: { ...headers(role, userName), "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return parse<CommitteeMeeting>(res);
  },

  deleteCommitteeMeeting: async (hospitalId: string, meetingId: string, role: UserRole, userName: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/committee-meetings/${meetingId}`, {
      method: "DELETE",
      headers: headers(role, userName)
    });
    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({ error: "Request failed" }));
      throw new Error(err.error || "Request failed");
    }
  },

  getRegistryDashboard: async (hospitalId: string): Promise<RegistryDashboardSummary> => {
    const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/registry-dashboard`);
    return parse<RegistryDashboardSummary>(res);
  },

  getAuditLogs: async (hospitalId: string): Promise<AuditLogEntry[]> => {
    const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/audit-logs`);
    return parse<AuditLogEntry[]>(res);
  },

  getAuditorExport: async (hospitalId: string): Promise<AuditorExportResponse> => {
    const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/auditor-export`);
    return parse<AuditorExportResponse>(res);
  }
};





