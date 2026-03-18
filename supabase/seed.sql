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

insert into hospitals (id, name)
values ('hosp-001', 'Augusta Regional Cancer Center')
on conflict (id) do update set
  name = excluded.name,
  updated_at = now();
