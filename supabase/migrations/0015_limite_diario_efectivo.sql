-- 0015_limite_diario_efectivo.sql
-- Resuelve en UN solo lugar server-side el límite diario efectivo de
-- postulaciones de un usuario, con 3 niveles de precedencia:
--   1. Override por usuario  → user_application_limits      (0012)
--   2. Default por rol       → app_settings (daily_free_application_limit /
--                                             admin_daily_application_limit)
--   3. Fallback por código   → 2 (user) / 10 (admin)
--
-- La resolución es una RPC security definer (mismo patrón que has_role /
-- increment_daily_usage, con search_path fijo): así un cliente autenticado
-- puede resolver su límite SIN acceso directo a user_application_limits (que
-- no publica policies RLS a authenticated). UI (getUsoDiario), corte real del
-- envío y merge del panel admin leen el MISMO valor desde acá.

create or replace function public.obtener_limite_diario_efectivo(p_user_id uuid)
returns table (limite integer, rol text, override boolean)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_rol      text;
  v_key      text;
  v_setting  text;
  v_override integer;
begin
  -- Nivel de rol: admin tiene precedencia sobre 'user'; sin fila, 'user'.
  select coalesce(
    (select role from public.user_roles where user_id = p_user_id and role = 'admin' limit 1),
    (select role from public.user_roles where user_id = p_user_id and role = 'user' limit 1),
    'user'
  ) into v_rol;

  v_key := case when v_rol = 'admin'
    then 'admin_daily_application_limit'
    else 'daily_free_application_limit'
  end;

  -- app_settings.value es jsonb: desarmamos el escalar string/number para
  -- quedarnos con el número; si el valor no es un entero válido, fallback.
  select case
    when jsonb_typeof(value) = 'string' then value #>> '{}'
    when jsonb_typeof(value) = 'number' then value #>> '{}'
    else null
  end into v_setting
  from public.app_settings
  where key = v_key;

  if v_setting is not null and v_setting ~ '^[0-9]+$' then
    limite := v_setting::integer;
  else
    limite := case when v_rol = 'admin' then 10 else 2 end;
  end if;

  -- Nivel 1: el override por usuario gana siempre (si la fila existe).
  select daily_limit into v_override
  from public.user_application_limits
  where user_id = p_user_id;

  override := v_override is not null;
  if v_override is not null then
    limite := v_override;
  end if;

  rol := v_rol;
  return next;
end;
$function$;

revoke execute on function public.obtener_limite_diario_efectivo(uuid) from public;
grant execute on function public.obtener_limite_diario_efectivo(uuid) to authenticated, service_role;