-- 0009_avatars_storage.sql
-- Bucket público para avatares de perfil.
--
-- A diferencia de `resumes` (bucket privado, porque ahí viven CVs originales),
-- los avatares deben leerse de forma pública por el navegador vía URL directa
-- (getPublicUrl + el <img> de Radix Avatar), por eso `public = true`.
--
-- Cada usuario escribe SOLO en su carpeta avatars/{user_id}/... La ruta se
-- resuelve por el prefijo del path (storage.foldername), el mismo patrón que ya
-- usa `resumes`.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Lectura pública: cualquiera puede ver cualquier avatar (son fotos de perfil,
-- no datos sensibles). La URL pública del storage por defecto ya permite leer
-- sin política, pero la dejamos explícita para no depender del comportamiento
-- por defecto del storage público.
create policy "avatars_storage_select_all"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- El usuario solo puede subir a su propia carpeta avatars/{user_id}/...
create policy "avatars_storage_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

-- El usuario solo puede borrar de su propia carpeta.
create policy "avatars_storage_delete_own"
  on storage.objects for delete
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
