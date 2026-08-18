# Prompt para continuar el trabajo con otra IA

## Contexto del proyecto

Proyecto en TanStack Start + Vite + Supabase + Google OAuth, con rutas auth protegidas y lógica de perfil/CV. El repo ya fue corregido parcialmente y queda en un estado funcional para build/test, pero aún falta la conexión real a Supabase Cloud/Google OAuth para que el login funcione en browser real.

## Estado actual verificado

Se verificó que:
- `bun run test` pasa.
- `bun run typecheck` pasa.
- `bun run build` pasa.
- el servidor local responde con HTTP 200 en `http://127.0.0.1:4173/`.
- el problema que queda es el flujo real de autenticación con Supabase/Google: el proyecto estaba apuntando a un placeholder (`https://placeholder.supabase.co`) y no a un proyecto real, por lo que el login falla.

## Errores que ya fueron identificados y resueltos

### 1) Supabase client inconsistente

Problema:
- `src/lib/supabase/client.ts` no exportaba `supabase` ni `isSupabaseConfigured`, aunque varias partes del proyecto las importaban.
- Esto provocaba errores de TypeScript del tipo:
  - `Module "@/lib/supabase/client" has no exported member 'supabase'`
  - `Module "@/lib/supabase/client" has no exported member 'isSupabaseConfigured'`

Corrección:
- exportar la instancia real de `createBrowserClient`
- mantener `isSupabaseConfigured`
- volver consistente la API para todo el código cliente

### 2) Rutas duplicadas en TanStack Router

Problema:
- había múltiples rutas con el mismo `fullPath` como `/cv`, `/mis-cv`, `/perfil` y `/postulaciones` duplicadas a nivel raíz y dentro de `_authenticated`.
- generaba `Conflicting configuration paths were found...` al build.

Corrección:
- eliminar las rutas duplicadas de nivel raíz
- dejar una sola definición por ruta dentro del grupo autenticado

### 3) Import de server-only code en código cliente

Problema:
- `src/routes/auth.callback.tsx` importaba `@/lib/server/auth` y eso quedaba bloqueado por la protección de import del framework.
- provocaba `Import denied in client environment`.

Corrección:
- mover la lógica a `createServerFn` compatible con TanStack Start
- mantener el callback en `beforeLoad` del route, pero con lógica real en el servidor

### 4) Fallback placeholder en Supabase

Problema actual pendiente:
- el código no estaba apuntando a un proyecto real de Supabase y se caía en placeholder.
- la app era capaz de levantar, pero el login con Google no funcionaba porque la URL de autorización era `https://placeholder.supabase.co/auth/v1/authorize?...`

Esto es el único bloqueador funcional real que queda.

## Qué falta hacer para terminar Hito 1

1. Crear o conectar un proyecto real de Supabase Cloud.
2. Crear `/.env.local` con variables reales.
3. Configurar OAuth de Google con redirect URI real:
   - `http://127.0.0.1:4173/auth/callback`
   - `http://localhost:4173/auth/callback`
   - o la URL pública del deploy
4. Configurar en Supabase Auth → Providers → Google: Client ID + Client Secret.
5. Verificar que `/login` dispara Supabase Auth correctamente.
6. Confirmar que `/auth/callback` intercambia el `code` y salva la sesión con cookies.
7. Verificar que la sesión persiste al recargar la página.
8. Validar rutas privadas para usuarios no logueados.

## Variables de entorno que deben existir en .env.local

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key-real>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key-real>
SUPABASE_DB_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
GOOGLE_OAUTH_CLIENT_ID=<google-client-id>
GOOGLE_OAUTH_CLIENT_SECRET=<google-client-secret>
AI_PROVIDER=gemini
ANTHROPIC_API_KEY=ficticio
GEMINI_API_KEY=ficticio
```

## Archivos clave que revisar

- `src/lib/supabase/client.ts`
- `src/lib/supabase/server.ts`
- `src/routes/login.tsx`
- `src/routes/auth.callback.tsx`
- `src/lib/server/auth.ts`
- `src/routes/_authenticated/route.tsx`
- `src/lib/server/profile.ts`
- `src/routes/_authenticated/perfil.tsx`

## Validaciones que ya se corrieron

```bash
bun run lint
bun run typecheck
bun run test
bun run build
```

Se verificó que pasan. El problema actual es funcional y no de compilación.

## Objetivo de la siguiente IA

Continuar desde este punto sin perder el estado actual: dejar funcionando el login real con Supabase Cloud + Google OAuth, probar en browser, y verificar la sesión real del usuario.

## Instrucciones finales para la siguiente IA

- no volver a usar placeholders de Supabase
- no suponer que `supabase start` funciona sin Docker
- priorizar configuración real de Supabase Cloud
- no tocar rutas duplicadas que ya quedaron corregidas
- mantener compatibilidad con el stack actual TanStack Start
- verificar que el callback de OAuth real devuelve al usuario a `/perfil` y no a un error
- dejar todas las validaciones en verde antes de cerrar

---

## Resumen ejecutivo

El repo quedó estable a nivel build, tests y configuración de runtime, pero la autenticación real de Google sigue bloqueada por falta de un proyecto Supabase real y variables de entorno válidas. La app ya no tiene los bugs de TypeScript y de rutas que estaban rompiendo el build; el único problema activo es la conexión real a Supabase Cloud/Google OAuth.
