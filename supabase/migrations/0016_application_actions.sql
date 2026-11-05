-- 0016_application_actions.sql
-- Acciones del usuario sobre sus propias postulaciones:
--   * nuevo estado 'paused' (en pausa, reanudable a 'pending')
--   * borrado duro permitido solo al dueño (antes el historial era inmutable)

-- El nombre del check puede variar según cómo se creó el esquema en cada
-- entorno, así que se buscan y eliminan todos los checks que mencionen status.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.applications'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.applications drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.applications
  add constraint applications_status_check
  check (status in ('pending', 'sent', 'discarded', 'paused'));

drop policy if exists "applications_delete_own" on public.applications;
create policy "applications_delete_own"
  on public.applications for delete
  using (auth.uid() = user_id);

grant delete on public.applications to authenticated;
