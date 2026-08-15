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

## Pendientes técnicos no bloqueantes (Hito 0)

- [ ] Confirmar el puerto real de `bun run dev` (Lovable hace detección de sandbox) y ajustar
      `playwright.config.ts` (`PORT`) — no se pudo correr `bun` en el sandbox donde se preparó este hito.
      Ver comentario en `playwright.config.ts`.
- [ ] Generar assets de ícono PWA reales (192x192 y 512x512, maskable); hoy `manifest.webmanifest` apunta
      al `favicon.ico` existente como placeholder — el navegador va a tirar un warning/404 leve en
      consola hasta que se agreguen.
- [ ] Al sembrar el primer usuario admin, hacerlo con un insert directo en `user_roles` vía
      `service_role` (SQL en Supabase Studio o script server-side), nunca desde un endpoint expuesto al
      cliente.

## Mejoras evaluadas para después del MVP

- Guardar más de una versión de CV y que Jack sugiera cuál usar según el tipo de vacante
  (el esquema `resumes` ya soporta múltiples registros por usuario desde esta migración).
