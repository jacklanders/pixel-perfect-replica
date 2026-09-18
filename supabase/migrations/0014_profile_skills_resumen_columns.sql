-- 0014_profile_skills_resumen_columns.sql
-- Ítem 5 del backlog (18/09): decidir el destino de `profiles.skills` (y del
-- `resumen`) valiéndose de COLUMNAS reales, no del jsonb `preferencias`.
--
-- Contexto / por qué:
--   - `skills` y `resumen` se guardaban en `preferencias` jsonb (perfil.model),
--     pero la columna `profiles.skills` existe desde 0002 y había quedado sin
--     uso consistente: gmail-send la leía directo (=> el CV adjuntado salía sin
--     skills) y el save del /perfil las DESCATABA (zod las removía del payload).
--   - Decisión: fuente única = columnas. `skills` (text[]) + `resumen` (text).
--     `preferencias` jsonb deja de ser el almacén de estos dos campos.
--
-- Esta migración es idempotente y hace el backfill de los datos existentes.

alter table public.profiles
  add column if not exists resumen text;

-- Backfill: skills/resumen → columnas, solo si vienen del jsonb legacy.
update public.profiles
set
  skills = case
    when jsonb_typeof(preferencias -> 'skills') = 'array' then
      (select coalesce(array_agg(elem), '{}'::text[])
         from jsonb_array_elements_text(preferencias -> 'skills') as t(elem))
    else skills
  end,
  resumen = case
    when jsonb_typeof(preferencias -> 'resumen') = 'string' then preferencias ->> 'resumen'
    else resumen
  end
where preferencias is not null
  and preferencias <> '{}'::jsonb;