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
   Estado: EN PROGRESO (NO commiteada como feature todavía — ver al pie)
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

## LO HECHO (en disco, NO commiteado como feature)
- `src/lib/server/limite-diario.ts` (NUEVO) — resolver `obtenerLimiteDiarioEfectivo`
  que devuelve `{ limite, rol, override }`. Mensaje de error del enforcer
  parametrizado. Importa el patrón requireSupabaseAuth ya existente.
- `supabase/migrations/0012_user_application_limits.sql` (NUEVO) — crea la tabla
  `user_application_limits` (user_id PK, daily_limit, updated_by, updated_at,
  motivo) + grants service_role. **ESTE SQL YA ESTÁ COMMITEADO COMO SAFETY NET
  (commit `safety-net-limite-diario`) para no perderlo.**
  (Nota: dentro el header dice "0005..." por un rename; el archivo real es 0012
  y NO colisiona con 0005_drop_orphan_columns.)

## LO PENDIENTE (NO hecho todavía — NO commitear la feature hasta que quede verde)
- [ ] Hacer que `getUsoDiario` use el resolver (hoy sigue hardcodeado 2).
- [ ] Hacer que el enforcer del envío use el resolver como `p_limit`.
- [ ] Admin: server fn `establecerLimiteDiarioUsuario` (upsert, admin-only).
- [ ] Admin: merge del límite efectivo/override en `getAdminDashboard` +
      `usuariosRecientes` con `limiteDiario` editable.
- [x] SQL 0012 → aplicarlo en el Cloud (SQL Editor, como el 0004). Hecho 18/09 junto con 0013, 0014
      y 0004 sección 3 (`Success. No rows returned`).
- [ ] build + lint + tsc + tests + commit de la feature completa + push.
- [ ] Deploy a Cloudflare Workers.

## PLAN DE TRABAJO (orden de ejecución)
1. Resolver `obtenerLimiteDiarioEfectivo` ✅ (listo en `limite-diario.ts`)
2. Cablear `getUsoDiario` al resolver.
3. Cablear enforcer (`enviar-postulacion-email.ts`) al resolver.
4. `establecerLimiteDiarioUsuario` (server fn admin).
5. Merge al dashboard + UI admin (campo límite por usuario editable).
6. Lint/typecheck/tests → commit feature → push.
7. Aplicar SQL 0012 al Cloud vía SQL Editor → deploy.

## REGLA IMPORTANTE
NO commitear la feature hasta que: build ✅ + lint ✅ + tsc ✅ + tests ✅.
El único commit permitido como red de seguridad es el del SQL 0012 ya hecho.

