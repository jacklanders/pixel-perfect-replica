-- Limpieza: columnas agregadas en 0002 pero no usadas por la app
alter table public.profiles drop column if exists avatar_url;
alter table public.profiles drop column if exists skills;