# Backlog

No implementar nada de esto durante Fases 1 y 2 / Hitos 0–5, salvo decisión explícita en contrario.

## Fuera de alcance por decisión de producto (ver prompt completo)

- **Fase 3** — Búsqueda automática de avisos (scraping/API de portales de empleo).
  `job_posts.source_type`/`source_url` ya están preparados para esto, sin implementar la ingestión.
- **Fase 4** — Login/envío desde Hotmail, Yahoo, Facebook (solo Google en el MVP).
- **Fase 5** — App nativa iOS/Android (PWA responsive primero).
- **Fase 7** — Extensión de navegador/editor.
- **Fase 8** — Chat de ideación de producto dentro del panel admin.
- **Fase 9** — Monetización (Ads, pagos, paywall).

## Pendientes técnicos no bloqueantes (fix del 18/08 — consolidación de auth)

- [ ] Decidir si usar Supabase local (Docker) o Cloud de forma definitiva, y documentarlo en
      `CLAUDE.md` — hoy conviven señales de ambos (config.toml para local, pero el handoff de Copilot
      habla de Cloud).
- [ ] Si el proyecto real es Supabase Cloud: ir al Dashboard → Authentication → URL Configuration y
      confirmar que `http://localhost:8080/auth/callback` (o el dominio de deploy) está en la lista de
      Redirect URLs permitidas. `supabase/config.toml` no aplica a un proyecto Cloud.
      Si en cambio se sigue usando Supabase local, chequear que quedó igual el
      Google Cloud Console con `http://127.0.0.1:54321/auth/v1/callback`.
- [ ] Confirmar que el schema real en el Supabase que están usando coincide con
      `supabase/migrations/0001` a `0003` — hay indicios de que Lovable Cloud pudo haber escrito
      políticas propias directo en la base (nombres de policy tipo "Public profiles are viewable by
      everyone" en el historial), fuera de las migraciones versionadas.
- [ ] Unificar el alta de perfil: hoy hay trigger (`0002`) + insert de fallback en `getMiPerfil` — no es
      grave pero es redundante.
- [ ] Decidir si `profiles.avatar_url`/`profiles.skills` (columnas de la migración `0002`) se usan de
      verdad o se eliminan — hoy `perfil.model.ts` guarda todo en `preferencias` jsonb y esas columnas
      quedaron sin usar.
- [ ] `login.tsx` no implementa el `redirect` de vuelta que ahora manda `_authenticated/route.tsx`
      (`search: { redirect: location.href }`) — hoy simplemente ignora ese parámetro y siempre manda a
      `/perfil` después del login. No es un bug, pero es una mejora de UX pendiente.

## Pendientes técnicos no bloqueantes (Hito 1)

- [ ] Smoke test real: login con Google local (Docker) end-to-end, incluyendo refresh de página
      logueado. Es la parte no probada de este hito — ver nota en `src/lib/supabase/server.ts`.
- [ ] `bun run test:e2e` de login sigue sin mockear Supabase Auth (no se agregó en este hito); el
      smoke test de Playwright existente solo cubre la landing. Agregar un mock de auth antes de que
      esto crezca, para no depender de Google real en CI.
- [ ] Edición de avatar ("Cambiar foto") no está implementada — Hito 1 solo muestra el avatar de Google
      si existe.
- [ ] `firma_mail` hoy es un textarea libre; falta decidir si se autogenera a partir de los otros
      campos (como sugiere el placeholder) o si queda 100% editable a mano.

## Pendientes técnicos no bloqueantes (Hito 0)

- [ ] Generar assets de ícono PWA reales (192x192 y 512x512, maskable); hoy `manifest.webmanifest` apunta
      al `favicon.ico` existente como placeholder — el navegador va a tirar un warning/404 leve en
      consola hasta que se agreguen.
- [ ] Al sembrar el primer usuario admin, hacerlo con un insert directo en `user_roles` vía
      `service_role` (SQL en Supabase Studio o script server-side), nunca desde un endpoint expuesto al
      cliente.

## Mejoras evaluadas para después del MVP

- Guardar más de una versión de CV y que Jack sugiera cuál usar según el tipo de vacante
  (el esquema `resumes` ya soporta múltiples registros por usuario desde esta migración).
