-- 0004_reconcile_live_schema.sql
-- Reconciliación git <-> Supabase real, después de varias sesiones de fixes
-- manuales hechos directo en el SQL Editor (no versionados). Objetivo: que
-- correr las migraciones desde cero contra un Supabase nuevo produzca el mismo
-- resultado que el proyecto real que está corriendo hoy.
--
-- Todo este archivo es defensivo (IF NOT EXISTS / IF EXISTS / REVOKE sin
-- fallar si no había nada que revocar) para poder aplicarse sin conocer con
-- 100% de certeza el estado intermedio de cada sesión anterior.

-- =========================================================
-- 1) user_roles no existía en el proyecto real — se crea ahora.
-- =========================================================
create table if not exists public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'admin')),
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

alter table public.user_roles enable row level security;

drop policy if exists "user_roles_select_own" on public.user_roles;
create policy "user_roles_select_own"
  on public.user_roles for select
  using (auth.uid() = user_id);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

create or replace function public.has_role(p_user_id uuid, p_role text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = p_user_id and role = p_role
  );
$$;

revoke execute on function public.has_role(uuid, text) from public;
grant execute on function public.has_role(uuid, text) to authenticated, service_role;

-- =========================================================
-- 2) handle_new_user: la versión real en producción insertaba en columnas
--    (id, full_name) que no existen en la tabla profiles real (user_id,
--    nombre) — probablemente bloqueaba CUALQUIER signup nuevo, porque el
--    trigger corre AFTER INSERT ON auth.users sin manejo de excepciones.
--    Se corrige acá para que coincida con las columnas reales, y se agrega
--    el alta en user_roles ahora que la tabla existe.
-- =========================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  insert into public.profiles (user_id, nombre, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', null),
    new.email
  )
  on conflict (user_id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id, role) do nothing;

  return new;
end;
$function$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- 3) oauth_connections: nunca debe ser legible/escribible por el cliente.
--    Se desconoce el estado exacto después de las sesiones manuales, así que
--    esto se aplica sin importar qué policies/grants tenga hoy: borra
--    cualquier policy con nombres conocidos (propios o de Lovable Cloud) y
--    revoca privilegios de tabla para anon/authenticated. REVOKE no falla si
--    no había nada otorgado.
-- =========================================================
drop policy if exists "oauth_connections_select_own" on public.oauth_connections;
drop policy if exists "Users can view their own oauth connections" on public.oauth_connections;
drop policy if exists "Enable read access for all users" on public.oauth_connections;

revoke all on public.oauth_connections from anon;
revoke all on public.oauth_connections from authenticated;
grant all on public.oauth_connections to service_role;

-- =========================================================
-- 4) Alta retroactiva: usuarios que ya existían antes de este fix no tienen
--    fila en user_roles (el trigger viejo no las creaba). Se completan como
--    'user' — nadie queda con rol 'admin' por default.
-- =========================================================
insert into public.user_roles (user_id, role)
select id, 'user' from auth.users
on conflict (user_id, role) do nothing;
