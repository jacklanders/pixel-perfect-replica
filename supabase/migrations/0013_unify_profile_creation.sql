-- 0013_unify_profile_creation.sql
-- Unifica el ALTA de perfiles en UN solo lugar (decisión 15/09, item 4 del backlog).
--
-- Contexto:
--   - La fila de profiles la creaban DOS caminos redundantes:
--       1. El trigger handle_new_user (0002/0004) al insertar en auth.users.
--       2. El insert de fallback en getMiPerfil (src/lib/perfil.functions.ts),
--          que además es IMPRESCIDIBLE: en MOCK_AUTH no existe fila en auth.users
--          y el trigger no dispara, y cubre a usuarios legacy sin fila.
--   - Con este fix el trigger queda SOLO para sembrar el rol 'user' en
--     user_roles; el alta de profiles pasa a ser responsabilidad exclusiva de
--     getMiPerfil (server-side, idempotente con la lectura previa).
--
-- Beneficio colateral: reemplaza la versión rota de handle_new_user que el Cloud
-- heredó de Lovable (insertaba en columnas inexistentes id/full_name, lo que
-- bloqueaba cualquier signup). Aplicar este archivo en el SQL Editor del Cloud
-- Cierra también el ítem 11 pendiente de 0004.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
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