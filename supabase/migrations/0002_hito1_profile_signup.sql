-- 0002_hito1_profile_signup.sql
-- Hito 1: columnas que faltaban en profiles para el onboarding real de Google, y
-- un trigger sobre auth.users que crea la fila de profiles (y el rol 'user') en
-- el momento del signup — así el perfil siempre existe para cualquier usuario
-- autenticado, sin depender de que el cliente haga un insert extra que podría
-- fallar o duplicarse entre pestañas.

alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists skills text[] not null default '{}';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, nombre, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.email,
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (user_id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

-- No necesita GRANT EXECUTE a ningún rol de cliente: lo dispara Postgres
-- internamente en el insert de auth.users (Supabase Auth corre eso con su propio
-- rol interno), nunca lo llama el frontend.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
