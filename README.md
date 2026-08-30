# Jack — CV y postulaciones con asistente IA

Prototipo estable: creación de CV desde cero, carga de avisos con extracción por IA,
generación de postulaciones personalizadas y envío por Gmail (con límite diario y
adjuntos). Corre como **TanStack Start** (SSR + server functions) sobre **Nitro / Cloudflare
Workers**, con **Supabase** (Auth + Postgres + Storage) como backend.

Este proyecto se construyó con [Lovable](https://lovable.dev). Editalo en el
[editor de Lovable](https://lovable.dev/projects/b4c16aa8-651d-4965-9d9a-4cf4ca72ae5d).

---

## Stack

| Capa | Tecnología | Notas |
| --- | --- | --- |
| Frontend / SSR | React 19 + TanStack Start + TanStack Router | file-based routes, `createServerFn` |
| Build | Vite (+ `@lovable.dev/vite-tanstack-config`) | **no editar `vite.config.ts` a mano** |
| Hosting | Cloudflare Workers vía Nitro | preset que ya trae el scaffold |
| Backend | Supabase (Auth, Postgres, Storage) | migraciones versionadas + RLS |
| IA | Gemini o Anthropic, **server-side** | `AI_PROVIDER=gemini\|anthropic` |
| Gmail | OAuth 2.0 Web app + Gmail API (`Gmail.send`) | tokens server-side, nunca al browser |
| Tests | Vitest (unit) + Playwright (E2E con mocks) | `MOCK_AI` / `MOCK_GMAIL` |
| Observabilidad | Sentry + PostHog (opcionales, tras env vars) | ver sección Observabilidad |

## Prerequisitos

- [bun](https://bun.sh) ≥ 1.x (package manager real del repo — **no usar npm**)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (para el entorno local de
  una línea con Auth/Storage) — opcional si ya tenés un proyecto remoto
- Cuenta en [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
- (Opcional) [Cloudflare](https://dash.cloudflare.com) account para deploy

## Setup local (exacto)

```sh
git clone <este-repositorio>
cd pixel-perfect-replica
bun install
cp .env.example .env.local      # completar los valores reales (ver .env.example)
bun run dev                     # servidor de dev en http://localhost:8080
```

### Base de datos (Supabase)

Con **Supabase CLI** (levantar todo local, incluido Auth de Google):

```sh
supabase start                  # usa supabase/config.toml (puerto 54321 por defecto)
supabase db reset               # aplica supabase/migrations/ desde cero
```

> Para usar un **proyecto remoto** en su lugar: `supabase link --project-ref <ref>` y
> `supabase db push` (aplica las migraciones pendientes).

Al terminar, verificar en Supabase Studio que las tablas con datos de usuario tienen
RLS habilitado (columna *RLS* en verde): `profiles`, `resumes`, `job_posts`,
`applications`, `daily_usage`, `app_settings`, `oauth_connections`,
`oauth_connection_status`, `user_roles`.

## Variables de entorno

Todos los nombres y comentarios están en **`.env.example`** completo. Resumen de bloques:

- **Supabase:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (cliente),
  `SUPABASE_SERVICE_ROLE_KEY` (server), `SUPABASE_DB_URL` (tooling, opcional).
- **Login Google (Supabase):** `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`
  — solo las usa la CLI de Supabase para levantar Auth local (`env(...)` en
  `supabase/config.toml`).
- **Gmail (app propia):** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `GOOGLE_REDIRECT_URI`, `OAUTH_ENCRYPTION_KEY`. Solo el server los toca.
- **IA:** `AI_PROVIDER`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY` (server).
- **Mocks E2E:** `MOCK_AI=true`, `MOCK_GMAIL=true` (server; simula IA y envío de
  Gmail, DB/Storage/RPC reales).
- **Observabilidad:** `VITE_SENTRY_DSN`, `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`.

Prefijos: `VITE_*` quedan embebidos en el bundle del cliente en cada **build**;
el resto son secretos del entorno de ejecución (`.env.local` en dev, secrets del
worker en Cloudflare).

## Migraciones SQL

`supabase/migrations/` — versionadas, **nunca editar una ya aplicada** (crear `NNNN_*.sql`).

| Migración | Contenido |
| --- | --- |
| `0001_init.sql` | Schema base: `profiles`, `resumes`, `job_posts`, `applications`, `daily_usage`, `app_settings`, `oauth_connections`, RPC `increment_daily_usage` (límite diario) |
| `0002_hito1_profile_signup.sql` | Trigger `handle_new_user`, columnas de perfil |
| `0003_fix_profiles_rls.sql` | Policies RLS de `profiles` |
| `0004_reconcile_live_schema.sql` | Ajustes de RLS y grants alineados al schema real |
| `0005_drop_orphan_columns.sql` | Columnas huérfanas sin uso |
| `0006_add_updated_at_to_applications.sql` | `updated_at` en `applications` |
| `0007_add_oauth_expires_at.sql` | `expires_at` para OAuth tokens de Gmail |

## Configuración OAuth de Google

Hay **dos credenciales OAuth distintas** (no confundirlas):

### 1) Login con Google (Supabase Auth Provider)

1. En Google Cloud Console crear un OAuth 2.0 Client ID tipo *Web application*.
2. Authorized redirect URI → la de **Supabase** (no la de la app):
   - Local (CLI): `http://127.0.0.1:54321/auth/v1/callback`
   - Remoto: `https://<tu-proyecto>.supabase.co/auth/v1/callback`
3. Copiar ID/secret a `.env.local` (`GOOGLE_OAUTH_CLIENT_ID`/`_SECRET`).
4. En `supabase/config.toml` → `[auth.external.google]` usa `env(...)`; exportar las
   variables antes de `supabase start`.

### 2) Enviar mails por Gmail (app propia, token del usuario)

1. Crear un **segundo** OAuth 2.0 Client ID *Web application* en Google Cloud Console.
2. Habilitar la **Gmail API** (`https://www.googleapis.com/auth/gmail.send` scope).
3. Authorized redirect URIs:
   - Local: `http://localhost:8080/auth/gmail-callback`
   - Producción: `https://<tu-worker>.workers.dev/auth/gmail-callback`
4. En `.env.local`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.
5. Probar en una postulación → botón **Conectar Gmail** → autorizar → **Enviar desde Gmail**.

Los refresh tokens se guardan cifrados en `oauth_connections` (RLS sin policies para
`anon`/`authenticated`, solo `service_role` server). El frontend nunca ve tokens.

## Comandos

```sh
bun run dev          # dev server (http://localhost:8080)
bun run lint         # eslint (el hook pre-commit corre eslint --fix + tsc)
bun run typecheck    # tsc --noEmit
bun run test         # vitest (unit + integración)
bun run test:e2e     # playwright (requiere e2e/.auth/user.json; MOCK_AI/MOCK_GMAIL)
bun run build        # build de producción (client + SSR + worker Nitro)
bun run preview      # preview del build
```

Los E2E autenticados usan `e2e/.auth/user.json` (cookies de sesión ya capturadas).
Sin ese archivo se **saltan**. Para generarlo: correr la suite con
`bunx playwright codegen`-guarded login, o capturar el storageState de una sesión real.

E2E con mocks: el `webServer` de `playwright.config.ts` levanta vite con
`MOCK_AI=true` y `MOCK_GMAIL=true`, así la extracción de avisos y el envío de Gmail se
simulan server-side sin servicios externos.

## Deploy en Cloudflare Workers

Los secrets del entorno NO van al bundle: mientras que `VITE_*` se embeben en build,
los secretos de server (`SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_SECRET`,
`OAUTH_ENCRYPTION_KEY`, `GEMINI_API_KEY`, etc.) se setean como secrets del worker.

```sh
bun install
bun run build                                   # genera .output/ (wrangler.json incluido)
npx wrangler login                              # autorización única en el browser
npx nitro deploy --prebuilt                     # deploy a https://<nombre>.workers.dev
```

> El nombre del worker se define en `wrangler.json` (raíz); el subdominio de la cuenta se
> registra una vez en el dashboard (Workers & Pages → "Your subdomain"). Deployment actual:
> **https://app.postulaya-jack.workers.dev**

Luego, en Cloudflare Dashboard → tu worker → **Settings → Variables and Secrets**, o vía CLI:

```sh
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put OAUTH_ENCRYPTION_KEY
npx wrangler secret put GEMINI_API_KEY          # si AI_PROVIDER=gemini
npx wrangler secret put ANTHROPIC_API_KEY       # si AI_PROVIDER=anthropic
# y como variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, AI_PROVIDER,
# GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI (apuntando al dominio de producción),
# VITE_SENTRY_DSN, VITE_POSTHOG_KEY, VITE_POSTHOG_HOST (si aplican)
```

Pasos de post-deploy (una vez por dominio):

1. Agregar `https://<tu-worker>.workers.dev/auth/gmail-callback` como redirect URI
   autorizado del **client de Gmail** en Google Cloud Console.
2. En Supabase Auth → URL Configuration, sumar `https://<tu-worker>.workers.dev` a
   Site URL y redirect URLs.

## Arquitectura y decisiones de diseño

- **Todo lo sensible vive server-side.** IA (`src/lib/server/ai-provider.ts`), OAuth
  de Gmail (`src/lib/server/gmail-oauth.ts`), envío de mail (`src/lib/server/gmail-send.ts`)
  y clientes con `service_role` no se importan desde código de browser. El import-protection
  de TanStack lo enforce en build (`src/lib/server/**`).
- **Un solo mecanismo de sesión: cookies** vía `@supabase/ssr`. Guard real en `_authenticated/route.tsx`
  con `beforeLoad` server-side; nunca confiar solo en checks client-side.
- **RLS desde la migración.** Toda tabla con datos de usuario lleva policies atando
  `auth.uid()` a `user_id` + `GRANT` explícito. Rol admin: `user_roles` + función
  `has_role()` (`security definer`, `search_path` fijo), nunca una columna `role` en `profiles`.
- **Límite diario server-side mutex-free:** RPC `increment_daily_usage` por
  `(user_id, usage_date)` con `p_limit=2`; el server (o la UI, proactivamente) rechaza
  el tercer envío con mensaje claro.
- **Tokens OAuth cifrados con `OAUTH_ENCRYPTION_KEY`** (fallback service_role key en dev);
  refresh automático 1 min antes de expirar y retry tras 401; token revocado ⇒ se marca
  desconectado y la UI pide reconexión.
- **Adjuntos:** CV de Jack (PDF on-the-fly) o archivo temporal (PDF/DOCX subido a
  Storage `resumes/{user}/tmp/`) validado por MIME + tamaño configurable en
  `app_settings.max_upload_size_mb` (default 10MB); se borra del Storage tras envío.
- **E2E sin servicios externos** (`MOCK_AI`/`MOCK_GMAIL`) para no depender de Google en CI,
  manteniendo DB/Storage/RPC reales.
- **Observabilidad opcional y privacy-first:** Sentry/PostHog solo se inicializan si sus
  env vars existen; Sentry nunca recibe CVs/mails/tokens; PostHog enmascara inputs y emails.

## Smoke test en producción (checklist)

1. **Login con Google** funciona → redirige a `/perfil` y persiste al recargar.
2. **Crear CV desde cero** → /cv crea un CV vacío, editable, que aparece en /mis-cv.
3. **Cargar aviso + extraer con IA** → pegar aviso en /postulaciones/nueva y Jack
   completa la ficha (role/empresa/mail).
4. **Generar postulación** → "Generar postulación" redirige al detalle.
5. **Copiar/pegar** → botones "Copiar" y "Copiar todo" ponen el contenido en el clipboard.
6. **Enviar por Gmail** → si Gmail está conectado, envía y marca `Enviada`.
7. **Límite diario** → el tercer envío del día se bloquea con "Llegaste al límite
   gratuito de hoy".

## Observabilidad (Sentry / PostHog)

Integrados tras env vars (`VITE_SENTRY_DSN`, `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`).
Sin ellas la app anda igual y los SDKs ni se descargan. Con ellas:

- **Sentry:** errores de runtime vía `reportTechnicalError()` (ya usado por
  `lovable-error-reporting` y el error component de la raíz).
- **PostHog:** eventos de funnel `funnel_*` en login, crear CV, extraer datos,
  generar postulación, copiar, enviar por Gmail y bloqueo de límite diario.

**Verificación en producción pendiente de claves** (no se configuraron DSN/key aún):
probar que al lanzar un error controlado llega `captureException` a Sentry y que los
`funnel_*` aparecen en PostHog (Person/events).

## Calidad

`lint`, `typecheck`, `test` y `build` corren también en CI (`.github/workflows/ci.yml`)
con env de placeholder. Los hooks pre-commit corren `eslint --fix` y `tsc --noEmit`.