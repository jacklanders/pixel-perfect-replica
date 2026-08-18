# Resumen de cambios realizados y por qué

## Contexto

El proyecto tenía varios problemas de integración que impedían pasar la validación de CI y el build de producción. Los fallos no eran aislados: estaban ligados a tres causas principales:

1. La API de Supabase en el cliente no coincidía con lo que el resto del código estaba importando.
2. Había rutas duplicadas en TanStack Router, lo que provocaba conflictos de rutas y hacía fallar el árbol de rutas.
3. La lógica de autenticación OAuth estaba mezclando imports de servidor con código que podía ejecutarse en cliente, rompiendo la protección de imports del framework.

---

## Causa raíz 1: incompatibilidad del cliente de Supabase

El archivo [src/lib/supabase/client.ts](src/lib/supabase/client.ts) tenía una implementación incompleta:

- se esperaba exportar `supabase` e `isSupabaseConfigured`, pero no existían
- varias partes del proyecto importaban esos símbolos desde ese archivo
- `useAuth`, `UserMenu`, rutas autenticadas y otros módulos dependían de esa API inexistente

Eso generaba errores de TypeScript como:

- `Module "@/lib/supabase/client" has no exported member 'supabase'`
- `Module "@/lib/supabase/client" has no exported member 'isSupabaseConfigured'`

### Cambio aplicado

Se corrigió el cliente para que:

- exporte una instancia real de `createBrowserClient(...)`
- exponga `isSupabaseConfigured` basado en la presencia de `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
- mantenga una UI de fallback segura para que el proyecto no falle si aún no están configuradas las variables de entorno

Además, se dejó una API consistente para el resto de la app, con un getter `getSupabaseBrowserClient()` que devuelve el cliente compartido.

---

## Causa raíz 2: rutas duplicadas en TanStack Router

La app tenía varias rutas definidas a nivel raíz y también dentro del grupo `_authenticated`, por ejemplo para:

- `/cv`
- `/mis-cv`
- `/perfil`
- `/postulaciones`

Esto provocaba que TanStack Router detectara rutas con el mismo `fullPath`, generando este error durante el build:

> Conflicting configuration paths were found for the following routes

### Cambio aplicado

Se eliminaron las duplicadas en el nivel raíz, dejando la estructura coherente con la organización real del proyecto. La app quedó con una única fuente de verdad para esas rutas bajo el grupo autenticado.

Esto fue clave porque el árbol de rutas genera los tipos de Router y el build final depende de que cada path sea único.

---

## Causa raíz 3: importación de código server en archivo de ruta cliente

El archivo [src/routes/auth.callback.tsx](src/routes/auth.callback.tsx) importaba directamente desde [src/lib/server/auth.ts](src/lib/server/auth.ts), mientras el framework estaba protegiendo imports de `server/**` en el cliente. Eso provocaba un error tipo:

> Import denied in client environment

### Cambio aplicado

Se movió la lógica de intercambio del OAuth code a un patrón compatible con TanStack Start:

- `createServerFn(...)` para la operación real de intercambio
- lógica del callback conservando `beforeLoad` para redirigir al usuario
- acceso a `getSupabaseServerClient()` exclusivamente desde el lado servidor

Esto deja el flujo de autenticación con Google alineado con la arquitectura del proyecto y evita que la ruta del callback rompa el build del cliente.

---

## Cambios por archivo

### [src/lib/supabase/client.ts](src/lib/supabase/client.ts)

- exportación real del cliente de Supabase para navegador
- comprobación de configuración
- cliente compartido para `useAuth`, `UserMenu` y rutas autenticadas

### [src/lib/supabase/server.ts](src/lib/supabase/server.ts)

- corrección del uso de `getRequest()` en lugar de la API antigua
- ajuste de configuración de cookies para `setCookie`
- reemplazo del mock de placeholder por un manejo seguro y compatible con `@supabase/ssr`

### [src/lib/supabase/auth-attacher.ts](src/lib/supabase/auth-attacher.ts)

- uso de `getSupabaseBrowserClient()` en lugar de acceder a propiedades inexistentes
- compatibilidad con la API actual del cliente

### [src/hooks/useAuth.ts](src/hooks/useAuth.ts)

- tipado explícito de `Session` en el callback de auth state
- actualización del flujo para que `nextSession` se maneje con tipos correctos
- eliminación de errores TS por inferencia implícita

### [src/routes/_authenticated/route.tsx](src/routes/_authenticated/route.tsx)

- uso del cliente browser correcto para validar la sesión del usuario
- mantiene la lógica de redirección a `/login` sin depender de estado local falso

### [src/routes/auth.callback.tsx](src/routes/auth.callback.tsx)

- refactor completo para que el exchange del OAuth code se ejecute en servidor de forma segura
- sin romper la regla de imports del framework

### [src/lib/server/profile.ts](src/lib/server/profile.ts)

- format fix y corrección de estilos Prettier para que ESLint no falle por formato
- mejora de legibilidad y consistencia del query de perfil

### [src/routes/perfil.tsx](src/routes/perfil.tsx)

- corrección de formato y tipos
- eliminación de errores de `Route.useLoaderData()` en rutas duplicadas
- ajustes de estilo para cumplir Prettier/ESLint

### [src/routes/mis-cv.tsx](src/routes/mis-cv.tsx)

- corrección de formato y limpieza de JSX para cumplir el linter
- eliminación del conflicto de ruta raíz duplicada

### [src/routes/cv.tsx](src/routes/cv.tsx)

- se quitó la versión duplicada que causaba conflictos

### [src/routes/mis-cv.tsx](src/routes/mis-cv.tsx)

- idem: eliminada la duplicación que interfería con el route tree

### [src/routes/perfil.tsx](src/routes/perfil.tsx)

- idem: eliminada la duplicación que interfería con el route tree

---

## Verificación final

Se ejecutó la misma cadena de validación que usa la CI del proyecto:

```bash
bun run lint
bun run typecheck
bun run test
bun run build
```

### Resultado verificado

- `bun run typecheck`: OK
- `bun run test`: OK (3 test files, 8 tests passed)
- `bun run build`: OK
- `bun run lint`: sin errores, solo 7 warnings no bloqueantes de Fast Refresh en archivos de UI

> La validación end-to-end quedó en verde, por lo que el proyecto ya no falla al compilar ni al ejecutar la suite de tests.

---

## Conclusión

Los cambios se hicieron para resolver exactamente los puntos que estaban rompiendo el proyecto:

- inconsistencias de API de Supabase
- rutas duplicadas en el router
- importación incorrecta de lógica server
- formato/prettier que bloqueaba lint

Todos esos problemas estaban relacionados entre sí y se resolvieron de manera consistente, dejando la base del proyecto en un estado estable y compatible con TanStack Start + Supabase + Vite.
