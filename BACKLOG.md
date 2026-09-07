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

## Bugs pendientes verificados (auditoría 06/09/2026 — retomar en próxima sesión)

Auditoría sobre `HEAD` (b72ca21). El repo ya está sincronizado con GitHub; estos bugs viven en el
código actual. Priorizados por severidad. Verificación de referencia: `bun run typecheck`, `bun run lint`,
`bun run test`.

### Alta
- [ ] **Callback de Gmail no vuelve a la postulación ni habilita "Enviar desde Gmail"** —
      flujo OAuth (`auth.gmail-callback.tsx` + `procesarGmailCallback`): tras conectar Gmail debe
      redirigir a la postulación de origen y el botón debe quedar "conectado". Todos los tests manuales
      fallaron hasta ahora (aterrizaba en `/perfil`; el guardado de tokens fallaba contra el schema real).
      Fixes aplicados 06/09 (commits 48938de + 6afdbae): service role para las escrituras, oauth conectado
      = fila en `oauth_connections` (schema real de Lovable Cloud), origen embebido en el state + tarjeta
      de diagnóstico en el callback. **Pendiente: verificar en navegador y retomar.**
- [x] **Cuota reembolsada por error de la 2ª operación** — `src/lib/server/enviar-postulacion-email.ts`.
      El `decrement_daily_usage` ahora solo corre si falla `enviarPostulacionGmail`; si falla la
      persistencia posterior (`UPDATE` de `status=sent`) el mail ya salió y la cuota NO se revierte.
      Fix 06/09 (commit pendiente) + test.
- [x] **Sin guarda de idempotencia en el server** — `src/lib/server/enviar-postulacion-email.ts`.
      Al leer la `application`, si `status === "sent"` → throw ("Esa postulación ya fue enviada").
      Fix 06/09 (commit pendiente) + test.

### Media
- [ ] **`MOCK_GMAIL` sin guarda de producción** — `src/lib/server/gmail-send.ts:146`,
      `src/lib/server/gmail-oauth.ts:96,372`. `getEnv("MOCK_GMAIL") === "true"` retorna éxito sin enviar
      mail. A diferencia de `MOCK_AUTH` (reforzado con `isProduction()` en `src/lib/server/env.ts`),
      `MOCK_GMAIL` no tiene esa guarda: un deploy de prod con la var seteada por error marcaría
      postulaciones como enviadas que nunca salieron, silenciosamente. Fix: aplicar `isProduction()` igual
      que `MOCK_AUTH`.
- [ ] **Retry puede duplicar el envío** — `src/lib/server/gmail-send.ts` reintenta en 429/5xx
      (`sendWithTransientRetry`); si el primer request sí llegó a Gmail y solo se perdió la respuesta, el
      reintento manda un segundo email. Combinado con la idempotencia faltante, el riesgo de duplicados es
      concreto. Fix: dedup (ej. mismo `Message-ID`) o verificar estado antes de reintentar.
- [ ] **Prompt injection + sin límite de tamaño** — `src/lib/ai/ai-postulacion.functions.ts:30`,
      `src/lib/job-post.functions.ts:7`. `raw_text` (contenido del aviso, input del usuario) se interpola
      crudo en el prompt; `image_base64` no tiene `max()`. Daño acotado por el schema Zod, pero es un
      vector real. Fix: delimitadores en el prompt + instrucción de ignorar texto ajeno al job posting;
      `max()` en los schemas.
- [ ] **PDF roto con caracteres no-WinAnsi** — `src/lib/cv-pdf-core.ts` (fonts StandardFonts/Halvetica →
      codificación WinAnsi). `drawText` lanza excepción con emojis, cirílico o símbolos no mapeables
      (comunes en CVs). Rompe `descargarPdf` (`src/lib/cv.export.ts:19`) y el adjunto por Gmail
      (`src/lib/server/gmail-send.ts:214`). Fix: sanitizar/reemplazar caracteres no soportados antes de
      dibujar, o fuente con subsetting.

### Baja (opcionales)
- [x] `redirect` de `/login` ignorado — `login.tsx` y `auth.callback.tsx` ahora leen `?redirect`,
      lo validan (solo rutas internas, sin open redirect) y vuelven ahí tras autenticarse. Fix 06/09.
- [x] Archivos temporales de adjunto (`resumes/{user}/tmp/`) no se limpian si el envío falla en storage —
      `src/lib/server/gmail-send.ts` borra el temporal en un `finally` (éxito o fallo del envío). Fix 06/09.
- [x] Stale cache del CV "primario" al guardar — `src/routes/_authenticated/cv.tsx` ahora invalida
      también `["cv","primario"]` al guardar. Fix 06/09.
- [x] Dead code: `enviarPostulacion` legacy exportado — `src/lib/application.functions.ts` (bloque del
      "Enviar" viejo, que gastaba cuota sin mandar mail). Se verificó que ningún UI ni test lo usaba
      (el mutation `enviar` nunca se disparaba) y se eliminó con sus wrappers en `postulaciones.$id.tsx`.
      Fix 06/09.
- [x] Foto en base64 guardada íntegra en `structured_json` — la foto ahora se comprime al subirla en el
      editor (`src/lib/foto-cv.ts`): JPEG de ~512px (~20-60 KB) en vez de los varios MB del original, que
      inflaban cada listado/save de CVs. Sin cambios de schema; límite de 6MB al elegir archivo. Fix 06/09.
- [x] Rate-limit en memoria con IP derivada de `x-forwarded-for` spooleable —
      `src/lib/server/rate-limit.ts` prioriza `CF-Connecting-IP` (Cloudflare Workers) sobre los headers
      inyectables. Fix 06/09.
- [x] Sesión expirada con mensaje genérico "Unauthorized" — `src/lib/supabase/auth-middleware.ts` ahora
      distingue refresh fallido ("Tu sesión expiró…") de no-autenticado. Fix 06/09.
- [x] Error boundary solo en la raíz — nuevo `src/components/RouteError.tsx` (fallback en español con
      "Intentar de nuevo" y "Volver al inicio") conectado como `errorComponent` de `_authenticated` en
      `src/routes/_authenticated/route.tsx`; las excepciones en rutas privadas ya no caen al error global
      en inglés. Fix 06/09.

## Pendientes técnicos no bloqueantes (fix del 18/08 — consolidación de auth)

- [ ] Decidir si usar Supabase local (Docker) o Cloud de forma definitiva, y documentarlo en
      `CLAUDE.md` — hoy conviven señales de ambos (config.toml para local, pero el handoff de Copilot
      habla de Cloud).
- [ ] Si el proyecto real es Supabase Cloud: ir al Dashboard → Authentication → URL Configuration y
      confirmar que `http://localhost:8080/auth/callback` (o el dominio de deploy) está en la lista de
      Redirect URLs permitidas. `supabase/config.toml` no aplica a un proyecto Cloud.
      Si en cambio se sigue usando Supabase local, chequear que quedó igual el
      Google Cloud Console con `http://127.0.0.1:54321/auth/v1/callback`.
- [x] Confirmar que el schema real en el Supabase que están usando coincide con
      `supabase/migrations/0001` a `0003` — verificado 06/09: NO coincidía (Lovable Cloud nunca creó
      `oauth_connection_status` y su `oauth_connections` difiere de 0001/0007). Código alineado al schema
      real + `0011_reconcile_oauth_live_schema.sql` para DBs frescas (commit 6afdbae).
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

## UI — pendientes de interfaz

- [ ] **Landing: rebranding "PostulaYa! JACK" + logos de herramientas** — `src/routes/index.tsx:113`
      hoy muestra "Jack · prototipo de interfaz". Cambiar a "PostulaYa! JACK" y agregar en esa zona los
      logos de las IAs (Gemini AI, Claude AI, ChatGPT AI, Kimi AI, OpenCode AI — devs tool) y de los
      editores (VS Code, Antigravity, Cursor, Sublime). Sin brand resources aún: decidir de dónde salen
      los assets (SVG inline / íconos). Requerimiento del usuario 06/09.
