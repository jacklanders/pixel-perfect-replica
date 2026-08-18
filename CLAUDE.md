# CLAUDE.md — Jack

Memoria operativa para Claude Code en este repo. Ver `Prompt_Jack_revisado_agosto_2026` (doc del proyecto)
para el prompt completo de producto/alcance. Este archivo es solo el resumen accionable.

## Stack real (no el genérico de un Vite+React cualquiera)

- **Frontend/SSR:** TanStack Start (`@tanstack/react-start` + `@tanstack/react-router`) sobre Vite,
  scaffolded y gestionado por Lovable (`@lovable.dev/vite-tanstack-config`). **No tocar `vite.config.ts`
  a mano** — ese paquete ya inyecta TanStack devtools, tanstackStart, React, Tailwind, tsConfigPaths,
  Nitro (target Cloudflare por default) y detección de sandbox. Config adicional va vía
  `defineConfig({ vite: {...} })`, no agregando plugins sueltos.
- **Package manager real: `bun`** (`bun.lock`, `bunfig.toml` presentes). El `README.md` generado por
  Lovable dice `npm i` — no seguirlo; usar `bun install`, `bun run dev`, etc.
  - `bunfig.toml` tiene un guard de 24h para paquetes recién publicados (`minimumReleaseAge`). Si hace
    falta instalar algo publicado hace <24h, pedir confirmación explícita antes de agregarlo al
    `minimumReleaseAgeExcludes`.
- **Build target: Cloudflare Workers vía Nitro.** Decisión ya tomada (no Netlify, que asumía el prompt
  de producto original antes de ver el scaffold real). Es lo que el preset de Lovable ya trae
  configurado; no hay razón para pelear contra eso.
- **Backend objetivo:** Supabase (Postgres + Auth + Storage) para datos/auth/archivos. **La lógica de
  servidor (llamadas a IA, callback OAuth de Gmail, envío de mail) va en `createServerFn` de TanStack
  Start y rutas `src/routes/api/`, no en Supabase Edge Functions.** Ya estamos corriendo un servidor
  (Nitro/Cloudflare Workers) para el SSR; sumar Edge Functions (Deno, runtime aparte) sería un segundo
  backend sin necesidad, contra la idea del prompt de minimizar piezas de infraestructura.
- **Origen del código de UI:** Lovable sincroniza commits directo a `main` (ver `AGENTS.md`). Ese flujo
  sigue activo. Este repo puede recibir cambios desde dos fuentes (Lovable y trabajo de backend) — ver
  "Cómo coordinar con Lovable" abajo.

## Comandos

```bash
bun install          # instalar dependencias
bun run dev           # servidor de desarrollo
bun run lint           # eslint
bun run typecheck      # tsc --noEmit (agregado en Hito 0)
bun run test            # vitest (unit/integration, agregado en Hito 0)
bun run test:e2e         # playwright (agregado en Hito 0)
bun run build             # build de producción (nitro)
```

Todo hito no trivial corre como mínimo `lint`, `typecheck`, `test` y `build` antes de darse por
terminado. Los flujos críticos (login, generar CV, generar postulación, enviar mail) llevan cobertura
Playwright con mocks de IA/Gmail — sin depender de servicios externos reales en CI.

## Convenciones de carpetas

- `src/routes/` — rutas TanStack Router (file-based). No renombrar sin actualizar `routeTree.gen.ts`
  (se regenera solo, no editar a mano).
- `src/lib/` — utilidades, clientes (Supabase, AI provider, observabilidad), tipos compartidos.
- `src/lib/mock-*` — datos simulados de la maqueta Lovable. Se van reemplazando módulo por módulo por
  llamadas reales a Supabase/Edge Functions; no borrar de golpe, migrar ruta por ruta (vertical slice).
- `supabase/migrations/` — SQL versionado. Nunca editar una migración ya aplicada; crear una nueva.
- `src/lib/server/` — lógica server-only: capa `AIProvider`, cliente Supabase con `service_role`,
  envío de Gmail. Expuesta a las rutas vía `createServerFn` de TanStack Start; nunca importada desde
  código que corre en el browser.
- `src/routes/api/` — endpoints HTTP explícitos cuando hace falta una URL propia (ej. callback de OAuth
  de Google, que Google llama directo, no vía `createServerFn`).

## Política de migraciones

- Toda migración nueva es un archivo `NNNN_descripcion.sql` en `supabase/migrations/`, nunca se edita
  una ya mergeada a `main`.
- Toda tabla con datos de usuario lleva RLS habilitado desde la misma migración que la crea, con
  policies que atan `auth.uid()` a `user_id`, más `GRANT` explícito por tabla (no confiar solo en los
  privilegios por defecto de Supabase, aunque probablemente ya cubran el acceso — dejarlo explícito).
- Rol de admin: tabla `user_roles` separada + función `has_role(user_id, role)` (`security definer`,
  `search_path` fijo). Nunca una columna `role` en `profiles` — evita que un usuario se autoescale de
  rol si algún día se expone un update genérico de perfil, y evita recursión de RLS.
- Ninguna verificación de rol admin vive solo en frontend — siempre repetida server-side (RLS y/o
  `createServerFn` que llama `has_role()` antes de escribir).
- Toda función `security definer` lleva `set search_path = public` y un `REVOKE EXECUTE ... FROM
  PUBLIC` explícito antes de otorgar `EXECUTE` solo a los roles que la necesitan — Postgres deja
  `EXECUTE` abierto a `PUBLIC` (incluido `anon`) por default si no se revoca.
- Datos sensibles que nunca deben ser legibles por el cliente (ej. `oauth_connections.encrypted_refresh_token`)
  van en una tabla con RLS habilitado y **sin ninguna policy ni GRANT** para `anon`/`authenticated` — solo
  `service_role` (que bypassea RLS) la toca, siempre desde `src/lib/server/`. Si hace falta exponer un
  estado derivado no sensible (ej. "¿tengo Gmail conectado?"), se hace con una tabla/columna aparte que
  sí tenga policy de solo-lectura, nunca reutilizando la tabla que guarda el secreto.

## Manejo de secretos

- `.env.example` — solo nombres de variables, valores ficticios. Nunca credenciales reales.
- Claves reales: variables de entorno del proveedor de hosting elegido + Supabase + GitHub Secrets (CI).
- El frontend nunca llama directo a Anthropic/Gemini/Gmail — todo pasa por Edge Functions.

## Cómo coordinar con Lovable (importante, específico de este proyecto)

Lovable sigue sincronizando a `main`. Mientras se construye el backend real (Supabase, RLS, Edge
Functions, OAuth):

1. Antes de tocar un archivo compartido (rutas, `AppShell.tsx`, `mock-postulaciones.ts`), correr
   `git pull` para traer lo último de Lovable y evitar pisar cambios.
2. Evitar pedirle a Lovable, en simultáneo, que "conecte Supabase" o "agregue login real" — Lovable
   tiene integración nativa con Supabase, pero no necesariamente aplica RLS explícito con
   `auth.uid() = user_id` en cada policy ni cumple los criterios de seguridad de este prompt sin
   revisión. La conexión de Supabase y las policies las define este flujo (Claude/Claude Code), no el
   autogenerado de Lovable.
3. Lovable puede seguir usándose libremente para iterar UI/estilos que no toquen lógica de datos.
4. Cada hito de backend se entrega como rama + diff/patch para mergear a `main` manualmente (o vía PR)
   y así Lovable lo levanta en su próxima sincronización.

## Autenticación (Hito 1, consolidado tras el incidente del 18/08)

**Un solo mecanismo de sesión: cookies, vía `@supabase/ssr`.** No volver a introducir un segundo
sistema (bearer token, chequeo solo-cliente, etc.) sin borrar el anterior en el mismo cambio — el
18/08 convivieron 3 sistemas de auth distintos a la vez (cookies, bearer token, y un guard solo-cliente
con `ssr: false`) porque tres herramientas distintas tocaron auth sin coordinarse, y eso rompió el login
de formas que dependían de qué ruta/función se ejecutara. Ver commit "fix auth: unificar a cookies".

- Google login: `supabase.auth.signInWithOAuth({ provider: "google" })` desde el browser client
  (`src/routes/login.tsx`), callback en `src/routes/auth.callback.tsx` que intercambia el `code`
  server-side (`src/routes/auth.callback.tsx` → `exchangeCodeForSession`).
- Server client con cookies: `src/lib/supabase/server.ts` (`getSupabaseServerClient`). Todo lo que
  necesita saber quién es el usuario en el servidor pasa por acá — nunca por un header Authorization.
- Middleware compartido para server functions: `src/lib/supabase/auth-middleware.ts`
  (`requireSupabaseAuth`), usado por `perfil.functions.ts` y `cv.functions.ts`. Deja en `context`:
  `supabase` (cliente ya autenticado como el usuario, RLS aplicada), `userId`, `email`, `userMetadata`.
- Guard de rutas privadas: `src/routes/_authenticated/route.tsx`, `beforeLoad` server-side vía
  `getCurrentUser()` en `src/lib/auth.functions.ts`. **No usar `ssr: false` en esta ruta** — eso vuelve el guard puramente
  client-side, o sea sin protección real en el primer render.
- Modelo de datos de perfil: `src/lib/perfil.model.ts` — `skills` y `resumen` viven dentro de
  `profiles.preferencias` (jsonb), no en columnas dedicadas. Las columnas `avatar_url`/`skills` que
  agregó la migración `0002` quedaron sin usar; no borrarlas todavía (evitar otra migración
  apresurada), pero no asumir que tienen datos.
- Alta de perfil: hay DOS mecanismos redundantes ahora mismo — el trigger `handle_new_user` en
  Postgres (migración `0002`) Y un insert manual de fallback dentro de `getMiPerfil`
  (`perfil.functions.ts`) si no encuentra fila. No es peligroso (ambos son idempotentes), pero es
  redundante; limpiar cuando se toque perfil de nuevo.

## Coordinación entre herramientas (importante, después del incidente del 18/08)

Este proyecto se edita desde Lovable, Claude, GitHub Copilot y Gemini a la vez, manualmente vía VS Code.
Eso ya causó una regresión real (tres sistemas de auth simultáneos, un `.env.example` borrado por
accidente en un commit con mensaje que no describía el cambio). Regla mínima para que no se repita:

- Antes de pedirle un cambio de auth/perfil/CV a una herramienta, decirle explícitamente qué archivos
  NO tocar si otra herramienta ya está trabajando ahí.
- Revisar el diff (`git diff` o el patch) antes de commitear, no solo confiar en "tests pasaron".
- Un commit = un cambio identificable. Si el mensaje dice "RLS", el diff tiene que ser RLS.
- Si dos herramientas proponen arreglar lo mismo, aplicar una sola propuesta completa, no mezclar
  fragmentos de ambas.

## Definition of Done (por hito)

Ver criterios completos en el prompt de producto. Resumen operativo: el hito no está terminado si falta
alguno de estos puntos:
- Ruta usable de punta a punta (no capas sueltas de frontend/backend).
- Lint + typecheck + tests afectados + build en verde.
- RLS verificado para toda tabla nueva.
- Resumen de qué cambió, cómo probarlo manualmente, qué se corrió y qué falta probar.

## Decisiones ya tomadas (no reabrir sin motivo nuevo)

- **Hosting de producción:** Cloudflare Workers vía Nitro (preset que ya trae el scaffold de Lovable).
  El prompt original asumía Netlify + build estático; no aplica a este stack real.
- **Servidor de la app:** `createServerFn`/rutas API de TanStack Start, no Supabase Edge Functions.
- **Proveedor de IA runtime:** `AI_PROVIDER=anthropic|gemini`, llamado únicamente desde
  `src/lib/server/`, nunca desde el navegador.
- **Rol admin:** tabla `user_roles` + `has_role()`, no columna en `profiles`.
- **Auth:** cookies vía `@supabase/ssr` (no localStorage), `beforeLoad` por ruta como guard real.
