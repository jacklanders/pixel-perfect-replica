<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

<!--
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
   BACKLOG / ESTADO DE TRABAJO — "Límites diarios configurables" (decisión 15/09)
   Fecha: 15/09
   Estado: CONCLUIDA como implementación 18/09 — pendiente SOLO aplicar 0015 al Cloud y deploy (ver al pie)
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
-->

## PROBLEMA (contexto previo a esta feature)
El límite diario de postulaciones está hardcodeado en 2 lugares del código TS:
- `src/lib/application.functions.ts` → `getUsoDiario` (`limit: 2`, `Math.max(0, 2 - used)`)
- `src/lib/server/enviar-postulacion-email.ts` → `increment_daily_usage` (`p_limit: 2`)

`app_settings` existe en la DB con `daily_free_application_limit` / `admin_daily_application_limit`,
pero ninguna server fn las lee. Editar eso en el panel admin NO tenía efecto real.

## DECISIÓN (15/09)
Crear límites diarios configurables con 3 niveles de precedencia, resueltos en
UN solo lugar server-side para que la UI y el corte real del envío coincidan:
  1. Override por usuario → tabla `user_application_limits`
  2. Default por rol → desde `app_settings`
  3. Fallback por código (2 free / 10 admin)

## LO HECHO (implementación completa 18/09 — commitear/verificar/deploy al pie)
- `supabase/migrations/0015_limite_diario_efectivo.sql` (NUEVO) — RPC `obtener_limite_diario_efectivo`
  (security definer, mismo patrón que `has_role`) que resuelve los 3 niveles de precedencia en un
  solo lugar server-side.
- `src/lib/server/limite-diario.ts` (NUEVO) — resolver `obtenerLimiteDiarioEfectivo` que envuelve esa
  RPC y devuelve `{ limite, rol, override }`.
- `getUsoDiario` usa el resolver (devuelve `limit`/`rol`/`override` dinámicos; adiós al hardcode 2).
- Enforcer del envío (`enviar-postulacion-email.ts`) usa el resolver como `p_limit` y el mensaje de
  límite alcanzado sale parametrizado con el límite efectivo.
- Admin: server fn `establecerLimiteDiarioUsuario` (upsert/delete del override, admin-only) +
  `getAdminDashboard` resuelve el límite efectivo de cada reciente con la MISMA RPC.
- UI admin: fila de usuario con `rol`, límite diario editable y botón "Default" para quitar override.
- `supabase/migrations/0012_user_application_limits.sql` (NUEVO) — tabla de overrides; commiteada
  como safety net (`safety-net-limite-diario`). Aplicada al Cloud 18/09.
  (Nota: el header interno dice "0005..." por un rename; el archivo real es 0012.)

## LO PENDIENTE (desde acá en adelante)
- [x] que `getUsoDiario` use el resolver (hecho 18/09).
- [x] que el enforcer del envío use el resolver como `p_limit` (hecho 18/09).
- [x] server fn `establecerLimiteDiarioUsuario` (hecho 18/09).
- [x] merge del límite efectivo/override en `getAdminDashboard` + `usuariosRecientes` editable (hecho 18/09).
- [x] SQL 0012 → aplicarlo en el Cloud (SQL Editor, como el 0004). Hecho 18/09 junto con 0013, 0014
      y 0004 sección 3 (`Success. No rows returned`).
- [ ] SQL 0015 (RPC del resolver) → aplicarlo en el Cloud vía SQL Editor ANTES del deploy.
- [ ] build + lint + tsc + tests (✅ verificados 18/09: 74 tests / lint 0 errores / tsc / build).
- [ ] commit de la feature completa + push.
- [ ] deploy a Cloudflare Workers.

## PLAN DE TRABAJO (orden de ejecución)
1. Resolver `obtenerLimiteDiarioEfectivo` ✅ (RPC 0015 + `limite-diario.ts`, hecho 18/09)
2. Cablear `getUsoDiario` al resolver. ✅
3. Cablear enforcer (`enviar-postulacion-email.ts`) al resolver. ✅
4. `establecerLimiteDiarioUsuario` (server fn admin). ✅
5. Merge al dashboard + UI admin (campo límite por usuario editable). ✅
6. Lint/typecheck/tests (✅ 74 tests) → commit feature → push.
7. Aplicar SQL 0015 al Cloud vía SQL Editor → deploy.

## REGLA IMPORTANTE
NO commitear la feature hasta que: build ✅ + lint ✅ + tsc ✅ + tests ✅.
El único commit permitido como red de seguridad es el del SQL 0012 ya hecho.
La feature completa se commitea la misma sesión 18/09 una vez verde.

