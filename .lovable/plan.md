# Revisión del "Hito 0" preparado en Claude

Revisé el patch (`0001-hito-0-fundacion.patch`) contra el repo real. El diagnóstico de Claude es correcto en lo estructural, pero hay errores que romperían la app en runtime y una recomendación de proceso que conviene invertir.

## Lo que Claude acertó

- Es TanStack Start con SSR, `vite.config.ts` gestionado por `@lovable.dev/vite-tanstack-config` y build Nitro a Cloudflare Workers. No es Vite+React estático.
- El gestor de paquetes es `bun` (`bun.lock`, `bunfig.toml`), no npm.
- Hoy el repo es 100% maqueta con `src/lib/mock-postulaciones.ts`, sin backend ni tests.
- El supuesto "Netlify + build estático" del prompt original no aplica.

## Errores del patch que hay que corregir antes de aplicarlo

1. **Faltan los `GRANT` en las 7 tablas.** Ninguna tabla del `0001_init.sql` tiene grants. En este stack, RLS sola no alcanza: sin `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated` (y `GRANT ALL ... TO service_role`) toda consulta devuelve error de permisos. Este es el fallo más grave: la migración "pasa" pero la app no puede leer nada.
2. **`oauth_connections` con policy de SELECT para el usuario.** Guarda refresh tokens de Gmail; con esa policy el token viaja al navegador. Debe ser tabla sin acceso desde el cliente (solo `service_role`), leída únicamente desde el servidor.
3. **`app_settings` legible por cualquier autenticado, sin tabla de roles.** Para el panel de admin de la Fase 1 hace falta una tabla `user_roles` separada + función `has_role()` security definer. Nunca un campo `role` en `profiles`.
4. **`increment_daily_usage`**: falta fijar `search_path` y revisar los `GRANT EXECUTE`; tal como está, una función security definer sin `set search_path = public` es un riesgo de escalación.
5. **`.env.example` con `SUPABASE_SERVICE_ROLE_KEY` y claves de IA en archivo.** En este proyecto los secretos van al gestor de secretos de la plataforma y se leen dentro del handler del server function, nunca desde un `.env` commiteado ni con prefijo `VITE_`.
6. **Edge Functions de Supabase para la IA/Gmail.** En este stack no se usan: la lógica de servidor va en `createServerFn` (`src/lib/*.functions.ts`) y los webhooks/callbacks OAuth en rutas `src/routes/api/public/*`.
7. **`manifest.webmanifest` + `link` en `__root.tsx`**: está bien, pero faltan los íconos reales; sin ellos el manifest tira 404 en consola.
8. **README/CI con npm**: el workflow ya usa bun, pero los scripts `typecheck`/`test`/`test:e2e` no existen todavía en `package.json`; hay que agregarlos junto con las dependencias, o el CI falla en el primer run.
9. **Deploy**: el target real es Cloudflare Workers vía Nitro (o publicar desde Lovable). Cualquier referencia a Netlify hay que eliminarla del Hito 5.

## Sobre el flujo de trabajo propuesto

La recomendación de "no dejar que Lovable conecte Supabase" está basada en un supuesto equivocado. Acá el backend se activa con Lovable Cloud y las migraciones se escriben a mano, con RLS `auth.uid() = user_id` y grants explícitos en el mismo archivo — es exactamente lo que el prompt exige, y además queda versionado en `supabase/migrations/`. El riesgo mayor es el inverso: aplicar por patch un esquema creado contra otro proyecto Supabase y que quede desalineado con el que usa la app.

Flujo sugerido:

- Backend (esquema, RLS, auth, server functions) se hace acá, versionado en el repo.
- Claude sigue siendo útil para revisión de seguridad del SQL, definición de hitos y tests.
- Evitar patches que toquen `vite.config.ts`, `src/routeTree.gen.ts` o `package.json` de dependencias base.

## Qué propongo hacer ahora

1. Aplicar del Hito 0 solo lo que no depende del backend: `CLAUDE.md`, `BACKLOG.md`, README corregido (bun + Cloudflare), `manifest.webmanifest` con íconos, `src/lib/observability.ts`.
2. Reescribir `0001_init.sql` con las 7 tablas + `user_roles`, cada `CREATE TABLE` seguido de sus `GRANT`, RLS y policies; `oauth_connections` sin acceso de cliente; `increment_daily_usage` con `search_path` fijo.
3. Agregar CI y tests (`vitest` + `playwright`) con los scripts que faltan en `package.json`.
4. Recién después, activar el backend y conectar auth real, dejando la maqueta funcionando mientras tanto.

Decime si querés que arranque por el punto 1+3 (todo lo que no toca backend) o directamente por la migración corregida.
