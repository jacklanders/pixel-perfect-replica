-- 0008_decrement_daily_usage.sql
-- Reversión de la reserva de cuota diaria cuando un envío falla ("cuota solo en
-- éxito"). increment_daily_usage() reserva atómicamente una unidad; si el envío
-- por Gmail luego falla, decrement_daily_usage() libera esa reserva para no
-- gastar cuota en envíos fallidos.
--
-- Como increment_daily_usage(), es security definer y ajusta SOLO el uso de
-- auth.uid(); nunca baja de 0 (greatest), así que el usuario no puede resetear
-- su contador abusando de esto.

create or replace function public.decrement_daily_usage()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_new integer;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  update public.daily_usage
  set application_generations = greatest(application_generations - 1, 0)
  where user_id = v_user_id and usage_date = current_date
  returning application_generations into v_new;

  return v_new;
end;
$$;

-- Mismo modelo de permisos que increment_daily_usage(): solo authenticated.
revoke execute on function public.decrement_daily_usage() from public;
grant execute on function public.decrement_daily_usage() to authenticated;
