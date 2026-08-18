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

- [x] Confirmar el puerto real de `bun run dev` (Lovable hace detección de sandbox) y ajustar
      `playwright.config.ts` (`PORT`) — resuelto: el servidor usa 8080 por defecto.
- [ ] Generar assets de ícono PWA reales (192x192 y 512x512, maskable); hoy `manifest.webmanifest` apunta
      al `favicon.ico` existente como placeholder — el navegador va a tirar un warning/404 leve en
      consola hasta que se agreguen.
- [ ] Al sembrar el primer usuario admin, hacerlo con un insert directo en `user_roles` vía
      `service_role` (SQL en Supabase Studio o script server-side), nunca desde un endpoint expuesto al
      cliente.

## Hito 1 — Login real, perfil y CVs (Supabase externo)

- [x] Cliente de navegador tipado, validación de bearer en servidor y middleware de adjunción de token.
- [x] Layout protegido `_authenticated` y redirección de login.
- [x] Pantalla /login con Google OAuth y email.
- [x] Server functions para perfil (get + guardar, alta automática).
- [x] Server functions para CVs (CRUD + duplicar).
- [x] UI de /perfil, /mis-cv y /cv conectada a datos reales mediante TanStack Query.
- [x] Tests unitarios para perfil.model y cv.model.
- [ ] Integrar el patch de backend de Claude (cookies @supabase/ssr) y resolver
      conflictos de forma manual, sin sobreescribir su trabajo.
- [ ] Cargar variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el proyecto.
- [ ] Tests E2E de login real una vez disponibles las credenciales.

## Mejoras evaluadas para después del MVP

- Guardar más de una versión de CV y que Jack sugiera cuál usar según el tipo de vacante
  (el esquema `resumes` ya soporta múltiples registros por usuario desde esta migración).
