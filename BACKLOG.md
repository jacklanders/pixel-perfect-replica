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
