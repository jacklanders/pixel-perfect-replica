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

## Última sesión — 19/09/2026 (dónde quedamos para retomar)

Entregado y EN PRODUCCIÓN (`https://app.postulaya-jack.workers.dev`, última versión `2a372f66`
deploy 21:00; session wrangler OAuth activa para deployear en la próxima).

- **Adjunto CV de Jack (pdf-lib) funciona en prod** — shim tslib ampliado a superset 1.x+2.x
  (commit `2819fa1`), CI verde, deploy `23b9ccd5`. Confirmado por el usuario: el PDF llega adjunto.
- **Cuerpo del mail NUNCA vacío** — fallback determinístico `generarCuerpoDesdeCv`
  (`src/lib/ai/cuerpo-postulacion.ts`): si Jack no devuelve cuerpo (caída/JSON incompleto), se arma
  con la info real del CV. Commit `35370c9`, deploy `42c609ec`. +7 tests. Usuario probó OK.
- **No atascarse por "mucha demanda" de la IA** — retry con backoff en el provider
  (`fetchConReintentos`, 3 intentos, 400/900ms ante 429/5xx/red) + **modo manual** en "Cargar aviso"
  (botón "Prefiero cargar los datos yo" + recuperación tras el error; sirve para imagen/PDF con
  proveedor caído). Commit `7dbd7e0`, deploy `2a372f66`. +6 tests.

Suite: **87 tests ✅ / typecheck ✅ / lint 0 errores ✅ / build ✅**.

### Siguiente sesión — continuar acá (pendientes Hito 5 / certificación)
- 🔴 **S2 — Smoke vertical completo del MVP**: se validaron partes (adjunto pdf-lib, cuerpo no vacío,
  no-atasco por demanda), pero falta el recorrido íntegro login → perfil → CV → aviso → extraer →
  postular → copiar → Gmail → enviar, + 2ª/3ª operación y **límite diario**.
- 🟠 **S3 — Casos de error Gmail reales**: token expirado/revocado, 401, 429, 5xx, envío ambiguo,
  idempotencia (2º envío), adjunto en fallo.
- 🟠 **S4 — Observabilidad**: setear `VITE_SENTRY_DSN` + `VITE_POSTHOG_KEY` y confirmar eventos
  (login/CV/extracción/postulación/copy/Gmail/límite).
  → **Código listo 25/09, falta activar y verificar** (ver "Certificación del MVP").
- 🟡 **S5 — Docs de cierre**: README + BACKLOG + CHANGELOG al declarar el MVP cerrado.
- 🟡 **Decidir Vercel** (solo decidir): si el dolor es el dominio largo → dominio custom en
  Cloudflare Workers sin migrar.
- Tras S1–S5: **declarar Hito 5 / cierre del MVP**.
- Post-MVP: **multi-CV** con sugerencia de cuál usar según la vacante.

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

- [x] Decidir si usar Supabase local (Docker) o Cloud de forma definitiva, y documentarlo en
      `CLAUDE.md` — hoy conviven señales de ambos (config.toml para local, pero el handoff de Copilot
      habla de Cloud).
      → **Cerrado 15/09 (decisión del usuario, opción 1): Supabase Cloud es la fuente de verdad**
      (proyecto Lovable Cloud). El código, schema y migraciones se alinean contra Cloud; el
      `supabase/config.toml`/Docker local queda SOLO como espejo de desarrollo opcional, nunca como
      referencia. Decisión documentada en `CLAUDE.md` (sección Stack).
- [x] Confirmar en Auth → URL Configuration del proyecto Cloud (y en Google Cloud Console) que
      `http://localhost:8080/auth/callback` y el dominio de deploy (`https://app.postulaya-jack.workers.dev`)
      figuran en las Redirect URLs permitidas. `supabase/config.toml` no aplica a un proyecto Cloud.
      → **Cerrado 15/09**: en Auth → URL Configuration del Cloud quedaron agregados
      `https://app.postulaya-jack.workers.dev/auth/callback` y `http://localhost:8080/auth/callback`.
      En Google Cloud Console, Authorized redirect URIs cargadas: `https://kjlttxxwgumcqgswfrdl.supabase.co/auth/v1/callback`
      (Login, la de Supabase), `https://app.postulaya-jack.workers.dev/auth/gmail-callback` (Gmail prod) y
      `http://localhost:8080/auth/gmail-callback` (Gmail local).
- [x] Confirmar que el schema real en el Supabase que están usando coincide con
      `supabase/migrations/0001` a `0003` — verificado 06/09: NO coincidía (Lovable Cloud nunca creó
      `oauth_connection_status` y su `oauth_connections` difiere de 0001/0007). Código alineado al schema
      real + `0011_reconcile_oauth_live_schema.sql` para DBs frescas (commit 6afdbae).
- [x] Unificar el alta de perfil: hoy hay trigger (`0002`) + insert de fallback en `getMiPerfil` — no es
      grave pero es redundante.
      → **Cerrado 18/09**: el trigger `handle_new_user` ya NO inserta en `profiles` (solo siembra el rol
      `user` en `user_roles`); el alta de la fila es responsabilidad única de `getMiPerfil`
      (`0013_unify_profile_creation.sql`). El fallback es imprescindible (cubre MOCK_AUTH, donde no hay
      fila en auth.users y el trigger nunca dispara). Aplicado al Cloud 18/09 ("Success. No rows returned").
- [x] Decidir si `profiles.skills` (columna de `0002`) se usa de verdad o se elimina — `avatar_url`
      ya estaba en uso (avatares, 18/09).
      → **Cerrado 18/09**: se usa de verdad. Decisión: `skills` y `resumen` pasan a columnas reales
      (fuente única), el jsonb `preferencias` deja de almacenarlos. Incluye el fix de un bug latente:
      el save del `/perfil` DESCARTABA skills/resumen (zod los removía del payload). Migración
      `0014_profile_skills_resumen_columns.sql` (backfill desde preferencias). Aplicado al Cloud 18/09
      (backfill sin filas legacy → no-op correcto).
- [x] `login.tsx` no implementaba el `redirect` de vuelta que ahora manda `_authenticated/route.tsx`
      (`search: { redirect: location.href }`) — ignoraba el parámetro y siempre mandaba a `/perfil`.
      → **Cerrado 18/09**: el flujo completo ya está cableado — el guard redirige a `/login?redirect=`,
      `login.tsx` valida (solo rutas internas) y reenvía el redirect al `/auth/callback`, y el callback
      vuelve a la ruta de origen. Anti-open-redirect en ambos lados. `location.href` de TanStack es
      relativo (sin origen), así la validación no lo descarta.

## Pendientes técnicos no bloqueantes (Hito 1)

- [ ] Smoke test real: login con Google local (Docker) end-to-end, incluyendo refresh de página
      logueado. Es la parte no probada de este hito — ver nota en `src/lib/supabase/server.ts`.
- [x] `bun run test:e2e` de login sin mockear Supabase Auth; el smoke de Playwright solo cubría la
      landing. Agregar un mock de auth para no depender de Google real en CI.
      → **Cerrado 18/09**: el mock de auth YA existe y cubre CI sin Google — `MOCK_AUTH=true`
      (default del webServer en `playwright.config.ts`) hace que `requireSupabaseAuth` inyecte el
      usuario determinístico `test@jack.local`. Verificado local: `bun run test:e2e` en modo mock =
      5 passed / 7 skipped (los skips requieren Supabase local vía `.env.local`, no Google). El único
      test real de Google (guard → `/login?redirect=`) es opt-in con `MOCK_AUTH=false`. Nota: el repo
      no tiene workflows `.github/`; si se agrega CI, corre sin secretos en modo mock.
- [x] Edición de avatar ("Cambiar foto") no estaba implementada — hoy solo mostraba el avatar de Google.
      → **Cerrado 18/09**: `subirAvatar`/`quitarAvatar` (`src/lib/perfil.functions.ts`) con bucket
      `avatars` (migraciones 0009/0010) y botones "Cambiar foto"/"Quitar" en `perfil.tsx`.
- [x] `firma_mail` era un textarea libre; faltaba decidir autogeneración vs editable.
      → **Cerrado 18/09**: resuelto como editable con sugerencia — textarea que usa `firmaSugerida`
      como fallback cuando está vacío y botón "Restaurar firma sugerida" (`perfil.tsx`).

## Pendientes técnicos no bloqueantes (Hito 0)

- [x] Generar assets de ícono PWA reales (192x192 y 512x512, maskable) — faltaban los assets.
      → **Cerrado 18/09**: `public/icon-192x192.png`, `icon-512x512.png` y `maskable-512x512.png`
      existen y el manifest los referencia con `purpose: "maskable"`.
- [x] Al sembrar el primer usuario admin, hacerlo con un insert directo en `user_roles` vía
      `service_role` (SQL en Supabase Studio o script server-side), nunca desde un endpoint expuesto al
      cliente. → **Cerrado 15/09**: `user_roles` NO existía en el Cloud real (0004 nunca aplicada);
      se creó la tabla + `has_role()` en el SQL Editor (sections 1 y 4 de 0004) y se promovió a admin a
      `juliocesarvelozo@gmail.com` (UUID `9b2c3c26-1a4e-4055-8041-d82763027c47`) con insert vía `service_role`.
      Pendiente conexo: aplicar el resto de `0004_reconcile_live_schema.sql` al Cloud (fix de `handle_new_user`
      y limpieza de `oauth_connections`) para alinear el schema real con el repo.
      → **Cerrado 18/09**: 0013 (handle_new_user → solo user_roles), 0014 (columna resumen + backfill),
      0012 (user_application_limits) y 0004 sección 3 (revoke oauth_connections) aplicados en el SQL Editor
      (`Success. No rows returned` — backfill no-op).

## Mejoras evaluadas para después del MVP

- Guardar más de una versión de CV y que Jack sugiera cuál usar según el tipo de vacante
  (el esquema `resumes` ya soporta múltiples registros por usuario desde esta migración).

## UI — pendientes de interfaz

- [x] **Landing: rebranding "PostulaYa! JACK" + logos de herramientas** — `src/routes/index.tsx:113`
      hoy muestra "Jack · prototipo de interfaz". Cambiar a "PostulaYa! JACK" y agregar en esa zona los
      logos de las IAs (Gemini AI, Claude AI, ChatGPT AI, Kimi AI, OpenCode AI — devs tool) y de los
      editores (VS Code, Antigravity, Cursor, Sublime). Sin brand resources aún: decidir de dónde salen
      los assets (SVG inline / íconos). Requerimiento del usuario 06/09.
      → **Cerrado 13/09**: títulos y footer a "PostulaYa! JACK"; el bloque de logos se movió del medio
      de la landing al pie (footer), en el mismo orden (fila de IAs + fila de editores); se sumó el
      logo de **Lovable** (SVG inline, gradiente real) a la fila de IAs. Vercel NO se agregó (pendiente
      de decisión, ver sección de migración).

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
- [x] **Cleanup menor (opcional): `e2e/auth.setup.ts` era dead code** — `testMatch` es `*.e2e.ts` y
      `auth.setup.ts` no calza, así que nunca corría; el `storageState` (e2e/.auth/user.json) que
      referencia no estaba cableado en `projects`.
      → **Cerrado 18/09**: archivo eliminado. Para correr con auth real se usa `MOCK_AUTH=false`
      (+ Supabase local); el mock determinístico queda como default del webServer.
- [x] **Callback Gmail: error `connected_at` aún visible en browser (dato 06/09).** El código actual
      NO referencia `connected_at` (grep verificado; solo comentarios en `gmail-oauth.ts:241` y
      `types.ts:194`). La consola mostraba nombres de bundle hasheados (`auth.gmail-callback-*.js`,
      `index-*.js`), típicos de un build de producción: el error salía del app desplegado (Lovable,
      build anterior a los fixes `48938de`/`6afdbae`) o de una pestaña cacheada.
      → Cerrado 07/09: redeploy a producción (versión `2c0fe84c-…`), bundle verificado con el fix y
      flujo Gmail real OK en navegador; el error `connected_at` no reapareció.

## Migración a Vercel — evaluación 13/09/2026 (pendiente de decisión)

Consulta del usuario 13/09: siente que el link del worker (`https://app.postulaya-jack.workers.dev`)
es largo y que el manejo de Cloudflare es denso. Evaluación técnica (no bloqueante, no ejecutada):

- **Factible.** TanStack Start + Nitro soporta el preset de deploy `vercel` (hoy el build sale con el
  preset de Workers vía `wrangler.json`); el deploy pasaría a Vercel CLI o a la integración de Vercel
  con GitHub.
- **Supabase no condiciona:** es un servicio externo; solo hay que reconfigurar el redirect URI de
  Google OAuth y las Auth URLs de Supabase con el dominio nuevo (`https://<proyecto>.vercel.app` o
  dominio custom).
- **Env vars:** mismos nombres que hoy; se setean en Vercel como Environment Variables. Las `VITE_*`
  quedan embebidas en build igual que ahora.
- **Rate-limit:** `src/lib/server/rate-limit.ts` prioriza `CF-Connecting-IP` (header de Cloudflare).
  En Vercel ese header no lo puebla nadie ⇒ cae al `x-forwarded-for`, que Vercel setea de forma
  confiable (no rompe, pero re-verificar en smoke test post-migración).
- **Alternativa sin migrar:** si el dolor es solo el dominio largo, configurar un dominio custom en
  Cloudflare Workers resolvería sin tocar infra.

→ Pendiente de decisión del usuario; si se ejecuta, documentar el cambio de preset en README y
  re-verificar el smoke test (incluido Gmail) en el dominio nuevo.

## Frontend — cambios realizados 13/09/2026 (sesión de UI)

Sesión 100% frontend/UI (sin backend ni e2e). `origin/main` quedó en `b3093d9`, deployado a producción
(versión `0fc04f27`).

- **Rebranding landing / footer:**
  - El bloque "Hecha con las herramientas favoritas de los devs" se movió del medio de la landing al pie.
  - Footer horizontal en una sola fila: `PostulaYa! JACK · MADE WITH: [iconos]`, chips compactos,
    + lamparita de tema alineada a la derecha (misma altura, sin bloques flotantes).
  - Logo **Lovable** (SVG inline con gradiente real naranja→rosa→azul) agregado a la fila de IAs.
    Vercel NO se agregó (decisión; ver sección de migración).
  - Marca del header: cajita **"CV"** + "PostulaYa! JACK" a la derecha (antes "J Jack").
  - Badge del hero: "PostulaYa! JACK · MVP" (antes "Prototipo Fase 1").
- **Theme switcher (lamparita):**
  - Tres paletas: **Jack Classic** (actual), **Jack Dark** (oscuro con el teal de la marca),
    **Jack Ayu** (paleta del tema *ayu* de VS Code/Sublime, variante dark: bg `#0B0E14`,
    ámbar `#FFB454` como acento, azul `#59C2FF`, gris de comentario `#565B66`).
  - Implementado con `data-theme` en `<html>` y paletas CSS en `src/styles.css`
    (`[data-theme="dark"]` y `[data-theme="ayu"]`); `--grid-line`, gradientes y sombras por tema.
  - Persistencia en `localStorage("jack-theme")` + script inline en el `<head>` (via `head().scripts`
    en `src/routes/__root.tsx`) para aplicar el tema antes del primer paint (sin flash).
  - UI en `src/components/ThemeSwitcher.tsx`: botón de lamparita que abre menú hacia arriba con check
    en el tema activo. **No flota**: está integrado a la barra inferior (footer de la landing) y a un
    footer nuevo en `src/components/AppShell.tsx` (área logueada).
  - `chart.tsx` configura `THEMES` con selector `.dark`: para dark/ayu se hace toggle de la clase
    `.dark` en `<html>`, así los `dark:` utilities siguen calzando.

## Pendientes activos — lista numerada (última actualización 13/09/2026)

Acceso rápido a los pendientes abiertos del fuerde alcance, mejoras y CI. Cada ítem tiene su detalle
completo en las secciones de arriba; esta lista los resume y prioriza.

1. **Supabase local vs Cloud** — **CERRADO 15/09**: Cloud es la fuente de verdad; el Docker local
   (`config.toml`) queda solo como espejo opcional (ver sección "Pendientes técnicos no bloqueantes
   (fix del 18/08…)" y `CLAUDE.md` → Stack).
2. **Redirect URLs de login** — **CERRADO 15/09**: verificadas en Supabase Auth → URL Configuration
   y en Google Cloud Console (Authorized redirect URIs del client: Supabase + Gmail prod + Gmail local;
   ver sección "Pendientes técnicos no bloqueantes (fix del 18/08…)").
3. **Seed del admin** — **CERRADO 15/09**: `user_roles` no existía en el Cloud real (0004 sin aplicar);
   se creó tabla + `has_role()` y se promovió a admin `juliocesarvelozo@gmail.com` vía insert con
   `service_role` en el SQL Editor.
4. **Landing: rebranding "PostulaYa! JACK" + logos de herramientas** — **CERRADO 13/09**: títulos y
   footer a "PostulaYa! JACK", logos movidos al pie en el mismo orden y logo de Lovable sumado a la
   fila de IAs (ver sección "UI — pendientes de interfaz").
5. **`login.tsx` ignora el `redirect`** que manda `_authenticated/route.tsx` — siempre cae a
   `/perfil` tras el login (mejora de UX, no bug). → **CERRADO 18/09**: flujo redirect completo en el
   guard → login → callback (ver sección "fix del 18/08").
6. **Edición de avatar ("Cambiar foto")** no implementada — Hito 1 solo muestra el avatar de Google.
   → **CERRADO 18/09**: `subirAvatar`/`quitarAvatar` + bucket `avatars` + botones en `perfil.tsx`
   (ver "Pendientes Hito 1").
7. **`firma_mail` textarea libre** — decidir si se autogenera desde los otros campos o queda 100%
   editable a mano (Hito 1). → **CERRADO 18/09**: editable con fallback a `firmaSugerida` y botón
   "Restaurar firma sugerida" (ver "Pendientes Hito 1").
8. **Unificar el alta de perfil** — trigger (`0002`) + insert de fallback en `getMiPerfil` son
   redundantes (fix del 18/08). → **CERRADO 18/09**: `0013_unify_profile_creation.sql` deja el
   trigger solo para `user_roles`; el alta de `profiles` queda en `getMiPerfil` (único creador).
   Cloud aplicado 18/09.
9. **`profiles.avatar_url` / `profiles.skills`** — decidir si se usan o se eliminan (hoy todo va a
   `preferencias` jsonb) — `avatar_url` ya se usa; sigue pendiente la decisión de `skills`.
   → **CERRADO 18/09**: `skills` (y `resumen`) pasan a columnas reales con backfill
   (`0014_profile_skills_resumen_columns.sql`); de paso se arregló que el save del `/perfil`
   descartara ambos campos. `src/lib/server/profile.ts` (getMyProfile/updateMyProfile) — dead code —
   se eliminó. Cloud aplicado 18/09.
10. **`bun run test:e2e` de login sin mockear Supabase Auth** — agrega un mock de auth para no
     depender de Google real en CI (Hito 1). → **CERRADO 18/09**: el mock de auth es `MOCK_AUTH=true`
     (inyecta `test@jack.local` vía `requireSupabaseAuth`); e2e verificado en modo mock sin Google
     (ver "Pendientes Hito 1").
11. **`e2e/auth.setup.ts` es dead code** — borrar o cablear el setup de auth en `projects` (CI,
     cleanup opcional). → **CERRADO 18/09**: archivo eliminado; `testMatch: *.e2e.ts` nunca lo corría
     y el `storageState` no estaba cableado. El criterio de auth real queda en `MOCK_AUTH=false`.
12. **Assets de ícono PWA reales** (192x192 y 512x512, maskable) — hoy apunta a favicon como
     placeholder (Hito 0). → **CERRADO 18/09**: los tres PNGs existen en `public/` y el manifest los
     referencia (ver "Pendientes Hito 0").
13. **Smoke test real: login con Google end-to-end**, incluyendo refresh de página
    logueado (ya estaba listado en "Pendientes Hito 1"; se consolida acá).
    → **Revisado 18/09**: se hace con Google real contra **producción** (Cloud es fuente de
    verdad), no con Docker local — ver sección "Certificación del MVP" abajo.
14. **Evaluar migración de Cloudflare Workers → Vercel** — preset `vercel` de Nitro, env vars sin
    cambio de nombres, reconfigurar Google OAuth + Supabase URLs con el dominio nuevo y chequear el
    header de rate-limit. Detalle en la sección "Migración a Vercel" de arriba.

Además, post-MVP (sin checkbox): guardar más de una versión de CV y que Jack sugiera cuál usar
según el tipo de vacante ("Mejoras evaluadas para después del MVP").

## Certificación del MVP (18/09/2026 — freeze de features)

Freeze de features: no agregar features grandes; certificar que lo existente funciona de punta a
punta. Registrado a partir del reporte de estado del 18/09 (etapa = certificación, no construcción).

- [x] 🔴 **Smoke real Hito 1** — login con Google real contra producción
      (`https://app.postulaya-jack.workers.dev`): login → `/perfil` → refresh (sesión viva) →
      editar perfil → guardar → refresh → datos persisten. Anotar cada bug (S1).
      → **Cerrado 18/09**: login Google real OK, refresh mantiene sesión, perfil guardado
      persiste tras refresh. Sin bugs.
- [ ] 🔴 **Smoke vertical completo del MVP** — login → perfil → crear CV → guardar → Mis CV →
      nuevo aviso → IA extrae → generar postulación → detalle → copiar → conectar Gmail → enviar →
      "Enviada". Probar 2ª/3ª operación y el **límite diario** (el sistema de límites cambió 18/09).
      Incluye validación funcional de IA real (Hito 2) y recorrido E2E de postulaciones (Hito 3) (S2).
- [ ] 🟠 **Casos de error Gmail reales** — desconectado, token expirado, token revocado, 401, 429,
      5xx, envío ambiguo, segundo envío (idempotencia), adjuntos en fallo (S3).
- [ ] 🟠 **Observabilidad activada** — setear `VITE_SENTRY_DSN` + `VITE_POSTHOG_KEY` y confirmar que
      llegan eventos de login/CV/extracción/postulación/copy/Gmail/límite (S4).
      → **Ver "S4 — Observabilidad (25/09)" más abajo: la instrumentación de cliente y server
      está completa y testeada; falta que el usuario cree las cuentas y cargue las claves.**
- [ ] 🟡 **Documentación de cierre** — README (tabla 0001→0015 ya actualizada 18/09, commit `9d3b9d8`)
      + BACKLOG + CHANGELOG, al declarar el MVP cerrado (S5).
- [ ] 🟡 **Decidir Vercel** (solo decidir, no necesariamente migrar) — si el dolor es solo el dominio
      largo, un dominio custom en Cloudflare Workers lo resuelve sin cambiar infra.
- [ ] Luego de S1–S5: **declarar estado del Hito 5 / cierre del MVP**.

### Bugs encontrados en la certificación
- [x] 🔴 **S2 — el adjunto del CV de Jack no viajaba en el mail.** `obtenerCvAttachment`
      (`gmail-send.ts`) usaba el embed `profiles(...)` sobre `resumes`, que FALLA en el schema
      real por no existir FK `resumes → profiles` (PostgREST: *"Could not find a relationship"*)
      y devolvía `null` en silencio → el mail salía sin CV. Solo el modo "Subir archivo"
      adjuntaba. Los tests no lo vieron porque el fake no replica la resolución de relaciones.
→ **Fix 18/09**: el perfil se lee como tabla aparte (2º query `profiles` por `user_id`);
      verificado contra Cloud: PDF real generado (4595 bytes, `%PDF-`). Tests: MIME con
      adjunto en ambos modos + assert de regresión (sin embed). Commit `fix-gmail-cv-attachment`
      pendiente de deploy.
- [x] 🔴 **S2 — el cuerpo del mail quedaba vacío a veces.** Cuando Jack (la IA) no devolvía
      un cuerpo (proveedor caído, JSON incompleto o `"cuerpo": ""`), la postulación quedaba
      con `generated_body` vacío: el schema aceptaba `""`, el insert nacía con `""` y los
      guards `if (cuerpo)` nunca lo reparaban (además el update no chequeaba error).
      Reportado por el usuario contra producción 19/09 (postulación `f196f3da-…`).
      → **Fix 19/09**: fallback determinístico `generarCuerpoDesdeCv`
      (`src/lib/ai/cuerpo-postulacion.ts`) que arma el cuerpo con la info REAL del
      CV/perfil (puesto+empresa, resumen, experiencia con fechas, habilidades,
      disponibilidad, firma): nunca vacío, nada inventado. Aplica en la creación
      (catch de la IA) y en la regeneración desde el detalle; el prompt ahora exige
      cuerpo no vacío y el update loguea el error. Commit `35370c9`, deploy
      `42c609ec`. +7 tests (81 en total).
- [x] 🟠 **S2 — la creación se atascaba cuando la IA estaba "con demanda".** Con un
      pico de tráfico (429/503/529), `analizarVacanteConJack` tiraba "Jack está con
      mucha demanda…" y dejaba `extraido=false`: el panel derecho nunca se mostraba
      y no se podía seguir. → **Fix 19/09**: (1) `fetchConReintentos` con backoff
      (3 intentos, 400ms/900ms) ante errores de red y 4xx/5xx transitorios en Gemini
      y Anthropic; (2) modo manual en "Cargar aviso" ("Prefiero cargar los datos yo" +
      recuperación tras el error): el flujo nunca queda bloqueado, incluso si el
      aviso vino como imagen/PDF y el proveedor no responde; (3) "Generar
      postulación" exige puesto+empresa. Commit `7dbd7e0`, deploy `2a372f66`.
      +6 tests (87 total).

--------------------------------------------------------------------------------
## S4 — Observabilidad (25/09/2026): instrumentación lista, faltan las claves
--------------------------------------------------------------------------------
> ### ▶ RETOMAR ACÁ (25/09, se deja la sesión abierta)
> **Todo el código está hecho, verificado y pusheado en `a356c52`.** No queda trabajo de
> código: lo pendiente necesita credenciales del usuario.
> 1. **Ver el deploy** (quedó sin confirmar): Cloudflare → Workers & Pages → `app` →
>    Deployments. Al dejar la sesión, prod seguía sirviendo la build del 19/09
>    (`/assets/index-vjYYtF5a.js`), o sea que el run de Actions del push `a356c52` no
>    había aterrizado (o falló). Chequeo HTTP para confirmarlo sin `gh` (no hay CLI
>    instalada en la máquina):
>    ```powershell
>    $idx = Invoke-WebRequest "https://app.postulaya-jack.workers.dev/?cb=$([guid]::NewGuid().ToString('N').Substring(0,8))" -UseBasicParsing -Headers @{ 'Cache-Control'='no-store' }
>    $src = ([regex]::Matches($idx.Content,'src="(/assets/[^"]+\.js)"')[0]).Groups[1].Value
>    (Invoke-WebRequest "https://app.postulaya-jack.workers.dev$src" -UseBasicParsing).Content -match 'funnel_login_falla'
>    ```
>    `True` = build nueva en pie. Ese string solo existe en el bundle de este commit.
> 2. **Crear las cuentas y cargar las claves** (guía completa en el README, sección
>    "Observabilidad"): proyecto en sentry.io → DSN; proyecto en app.posthog.com → key
>    `phc_`. Cargarlas como **repository variables** (Settings → Secrets and variables →
>    Actions → tab *Variables*): `VITE_SENTRY_DSN`, `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`.
>    Local: `.env.local`.
> 3. **Un push más** (cualquier cambio trivial sirve) → el job `deploy` rebuilda con las
>    claves inlineadas. Orden importa: las `VITE_*` se inlinean en el build, si el push va
>    antes que las variables sale una build inerte (no rompe nada).
> 4. **Verificar**: un error controlado (IA caída en "Cargar aviso") → issue en Sentry;
>    los `funnel_*` en PostHog → Activity. Después marcar S4 como cerrado acá.
>
> Pendientes del backlog que siguen abiertos, en orden: S3 (verificar `Application ↔
> Wages` en producción) y S5.

Estado: **código completo y en verde** (typecheck/lint/120 tests/build), commit `a356c52`
pusheado; **deploy sin confirmar**.
Lo que YA estaba (commit `7560448`): el módulo cliente y los 7 eventos del funnel, pero
inerte — sin `VITE_SENTRY_DSN`/`VITE_POSTHOG_KEY` no se inicializa ningún SDK, y
`reportTechnicalError` no tenía **ni un solo call site** (el README además afirmaba lo
contrario). Los eventos de Gmail/límite se emitían desde la UI, con un match frágil del
texto del error.

### Hecho en esta sesión
- **Server-side nuevo** (`src/lib/server/observability.ts`): `reportServerError()` +
  `trackServerEvent()`, con `sanitizeProps()` (solo primitivos; redacta email/token/cuerpo/
  CV/path; corta textos >200 chars) y `beforeSend` que trunca a 500 chars el mensaje de las
  excepciones (los proveedores de IA devuelven el body crudo). Sentry se inicializa con
  `Sentry.withSentry()` en `src/server.ts` (es la única vía pública del SDK de Cloudflare:
  `init` no se exporta). `posthog-node` con `flushAt: 1, flushInterval: 0` porque un isolate
  se congela ni bien responde.
- **Puntos server instrumentados:** error crudo de la IA en los 3 `traducirErrorIA` (el
  browser nunca veía el status real del proveedor), callback de OAuth de Gmail (con y sin
  código), envío por Gmail `rechazado` vs `ambiguo` + `cuota_revertida`, fallo del `UPDATE`
  que marca `sent`, error del entry del worker y SSR tragado por h3.
- **Un solo emisor por evento** (evita contar dos veces el funnel): el server emite
  `funnel_gmail_enviado` / `funnel_limite_diario` (ya no la UI, que además adivinaba por
  `msg.includes("Límite diario")`); la UI sigue con login/CV/extracción/generación/copiar.
  Eventos server extra: `gmail_conectado`, `gmail_desconectado`, `gmail_envio_duplicado`.
- **Gaps de cliente cerrados:** `reportTechnicalError()` en `RouteError` y en el error
  component raíz; `funnel_login_falla` (oauth_error / sin_code / exchange_fallido) + Sentry
  del fallo de intercambio; `funnel_cv_creado` con `origen` (manual/upload) y Sentry del
  fallo al procesar el archivo.
- **CI:** el job `deploy` pasa `VITE_SENTRY_DSN`/`VITE_POSTHOG_KEY`/`VITE_POSTHOG_HOST`
  desde *repository variables* (son claves públicas embebidas, no secrets). Build y e2e
  los dejan vacíos a propósito (así el CI nunca manda eventos a la telemetría real).
- **Tests:** +33 (87 → 120). Nuevos: `src/lib/observability.test.ts` (11),
  `tests/unit/observability-server.test.ts` (17, entorno node) y, en
  `tests/unit/enviar-email-gmail.test.ts`, los asserts de qué evento se emite y cuál no.
- Bundle verificado: `nodejs_compat` ya estaba en el `wrangler.json` generado (sin eso
  `withSentry` no puede usar `AsyncLocalStorage`); `@sentry/cloudflare` y `posthog-node`
  quedan como chunks separados del server.

### Lo que falta (depende del usuario)
- [ ] Crear las cuentas: proyecto en **sentry.io** (platform → Cloudflare) y proyecto en
      **app.posthog.com** (o el EU: `https://eu.i.posthog.com`).
- [ ] Cargar `VITE_SENTRY_DSN` y `VITE_POSTHOG_KEY` como repository variables de GitHub y
      pushear (el deploy las inlinea). Para local: `.env.local`.
- [ ] Deploy + verificación en producción: un error controlado a Sentry y los `funnel_*` en
      PostHog → Activity.

### Riesgo conocido
- Sin claves, `reportServerError` cae al `console.error` (visible en los logs del Worker):
  es el comportamiento de antes, no una regresión.
- `withSentry` re-lanza las excepciones del handler; nuestro `fetch` ya las captura todas y
  devuelve la página 500, así que no cambia la respuesta al usuario.

--------------------------------------------------------------------------------
## CERRADO 19/09: adjunto CV de Jack (pdf-lib) no viaja — crash de tslib en workerd
--------------------------------------------------------------------------------
Estado: feature commiteada y pusheada (89215dc) + CI auto-deploy (76cc0db, 21dd97f).
Cierre adicional 19/09: shim ampliado a **superset 1.x+2.x** (falta `__spreadArray` en un cierre de
`@radix-ui/react-alert-dialog` que el shim 1.14.1 original no exportaba). Suite entera verde
(typecheck/lint/test 74/build) e interop limpia (0 `__toESM(commonJS(tslib)).default` en todo el
bundle). **CERRADO 19/09**: deploy manual a Workers (Version `23b9ccd5-…`) y el usuario confirmó que
"Enviar desde Gmail" con el CV de Jack (sin archivo subido) llega con el PDF adjunto.

### Problema (producción)
"Enviar desde Gmail" con el CV **generado por pdf-lib** (modo "Usar mi CV de Jack" cuando NO hay
archivo subido / el CV se regenera) cae en el Worker: Cannot destructure property '__extends' of
'__toESM(...).default' as it is undefined. El adjunto no llega ni el mail se envía. En local
(Bun/Node) NO se reproduce: es específico de workerd.

### Causa raíz (diagnóstico completo 18/09)
- pdf-lib (dependencia de la app) importa tslib con **named imports** (import { __extends } from "tslib")
  y tslib 1.14.1 es **UMD/CJS**. Bun instala el UMD y pdfjs-dist también lo usa.
- rolldown (build Nitro/Workers) emite const { __extends } = __toESM(__commonJSMin(require_tslib())).default
  para ese named import de un CJS. En workerd __toESM(...).default evalúa undefined → crash.
- No es error de la app ni del query (eso ya estaba resuelto: el perfil se lee aparte, el PDF real
  se genera, 4595 bytes). Es 100% interop bundler CJS→ESM en el bundle server.

### Solución implementada (determinística, ya cableada)
1. deps/tslib-esm/index.mjs — copia local del tslib 1.14.1 **ESM puro** (tslib.es6.js: 23 helpers,
   named exports reales, sin UMD ni .default). Verificado: 23 exports, 0 markers UMD.
2. deps/tslib-esm/package.json — paquete local 	slib@1.14.1 (file:-able, exports → index.mjs).
3. package.json raíz — "tslib": "file:./deps/tslib-esm" en dependencies + "overrides": { "tslib": "" }
   que fuerza a **TODO** el árbol (incl. pdf-lib transitivo) a resolver tslib contra el shim ESM.
4. un install OK → 
ode_modules/tslib ahora es el shim (package name=tslib, main=./index.mjs).

### Verificación parcial (18/09)
- un run build ✅.
- En chunk .output/server/_libs/pdf-lib+tslib.mjs: **ya NO aparece** __toESM(__commonJSMin(require_tslib())).default.
  El tslib se enlaza como named export estático ahora (huella equire_pako() sigue; pako es otro helper,
  ver "queda pendiente").
- Sin otros __toESM(X).default en _libs de pdf-lib+tslib.

### Queda pendiente (para finalizar esta tarea)
- [ ] Verificar que la interop no rompió en otros chunks server que también usan tslib/docx/pdfjs-dist
      (docx, pdfjs-dist): grep __toESM(...).default / equire_tslib en .output/server/_libs/*.mjs
      → debe ser 0 en pdf-lib+tslib (mayor riesgo ya limpio). Revisar también chunk pako (pdf-lib usa
      pako → confirmar named export directo equire_pako().deflateSync y no .default).
- [ ] Correr la suite completa (regla AGENTS: no commitear sin verde): un run typecheck, un run lint,
      un test, un run build.
- [ ] Re-test real del flujo en **workerd** (el único que reprodujo): deploy a Cloudflare Workers
      (unx nitro deploy --prebuilt) + websearch/curl smoke del envío con CV pdf-lib.
- [ ] Commit + push cuando todo verde (mensaje sugerido: ix(gmail-send): shim ESM puro de tslib para
      pdf-lib — estructura UMD/CJS rompía interop en workerd (CV de Jack no viajaba en el mail)).
- [ ] Confirmación del usuario: "Enviar desde Gmail" con CV de Jack (sin archivo subido) llega con el
      PDF adjunto.

### Notas de contexto
- El fix de 18/09 del adjunto gmail (gmail-send.ts perfil aparte) **ya está en prod** y funcionó para
  el modo "Subir archivo"; esto ata el modo pdf-lib (sin subida) que quedaba roto por bundling.
- No borrar deps/tslib-esm/ ni el overrides hasta cerrar: es la pieza que hace el named-import
  estático. Alternativa a largo plazo (si Bun cambia interop): publicar 	slib ESM propio o migrar.
- GO check del usuario: probar el envío con el CV de Jack (sin subir archivo) contra producción.
