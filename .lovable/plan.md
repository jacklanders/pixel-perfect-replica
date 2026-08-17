# Hito 1 — Trabajo de UI compatible con el enfoque de sesión de Claude

La arquitectura de autenticación la define el patch de Claude (`@supabase/ssr` + cookies,
callback OAuth server-side, `getCurrentUser` / `exchangeCodeForSession`, guards con
`beforeLoad`). Este plan **no la toca ni la reescribe**: solo avanza con lo que falta de UI,
datos y documentación, dejando puntos de conexión explícitos para cuando el patch se aplique.

## Estado verificado del repo (hoy)

- No existe nada del patch de Claude todavía: no hay `src/lib/server/`,
  ni `src/lib/supabase/server.ts`, ni `src/routes/auth.callback.tsx`,
  ni `0002_hito1_profile_signup.sql`, y `@supabase/ssr` no está en `package.json`.
- Lo que sí está: `src/lib/supabase/client.ts`, `auth-middleware.ts`, `auth-attacher.ts`,
  `src/hooks/useAuth.ts`, `perfil.model.ts` + `perfil.functions.ts`,
  `cv.model.ts` + `cv.functions.ts`, y las rutas bajo `src/routes/_authenticated/`.
- `src/start.ts` no registra `attachSupabaseAuth`.
- `playwright.config.ts` ya usa el puerto 8080.
- `/perfil`, `/mis-cv` y `/cv` siguen renderizando datos fijos escritos en el componente.

## Lo que hago

### 1. Pantallas conectadas a las server functions

- `/perfil`: reemplazar los `defaultValue` fijos por carga con TanStack Query contra
  `getMiPerfil`, guardado con mutación contra `guardarPerfil`, barra de completitud
  calculada con `perfil.model`, y la firma de mail derivada de los datos reales.
- `/mis-cv`: listar los CVs reales, con duplicar y borrar persistidos; el modal de
  exportar queda igual (el PDF real es otro hito).
- `/cv`: cargar y guardar la versión seleccionada; el chat con Jack sigue simulado.
- Estados de carga, error y vacío en las tres pantallas (skeletons + reintento),
  para que una falla de red no deje la pantalla en blanco.

Las pantallas llaman **solo** a las server fns de `src/lib/*.functions.ts` actuales. Si el patch de
Claude renombra esas funciones o las mueve a `src/lib/server/profile.ts`, el cambio es de una
línea de import por pantalla; pero no se borran ni se convierten los archivos actuales hasta
revisar el patch y decidir explícitamente la estrategia de integración. La UI no depende del
mecanismo de sesión.

### 2. Menú de usuario en `AppShell`

- Avatar con iniciales, nombre y mail del usuario, y "Cerrar sesión".
- El dato del usuario se lee desde un único hook (`useAuth` hoy) para que, cuando entre el
  `UserMenu.tsx` de Claude, se reemplace ese componente sin tocar el resto del shell.
- Cierre de sesión con limpieza de la caché de TanStack Query antes de navegar a `/login`.

### 3. Tests

- Unit (vitest) de `perfil.model` y `cv.model`: mapeo desde/hacia la base, normalización
  del `jsonb` de `resumes`, cálculo de completitud y armado de firma.
- E2E (Playwright) con las server fns y la sesión mockeadas: `/perfil` muestra los datos
  cargados y el guardado dispara la mutación; sin sesión, una ruta protegida redirige a
  `/login`. Sin credenciales reales ni servicios externos.

### 4. Documentación y cierre

- `CHANGELOG.txt`: entrada v3.0 con lo hecho en este hito.
- `BACKLOG.md`: tildar lo cerrado.
- Nota explícita de **qué queda por probar recién con `VITE_SUPABASE_URL` /
  `VITE_SUPABASE_ANON_KEY` cargadas**: login con Google de punta a punta, que la sesión
  sobreviva a un refresh (la pieza que Claude marcó como no probada), alta automática del
  perfil en el primer login, y que RLS efectivamente filtre por `auth.uid()`.
- Correr `lint`, `typecheck`, `test` y `build`.

## Lo que NO hago en este hito

- No registro `attachSupabaseAuth` en `src/start.ts`: ese middleware pertenece al esquema
  bearer y el patch de Claude lo vuelve innecesario. Queda como está hasta integrar el patch.
- No creo ni edito clientes de Supabase, middleware de auth, el layout `_authenticated`
  ni el flujo de login: son territorio del patch.
- No agrego `@supabase/ssr` ni migraciones nuevas.
- No cargo credenciales ni toco la configuración de Supabase.

## Notas técnicas

- Al integrar el patch va a haber solapamiento en `src/lib/supabase/client.ts`,
  `src/routes/login.tsx` y `src/routes/_authenticated/route.tsx`: en esos archivos gana la
  versión de Claude. Las pantallas y los modelos de datos que toco acá no se solapan.
- Si el patch mueve las server fns a `src/lib/server/*`, los `*.functions.ts` actuales pasan
  a ser wrappers finos o se borran; lo resuelvo en el merge, no antes.
