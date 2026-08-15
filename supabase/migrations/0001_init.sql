-- 0001_init.sql
-- Modelo de datos mínimo del MVP (Fases 1 y 2). Toda tabla con datos de usuario
-- lleva RLS habilitado en esta misma migración, con policies que atan auth.uid()
-- a user_id, y GRANT explícito por tabla (defensa en profundidad además de RLS).
--
-- Revisión 2 (post feedback de Lovable):
--   - Se agregan GRANT explícitos en cada tabla.
--   - oauth_connections queda completamente fuera del alcance de anon/authenticated
--     (ni policy de select ni grant de tabla); solo service_role la toca.
--   - El rol de admin pasa de profiles.role a una tabla user_roles + función
--     has_role() security definer (patrón recomendado por Supabase para evitar
--     recursión de RLS y auto-escalación de privilegios).
--   - increment_daily_usage: ya tenía `set search_path = public`; se agrega el
--     REVOKE/GRANT EXECUTE explícito que faltaba.

create extension if not exists "pgcrypto";

-- =========================================================
-- user_roles (separada de profiles a propósito)
-- =========================================================
create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'admin')),
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

alter table public.user_roles enable row level security;

create policy "user_roles_select_own"
  on public.user_roles for select
  using (auth.uid() = user_id);

-- Sin policy de insert/update/delete para authenticated: los roles solo los
-- asigna service_role (script de seed del primer admin, o un endpoint de
-- servidor protegido). Nadie se autoasigna 'admin' vía API.

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

-- security definer + search_path fijo: evita que la función quede vulnerable a
-- un search_path manipulado, y evita problemas de recursión de RLS al chequear
-- rol desde dentro de otras policies.
create or replace function public.has_role(p_user_id uuid, p_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = p_user_id and role = p_role
  );
$$;

revoke execute on function public.has_role(uuid, text) from public;
grant execute on function public.has_role(uuid, text) to authenticated, service_role;

-- =========================================================
-- profiles
-- =========================================================
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nombre text,
  email text not null,
  telefono text,
  ubicacion text,
  rubro_objetivo text,
  firma_mail text,
  preferencias jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

-- =========================================================
-- resumes (soporta múltiples CV por usuario desde el día 1)
-- =========================================================
create table public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Mi CV',
  is_primary boolean not null default true,
  source_type text not null check (source_type in ('uploaded_pdf', 'uploaded_docx', 'created_from_scratch')),
  structured_json jsonb not null default '{}'::jsonb,
  extracted_text text,
  file_path_original text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index resumes_user_id_idx on public.resumes (user_id);

alter table public.resumes enable row level security;

create policy "resumes_select_own"
  on public.resumes for select
  using (auth.uid() = user_id);

create policy "resumes_insert_own"
  on public.resumes for insert
  with check (auth.uid() = user_id);

create policy "resumes_update_own"
  on public.resumes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "resumes_delete_own"
  on public.resumes for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.resumes to authenticated;
grant all on public.resumes to service_role;

-- =========================================================
-- job_posts
-- =========================================================
create table public.job_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_type text not null check (source_type in ('text', 'image', 'url')),
  raw_text text,
  extracted_json jsonb not null default '{}'::jsonb,
  posted_at timestamptz,
  closing_at timestamptz,
  employer text,
  role text,
  location text,
  created_at timestamptz not null default now()
);

create index job_posts_user_id_idx on public.job_posts (user_id);

alter table public.job_posts enable row level security;

create policy "job_posts_select_own"
  on public.job_posts for select
  using (auth.uid() = user_id);

create policy "job_posts_insert_own"
  on public.job_posts for insert
  with check (auth.uid() = user_id);

create policy "job_posts_update_own"
  on public.job_posts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "job_posts_delete_own"
  on public.job_posts for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.job_posts to authenticated;
grant all on public.job_posts to service_role;

-- =========================================================
-- applications
-- =========================================================
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  resume_id uuid not null references public.resumes (id) on delete restrict,
  job_post_id uuid not null references public.job_posts (id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'sent', 'discarded')),
  discard_reason text,
  generated_subject text,
  required_subject text,
  generated_body text,
  destination_email text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index applications_user_id_idx on public.applications (user_id);
create index applications_status_idx on public.applications (user_id, status);

alter table public.applications enable row level security;

create policy "applications_select_own"
  on public.applications for select
  using (auth.uid() = user_id);

create policy "applications_insert_own"
  on public.applications for insert
  with check (auth.uid() = user_id);

create policy "applications_update_own"
  on public.applications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Sin policy ni grant de delete: el historial se conserva (se puede "discarded").
grant select, insert, update on public.applications to authenticated;
grant all on public.applications to service_role;

-- =========================================================
-- daily_usage (límite de 2 postulaciones/día, transaccional server-side)
-- =========================================================
create table public.daily_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null default current_date,
  application_generations integer not null default 0,
  ai_calls integer not null default 0,
  cost_estimate_usd numeric(10, 4) not null default 0,
  primary key (user_id, usage_date)
);

alter table public.daily_usage enable row level security;

create policy "daily_usage_select_own"
  on public.daily_usage for select
  using (auth.uid() = user_id);

-- Solo SELECT para authenticated: los contadores los escribe exclusivamente
-- increment_daily_usage() (security definer) o service_role, nunca un UPDATE
-- directo del cliente — así nadie resetea su propio contador manipulando el
-- frontend, ni siquiera con las devtools abiertas.
grant select on public.daily_usage to authenticated;
grant all on public.daily_usage to service_role;

create or replace function public.increment_daily_usage(p_limit integer)
returns table (used_today integer, remaining_today integer, allowed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_current integer;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  insert into public.daily_usage (user_id, usage_date, application_generations)
  values (v_user_id, current_date, 0)
  on conflict (user_id, usage_date) do nothing;

  select application_generations into v_current
  from public.daily_usage
  where user_id = v_user_id and usage_date = current_date
  for update;

  if v_current >= p_limit then
    return query select v_current, greatest(p_limit - v_current, 0), false;
    return;
  end if;

  update public.daily_usage
  set application_generations = application_generations + 1
  where user_id = v_user_id and usage_date = current_date;

  v_current := v_current + 1;
  return query select v_current, greatest(p_limit - v_current, 0), true;
end;
$$;

-- Función security definer: sin este REVOKE/GRANT, Postgres deja EXECUTE abierto
-- a PUBLIC (incluido anon) por default.
revoke execute on function public.increment_daily_usage(integer) from public;
grant execute on function public.increment_daily_usage(integer) to authenticated;

-- =========================================================
-- app_settings (límites/feature flags no secretos)
-- =========================================================
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

-- Lectura pública (para cualquier authenticated) de settings no secretos, ej. el
-- límite diario vigente para mostrarlo en la UI. La escritura NO tiene policy
-- para authenticated: solo service_role, o un server function que primero valida
-- has_role(auth.uid(), 'admin') antes de escribir.
create policy "app_settings_select_all_authenticated"
  on public.app_settings for select
  using (auth.role() = 'authenticated');

grant select on public.app_settings to authenticated;
grant all on public.app_settings to service_role;

insert into public.app_settings (key, value) values
  ('daily_free_application_limit', '2'),
  ('admin_daily_application_limit', '10'),
  ('max_upload_size_mb', '10'),
  ('ai_provider', '"gemini"');

-- =========================================================
-- oauth_connection_status — flag no sensible, sí legible por el usuario
-- (para mostrar "Gmail conectado" en la UI sin exponer el token)
-- =========================================================
create table public.oauth_connection_status (
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null default 'google_gmail',
  connected boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table public.oauth_connection_status enable row level security;

create policy "oauth_status_select_own"
  on public.oauth_connection_status for select
  using (auth.uid() = user_id);

-- Solo SELECT para el usuario: el flag lo flipea el server function que hace el
-- callback de OAuth (con service_role), nunca el propio cliente.
grant select on public.oauth_connection_status to authenticated;
grant all on public.oauth_connection_status to service_role;

-- =========================================================
-- oauth_connections — tokens de Gmail. CERO acceso de cliente.
-- =========================================================
create table public.oauth_connections (
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null default 'google_gmail',
  encrypted_refresh_token text,
  scopes text[] not null default array[]::text[],
  connected_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_id, provider)
);

-- RLS habilitado y SIN NINGUNA POLICY: ni anon ni authenticated pueden ver una
-- sola fila, tengan o no grant de tabla. Se deja además sin GRANT a
-- authenticated/anon como segunda barrera (defensa en profundidad: aunque en el
-- futuro alguien agregue una policy por error, sin GRANT de tabla igual no hay
-- acceso). Solo service_role —que en Supabase bypassea RLS— puede leer/escribir,
-- siempre desde un server function, nunca desde el navegador.
alter table public.oauth_connections enable row level security;

grant all on public.oauth_connections to service_role;
-- Deliberadamente: NO grant a authenticated, NO grant a anon, NO policies.

-- =========================================================
-- Storage: bucket privado para CVs originales
-- =========================================================
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

create policy "resumes_storage_select_own"
  on storage.objects for select
  using (bucket_id = 'resumes' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "resumes_storage_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'resumes' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "resumes_storage_delete_own"
  on storage.objects for delete
  using (bucket_id = 'resumes' and auth.uid()::text = (storage.foldername(name))[1]);

-- Convención de path esperada: resumes/{user_id}/{resume_id}/{filename}
