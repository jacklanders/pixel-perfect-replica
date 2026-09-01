-- Restaura la columna avatar_url en profiles: la migración 0005 la eliminó porque
-- en ese momento nadie la usaba, pero subirAvatar/quitarAvatar (src/lib/perfil.functions.ts)
-- la necesitan para guardar la URL pública de la foto de perfil.

alter table public.profiles
  add column if not exists avatar_url text;

-- Seguridad: no exponer la columna fuera de lo necesario. Las RLS de profiles ya
-- existen en migraciones anteriores; avatar_url se incluye en los select/update
-- permitidos por esas políticas (columna nueva no cambia el comportamiento).
