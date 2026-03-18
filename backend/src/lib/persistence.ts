import fs from "fs";
import { supabaseAdmin, isSupabaseConfigured } from "./supabase";

export interface PersistedStateEntry<T> {
  key: string;
  value: T;
}

export interface PersistedData<TState = unknown> {
  stateEntries: Array<PersistedStateEntry<TState>>;
  auditLog: unknown[];
  assignments: unknown[];
  uploads: unknown[];
  customQualityMetrics: unknown[];
  processDocuments: unknown[];
  qualityReferenceDocuments: unknown[];
  prqWarRoomItems: unknown[];
  committeeMeetings: unknown[];
  committeePeople: unknown[];
  quarterlyEvidence: unknown[];
  strategyChecklistItems: unknown[];
  standardRoleAssignments: unknown[];
}

const APP_STATE_ID = "default";

const readLocalPersistedData = <TData>(dataFile: string): TData | null => {
  if (!fs.existsSync(dataFile)) return null;
  const raw = fs.readFileSync(dataFile, "utf8");
  if (!raw.trim()) return null;
  return JSON.parse(raw) as TData;
};

export const loadPersistedData = async <TData>(dataFile: string): Promise<TData | null> => {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    return readLocalPersistedData(dataFile);
  }

  const { data, error } = await supabaseAdmin
    .from("app_state")
    .select("payload")
    .eq("id", APP_STATE_ID)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load persisted state from Supabase: ${error.message}`);
  }

  if (!data?.payload) {
    return readLocalPersistedData(dataFile);
  }

  return data.payload as TData;
};

export const savePersistedData = async <TData>(payload: TData, dataFile: string): Promise<void> => {
  if (isSupabaseConfigured && supabaseAdmin) {
    const { error } = await supabaseAdmin
      .from("app_state")
      .upsert({
        id: APP_STATE_ID,
        payload,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      throw new Error(`Failed to save persisted state to Supabase: ${error.message}`);
    }
    return;
  }

  fs.writeFileSync(dataFile, JSON.stringify(payload, null, 2));
};
