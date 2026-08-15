# Hito 1 — Login con Google, perfil y CVs reales (Supabase externo)

Conectar la maqueta al proyecto Supabase Cloud propio: autenticación con Google, rutas
protegidas, y `/perfil`, `/cv` y `/mis-cv` leyendo y escribiendo datos reales.
`/postulaciones/*` sigue con datos simulados hasta el Hito 2.

## Estado verificado del repo

- Maqueta v1/v2 completa; el estado vive en `src/lib/mock-postulaciones.ts`.
- Hito 0 cerrado: `CLAUDE.md`, `BACKLOG.md`, `CHANGELOG.txt`, CI, vitest + Playwright, `.env.example`.
- `supabase/migrations/0001_init.sql` existe (377 líneas, con `user_roles`, `has_role()`,
  `profiles`, `resumes`, `job_posts`, `applications`, `daily_usage`, `app_settings`, RLS y GRANTs).
- No hay ningún cliente Supabase en el código todavía: no existen `src/integrations/`,
  `src/lib/server/`, ni rutas protegidas. El login actual es puramente visual.

## Lo que hacés vos (fuera de Lovable)

1. En Supabase Cloud: pegar `supabase/migrations/0001_init.sql` tal cual en el SQL Editor y ejecutarlo.
2. En Google Cloud Console: crear las credenciales OAuth y habilitar el proveedor Google en
   Supabase → Authentication → Providers, con la Redirect URL que da Supabase.
3. En Supabase → Authentication → URL Configuration: agregar la URL de preview de Lovable y
   la de producción como Redirect URLs permitidas.
4. Pasarme `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` para cargarlas como variables del
   proyecto (son claves públicas, ancladas por RLS). El `service_role` no entra en este hito.

## Lo que hago yo

### 1. Cliente y sesión
- `src/lib/supabase/client.ts`: cliente de navegador tipado, con sesión persistida.
- `src/lib/supabase/types.ts`: tipos de la base escritos a mano a partir de `0001_init.sql`
  (con Supabase externo no hay generación automática de tipos desde Lovable).
- `src/lib/supabase/auth-middleware.ts` + `src/lib/auth.server.ts`: validación del bearer token
  en servidor, para que las `createServerFn` de este hito y los siguientes corran con RLS
  como el usuario. Bearer adjuntado automáticamente vía `functionMiddleware` en `src/start.ts`.
- `src/hooks/useAuth.ts`: sesión, usuario y `signOut` para la UI.

### 2. Rutas protegidas
- Nuevo layout `src/routes/_authenticated/route.tsx` (`ssr: false`) que redirige a `/login`
  sin sesión.
- Mover bajo ese layout: `perfil`, `cv`, `mis-cv` y `postulaciones*`.
  `/` y `/login` quedan públicas.
- `/login`: botón de Google real (`signInWithOAuth`) + redirect de vuelta a la ruta pedida.
  Si ya hay sesión, redirige a `/perfil`.
- `AppShell`: menú de usuario con nombre/avatar y cierre de sesión (hoy es estático).

### 3. Perfil real
- Server fns en `src/lib/perfil.functions.ts`: `getMiPerfil` y `guardarPerfil` contra `profiles`
  (nombre, email, teléfono, ubicación, rubro objetivo, firma de mail, preferencias).
- Alta automática de la fila de `profiles` en el primer login, tomando nombre y mail de Google.
- `/perfil` deja de usar estado local: carga con TanStack Query, guarda con mutación,
  barra de completitud calculada sobre los datos reales.

### 4. CVs reales
- Server fns en `src/lib/cv.functions.ts`: listar, obtener, crear, actualizar, duplicar y borrar
  sobre `resumes` (contenido en `jsonb`, igual que la estructura que ya usa el editor).
- `/mis-cv`: lista real, duplicar y borrar persistidos; el modal de exportar sigue como está.
- `/cv`: carga y guarda la versión seleccionada; el chat con Jack sigue simulado (la IA es Hito 3).

### 5. Cierre del hito
- Tests: unit de los helpers de perfil/CV, y e2e de login (con sesión mockeada) y de guardar perfil.
- Correr `lint`, `typecheck`, `test` y `build`.
- Actualizar `CHANGELOG.txt` (v3.0) y tildar en `BACKLOG.md` lo que corresponda.

## Notas técnicas

- Al ser Supabase externo y no Lovable Cloud, no hay `src/integrations/supabase/*` autogenerado
  ni broker de OAuth de Lovable: el login usa `supabase.auth.signInWithOAuth('google')` directo
  contra tu proyecto, y los tipos de la base se mantienen a mano en el repo.
- No se toca `supabase/migrations/0001_init.sql`. Si al conectar aparece una diferencia entre el
  esquema y lo que espera la maqueta, la resuelvo con una migración nueva `0002_*.sql`, nunca
  editando la primera.
- Nada de `service_role` ni claves de IA en este hito; el código server-only queda preparado
  en `src/lib/*.server.ts` para los Hitos 3 y 4.
- El acceso a datos siempre pasa por `createServerFn` con el middleware de auth, así RLS
  (`auth.uid() = user_id`) es el límite real, no el guard de ruta.
