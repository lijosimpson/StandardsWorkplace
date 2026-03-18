create extension if not exists pgcrypto;


create table if not exists app_state (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists hospitals (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists standard_states (
  id uuid primary key default gen_random_uuid(),
  hospital_id text not null references hospitals(id) on delete cascade,
  standard_code text not null,
  components_complete jsonb not null default '[]'::jsonb,
  metric_labels jsonb not null default '[]'::jsonb,
  denominator_value integer not null,
  status text not null,
  lock_note text not null default '',
  process_quarter_checks jsonb not null default '{}'::jsonb,
  process_hidden_steps jsonb not null default '{}'::jsonb,
  last_updated_at timestamptz not null default now(),
  last_updated_by text not null,
  unique (hospital_id, standard_code)
);

create table if not exists audit_logs (
  id text primary key,
  hospital_id text not null references hospitals(id) on delete cascade,
  standard_code text not null,
  action text not null,
  details text not null,
  user_name text not null,
  user_role text not null,
  timestamp timestamptz not null
);
create index if not exists audit_logs_hospital_timestamp_idx on audit_logs (hospital_id, timestamp desc);

create table if not exists assignments (
  id text primary key,
  hospital_id text not null references hospitals(id) on delete cascade,
  standard_code text not null,
  component_label text not null,
  assignee text not null,
  due_date date not null,
  status text not null,
  updated_at timestamptz not null,
  updated_by text not null
);
create index if not exists assignments_hospital_standard_idx on assignments (hospital_id, standard_code);

create table if not exists uploads (
  id text primary key,
  hospital_id text not null references hospitals(id) on delete cascade,
  standard_code text not null,
  original_name text not null,
  stored_name text not null,
  storage_bucket text not null,
  storage_path text not null,
  size_bytes bigint not null,
  uploaded_at timestamptz not null,
  uploaded_by text not null
);
create index if not exists uploads_hospital_standard_idx on uploads (hospital_id, standard_code);

create table if not exists process_documents (
  id text primary key,
  hospital_id text not null references hospitals(id) on delete cascade,
  standard_code text not null,
  process_index integer not null,
  original_name text not null,
  stored_name text not null,
  storage_bucket text not null,
  storage_path text not null,
  size_bytes bigint not null,
  uploaded_at timestamptz not null,
  uploaded_by text not null
);
create index if not exists process_documents_hospital_standard_idx on process_documents (hospital_id, standard_code);

create table if not exists quarterly_evidence (
  id text primary key,
  hospital_id text not null references hospitals(id) on delete cascade,
  standard_code text not null,
  quarter text not null,
  original_name text not null,
  stored_name text not null,
  storage_bucket text not null,
  storage_path text not null,
  size_bytes bigint not null,
  uploaded_at timestamptz not null,
  uploaded_by text not null
);
create index if not exists quarterly_evidence_hospital_standard_idx on quarterly_evidence (hospital_id, standard_code, quarter);

create table if not exists quality_reference_documents (
  id text primary key,
  hospital_id text not null references hospitals(id) on delete cascade,
  framework text not null,
  title text not null,
  original_name text not null,
  stored_name text not null,
  storage_bucket text not null,
  storage_path text not null,
  size_bytes bigint not null,
  uploaded_at timestamptz not null,
  uploaded_by text not null
);
create index if not exists quality_reference_documents_hospital_framework_idx on quality_reference_documents (hospital_id, framework);

create table if not exists committee_people (
  id text primary key,
  hospital_id text not null references hospitals(id) on delete cascade,
  name text not null,
  degrees text not null,
  updated_at timestamptz not null,
  updated_by text not null
);

create table if not exists standard_role_assignments (
  id text primary key,
  hospital_id text not null references hospitals(id) on delete cascade,
  standard_code text not null,
  role_name text not null,
  assignment_type text not null,
  person_id text not null,
  person_name text not null,
  degrees text not null,
  start_date date not null,
  end_date date,
  notes text not null,
  updated_at timestamptz not null,
  updated_by text not null,
  foreign key (person_id) references committee_people(id) on delete restrict
);
create index if not exists standard_role_assignments_hospital_standard_idx on standard_role_assignments (hospital_id, standard_code);

create table if not exists committee_meetings (
  id text primary key,
  hospital_id text not null references hospitals(id) on delete cascade,
  title text not null,
  meeting_date date not null,
  quarter text not null,
  presenter text not null,
  conference_case_count integer not null default 0,
  status text not null,
  onco_lens_assist boolean not null default false,
  notes text not null,
  standard_codes jsonb not null default '[]'::jsonb,
  referenced_role_assignment_ids jsonb not null default '[]'::jsonb,
  referenced_upload_ids jsonb not null default '[]'::jsonb,
  minutes text not null,
  role_attendance jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null,
  updated_by text not null
);
create index if not exists committee_meetings_hospital_date_idx on committee_meetings (hospital_id, meeting_date desc);

create table if not exists committee_meeting_appendices (
  id text primary key,
  meeting_id text not null references committee_meetings(id) on delete cascade,
  source_type text not null,
  source_id text not null,
  standard_code text not null,
  original_name text not null,
  storage_path text not null,
  process_index integer,
  explanation text not null default ''
);
create index if not exists committee_meeting_appendices_meeting_idx on committee_meeting_appendices (meeting_id);

create table if not exists custom_quality_metrics (
  id text primary key,
  hospital_id text not null references hospitals(id) on delete cascade,
  standard_code text not null,
  framework text not null,
  title text not null,
  description text not null,
  target text not null,
  status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  created_by text not null,
  updated_by text not null
);
create index if not exists custom_quality_metrics_hospital_standard_idx on custom_quality_metrics (hospital_id, standard_code);

create table if not exists strategy_checklist_items (
  id text primary key,
  hospital_id text not null references hospitals(id) on delete cascade,
  title text not null,
  standard_code text not null,
  checked boolean not null default false,
  notes text not null,
  updated_at timestamptz not null,
  updated_by text not null
);

create table if not exists prq_war_room_items (
  id text primary key,
  hospital_id text not null references hospitals(id) on delete cascade,
  title text not null,
  category text not null,
  owner text not null,
  due_date date not null,
  status text not null,
  notes text not null,
  updated_at timestamptz not null,
  updated_by text not null
);

insert into hospitals (id, name)
values ('hosp-001', 'Augusta Regional Cancer Center')
on conflict (id) do update set
  name = excluded.name,
  updated_at = now();
insert into app_state (id, payload, updated_at)
values (
  'default',
  jsonb_build_object(
    'stateEntries', '[]'::jsonb,
    'auditLog', '[]'::jsonb,
    'assignments', '[]'::jsonb,
    'uploads', '[]'::jsonb,
    'customQualityMetrics', '[]'::jsonb,
    'processDocuments', '[]'::jsonb,
    'qualityReferenceDocuments', '[]'::jsonb,
    'prqWarRoomItems', '[]'::jsonb,
    'committeeMeetings', '[]'::jsonb,
    'committeePeople', '[]'::jsonb,
    'quarterlyEvidence', '[]'::jsonb,
    'strategyChecklistItems', '[]'::jsonb,
    'standardRoleAssignments', '[]'::jsonb
  ),
  now()
)
on conflict (id) do nothing;
