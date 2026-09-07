-- 0011_reconcile_oauth_live_schema.sql
-- Reconciliación git <-> Supabase real para oauth_connections:
-- el proyecto en producción tiene una tabla oauth_connections CREADA por
-- Lovable Cloud (fuente de verdad) que difiere de la "intencionada" en
-- 0001/0007. Esta migración hace que una DB armada solo con las migraciones
-- termine con el MISMO schema que la real. Defensivo (IF EXISTS / IF NOT EXISTS).
--
-- Schema REAL de oauth_connections:
--   id, user_id, provider, scopes, access_token, refresh_token, expires_at,
--   created_at, updated_at, encrypted_access_token
-- NO tiene: connected_at, revoked_at, encrypted_refresh_token
-- oauth_connection_status NO existe en la DB real y el código ya no la usa.

alter table public.oauth_connections
  drop column if exists connected_at,
  drop column if exists revoked_at,
  drop column if exists encrypted_refresh_token;

alter table public.oauth_connections
  add column if not exists access_token text,
  add column if not exists refresh_token text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

drop table if exists public.oauth_connection_status;
drop policy if exists "oauth_status_select_own" on public.oauth_connection_status;

-- oauth_connections queda igual que en la real: service_role-only.
alter table public.oauth_connections enable row level security;
grant all on public.oauth_connections to service_role;
revoke all on public.oauth_connections from anon;
revoke all on public.oauth_connections from authenticated;