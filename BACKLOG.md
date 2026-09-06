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
- [ ] **Cuota reembolsada por error de la 2ª operación** — `src/lib/server/enviar-postulacion-email.ts:124-133`.
      Si el mail YA salió por Gmail pero el `UPDATE` que marca `status=sent` falla, el `catch` llama
      `decrement_daily_usage` → se devuelve la cuota por un envío que sí consumió. Resultado: usuario
      reenvía → mail duplicado + doble cuota. Fix: revertir la reserva solo si FALLÓ el envío Gmail
      (`enviarPostulacionGmail`), no si falla la persistencia posterior.
- [ ] **Sin guarda de idempotencia en el server** — `src/lib/server/enviar-postulacion-email.ts:38-46`.
      El botón se deshabilita en UI cuando `status === "sent"`, pero un cliente puede llamar
      `enviarEmailGmail` directo sobre una postulación ya enviada → mail duplicado + cuota extra.
      Fix: al leer la `application`, si `status === "sent"` → throw ("Esa postulación ya fue enviada").

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
- [ ] `redirect` de `/login` ignorado — `src/routes/login.tsx` y `src/routes/auth.callback.tsx` siempre
      mandan a `/perfil`; el usuario deep-linkeado pierde su ruta tras autenticarse.
- [ ] Archivos temporales de adjunto (`resumes/{user}/tmp/`) no se limpian si el envío falla en storage —
      `src/lib/server/gmail-send.ts:321-327`. Falta limpieza por TTL.
- [ ] Stale cache del CV "primario" al guardar — `src/routes/_authenticated/cv.tsx:156-165`; no invalida la
      query key `["cv","primario"]`.
- [ ] Dead code: `enviarPostulacion` legacy exportado — `src/lib/application.functions.ts:124-167`; doble
      camino de envío (reserva cuota sin mandar mail). Cubrir el área antes de borrar.
- [ ] Foto en base64 guardada íntegra en `structured_json` — `src/lib/cv.model.ts:48`, `cv.tsx:458-469`;
      infla cada listado/save de CVs.
- [ ] Rate-limit en memoria por worker con IP derivada de `x-forwarded-for` spooleable —
      `src/lib/server/rate-limit.ts:57-63`.
- [ ] Sesión expirada con mensaje genérico "Unauthorized" — `src/lib/supabase/auth-middleware.ts:37`; no
      distingue refresh fallido de no-autenticado.
- [ ] Error boundary solo en la raíz — una excepción en rutas `_authenticated` cae al fallback global
      genérico (inglés). `src/routes/__root.tsx`.

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
