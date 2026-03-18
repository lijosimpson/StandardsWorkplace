do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values
    ('evidence-uploads', 'evidence-uploads', false, 20971520, null),
    ('process-documents', 'process-documents', false, 20971520, null),
    ('quarterly-evidence', 'quarterly-evidence', false, 20971520, null),
    ('quality-reference-docs', 'quality-reference-docs', false, 20971520, null)
  on conflict (id) do nothing;
end $$;
