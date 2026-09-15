-- 0005_user_application_limits.sql
-- Overrides de límite diario PER USUARIO (por encima del default por rol).
--
-- Contexto (decisión 15/09):
--   - El límite diario de postulaciones hoy vive hardcodeado (2) en dos lados del
--     código TS, y `app_settings` (daily_free_application_limit /
--     admin_daily_application_limit) existen en la DB pero ningún server fn las lee.
--   - Con esta tabla el admin puede subir el límite de un usuario específico SIN
--     tocar el default global; el usuario ve el número real vía getUsoDiario y el
--     enforcer del envío usa el mismo valor.
--
-- Reglas:
--   - Solo service_role lee/escribe. RLS: ningún policy a authenticated/anon
--     (el admin lo hace server-side vía getServiceClient, mismo patrón que
--     oauth_connections / user_roles).
--   - fila null = "sin override" → se usa el default de su rol (app_settings).

create table if not exists public.user_application_limits (
  user_id   uuid        not null references auth.users (id) on delete cascade,
  daily_limit integer   not null check (daily_limit >= 0),
  updated_by uuid       references auth.users (id),
  updated_at timestamptz not null default now(),
  motivo     text,
  primary key (user_id)
);

alter table public.user_application_limits enable row level security;

grant all on public.user_application_limits to service_role;

-- Nadie del cliente puede mirar/modificar overrides: ni anon ni authenticated.
grant select on public.user_application_limits to authenticated;
grant all on public.user_application_limits to service_role;
