# Supabase Project Files

This folder contains the Supabase project scaffold for local CLI use and hosted setup.

## Important

These files are not all SQL.

Do not run these in the Supabase SQL editor:

- config.toml
- README.md

Those files are documentation or CLI configuration, not database scripts.

## If you are using the hosted Supabase SQL editor

Run this file first:

- sql-editor/01_hosted_full_setup.sql

That one file creates the schema, inserts the default `app_state` row, creates the storage buckets, and seeds the default hospital.

## If you are using the Supabase CLI locally

Files used by the CLI:

- config.toml
- seed.sql
- migrations/20260318_0001_initial_schema.sql
- migrations/20260318_0002_storage_buckets.sql

From the repo root:

```powershell
supabase start
supabase db reset
supabase status
```

## Execution order for raw SQL files

If you want to run the split SQL files manually in the hosted SQL editor, use this order:

1. migrations/20260318_0001_initial_schema.sql
2. migrations/20260318_0002_storage_buckets.sql
3. seed.sql

## Notes

- The backend currently uses the `app_state` table as the durable persistence target.
- Supabase Storage buckets are created for the next upload migration step.
- The backend still expects service-role access and does not rely on anonymous browser writes.
