-- 0006_add_updated_at_to_applications.sql
-- La columna updated_at no existía en applications pero el código la usaba.

alter table public.applications
add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists applications_updated_at on public.applications;
create trigger applications_updated_at
  before update on public.applications
  for each row execute function public.set_updated_at();

revoke execute on function public.set_updated_at() from public;
grant execute on function public.set_updated_at() to authenticated, service_role;