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
- [x] **Callback de Gmail no vuelve a la postulación ni habilita "Enviar desde Gmail"** —
      flujo OAuth (`auth.gmail-callback.tsx` + `procesarGmailCallback`): tras conectar Gmail debe
      redirigir a la postulación de origen y el botón debe quedar "conectado". Todos los tests manuales
      fallaron hasta ahora (aterrizaba en `/perfil`; el guardado de tokens fallaba contra el schema real).
      Fixes aplicados 06/09 (commits 48938de + 6afdbae): service role para las escrituras, oauth conectado
      = fila en `oauth_connections` (schema real de Lovable Cloud), origen embebido en el state + tarjeta
      de diagnóstico en el callback.
      **Verificado 07/09 en producción** (deploy `nitro deploy --prebuilt` → versión
      `2c0fe84c-7df9-4a95-855a-36d442487098`): login con Google OK, el callback vuelve a la postulación
      de origen, el botón "Enviar desde Gmail" queda activo y el mail se entrega (prueba real del usuario).
- [x] **Cuota reembolsada por error de la 2ª operación** — `src/lib/server/enviar-postulacion-email.ts`.
      El `decrement_daily_usage` ahora solo corre si falla `enviarPostulacionGmail`; si falla la
      persistencia posterior (`UPDATE` de `status=sent`) el mail ya salió y la cuota NO se revierte.
      Fix 06/09 (commit pendiente) + test.
- [x] **Sin guarda de idempotencia en el server** — `src/lib/server/enviar-postulacion-email.ts`.
      Al leer la `application`, si `status === "sent"` → throw ("Esa postulación ya fue enviada").
      Fix 06/09 (commit pendiente) + test.

### Media
- [x] **`MOCK_GMAIL` sin guarda de producción** — ahora se exige `NODE_ENV !== "production"` en
      `src/lib/server/gmail-send.ts:146`, `gmail-oauth.ts:96` y `gmail-oauth.ts:374`: un deploy de prod con
      `MOCK_GMAIL=true` ya no marca envíos que nunca salieron ni conecta Gmail sin OAuth real. Fix 06/09.
- [x] **Retry puede duplicar el envío** — los envíos con resultado AMBIGUO (petición sin respuesta o 200
      ilegible: el correo pudo haber llegado a Gmail) ya no se reintentan: `GmailEnvioAmbiguoError` en
      `gmail-send.ts`, y la cuota diaria NO se revierte en ese caso (revertirla habilitaría un reintento
      que duplica el correo). El retry queda solo para rechazos HTTP definitivos (429/5xx/401+refresh),
      donde Gmail respondió NO. Límite por intento bajado a 1 retry. Fix 06/09 + 5 tests.
- [x] **Prompt injection + sin límite de tamaño** — `raw_text` con `max(20000)` y `image_base64` con
      `max(4.000.000)` (mensajes de error en español) en `ai-postulacion.functions.ts` +
      `job-post.functions.ts`; el prompt de extracción ahora enmarca el aviso con
      `--- INICIO/FIN DEL AVISO ---` e instruye a la IA a tratar TODO lo que esté dentro como contenido
      del aviso (ignorar instrucciones/prompts embebidos). Fix 06/09.
- [x] **PDF roto con caracteres no-WinAnsi** — nuevo `sanitizarTextoPdf` en `src/lib/cv-pdf-core.ts`:
      antes de dibujar, los caracteres que las fuentes estándar no pueden codificar (emojis, cirílico,
      CJK) se reemplazan por `?`; se conservan acentos Latin-1 y la extensión WinAnsi (comillas
      tipográficas, guiones, …). Aplica en `drawText` y `drawWrapped` → `descargarPdf` y adjunto por
      Gmail ya no explotan con estos caracteres. Fix 06/09 + 5 tests.

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

## CI — fallas de workflow (GitHub Actions, runner `ubuntu-latest`)

Ultimamente ~15 runs en rojo. El job `e2e` (`bun run test:e2e` → `playwright test`) nunca llega a
ejecutar las specs: el collection se rompe durante la carga de `e2e/login.e2e.ts`.

- [x] **`e2e/login.e2e.ts:16` — collection crash: `TypeError: test.skip(...) is not a function`.**
      `test.skip(isMockAuth, "...")("...", async ...)` no es válido en Playwright: `test.skip(cond,
      msg)` se invoca DENTRO del cuerpo de un test (devuelve `void`), no como wrapper que retorna un
      test. Rompe TODO el runner de e2e (`bun run test:e2e` — error exacto en el run). Fix: `test(...,
      () => { test.skip(isMockAuth, "..."); ... })`.
      → Cerrado 06/09: skip movido al cuerpo del test.
- [x] **`e2e` — mismatch de `MOCK_AUTH` entre webServer y specs.** `playwright.config.ts:23` fuerza
      `MOCK_AUTH: "true"` en el env del webServer (local y CI), pero `login.e2e.ts:3` deriva
      `isMockAuth = process.env.MOCK_AUTH === "true"` del env del RUNNER, que en CI no está seteado.
      Aunque se corra la colección, ese test (redirect `/perfil → /login` sin sesión) se ejecutaría
      contra un app con `MOCK_AUTH=true` (sesión determinística) y fallaría por timeout. Alinear el
      criterio de skip a la config del webServer y revisar el resto de specs (`auth.setup.ts` comenta
      puerto 3000 y `storageState` no está cableado en los projects; `gmail-flow`/`postulaciones`)
      para dejar el job verde en CI.
      → Cerrado 06/09: webServer usa `process.env.MOCK_AUTH ?? "true"`; el test de sesión skipea
      salvo `MOCK_AUTH=false`. Verificado local: 4 smoke pasan, 7 flujos con DB skip (igual que CI).
- [ ] **Cleanup menor (opcional): `e2e/auth.setup.ts` es dead code** — testMatch es `*.e2e.ts` y
      `auth.setup.ts` no calza, así que nunca corre; el `storageState` (e2e/.auth/user.json) que
      referencia no está cableado en `projects`. Borrar o cablear bien el setup de auth.
- [x] **Callback Gmail: error `connected_at` aún visible en browser (dato 06/09).** El código actual
      NO referencia `connected_at` (grep verificado; solo comentarios en `gmail-oauth.ts:241` y
      `types.ts:194`). La consola mostraba nombres de bundle hasheados (`auth.gmail-callback-*.js`,
      `index-*.js`), típicos de un build de producción: el error salía del app desplegado (Lovable,
      build anterior a los fixes `48938de`/`6afdbae`) o de una pestaña cacheada.
      → Cerrado 07/09: redeploy a producción (versión `2c0fe84c-…`), bundle verificado con el fix y
      flujo Gmail real OK en navegador; el error `connected_at` no reapareció.
