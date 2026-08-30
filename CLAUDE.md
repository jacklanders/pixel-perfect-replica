# CLAUDE.md — Jack

Memoria operativa corta. El prompt de producto completo vive en `README.md` y en
`Prompt_Jack_revisado_agosto_2026`.

## Stack

- **Frontend/SSR:** React 19 + TanStack Start (`@tanstack/react-start` + Router) sobre
  Vite; scaffold de Lovable (`@lovable.dev/vite-tanstack-config`). **No editar
  `vite.config.ts` a mano**; config extra vía `defineConfig({ vite: {...} })`.
- **Runtime:** `bun` (no npm). `bun install`, `bun run dev` (puerto 8080).
- **Hosting:** Cloudflare Workers vía Nitro (preset del scaffold). Deploy:
  `bun run build` → `npx wrangler login` → `npx nitro deploy --prebuilt`.
- **Backend:** Supabase (Auth + Postgres + Storage). La lógica server (IA, OAuth Gmail,
  envío de mail) va en `createServerFn`/rutas API de TanStack, **no** en Edge Functions.
- **IA:** `AI_PROVIDER=gemini|anthropic`, solo desde `src/lib/server/`. `MOCK_AI=true`
  simula la extracción (E2E).

## Comandos

```bash
bun run dev          # dev server
bun run lint         # eslint (hook pre-commit: eslint --fix + tsc --noEmit)
bun run typecheck    # tsc --noEmit
bun run test         # vitest (unit/integration)
bun run test:e2e     # playwright (requiere e2e/.auth/user.json; MOCK_AI/MOCK_GMAIL)
bun run build        # vite build (client + SSR + worker)
```

Todo hito corre `lint`, `typecheck`, `test` y `build` antes de cerrarse. Flujos
críticos (login, CV, postulación, envío Gmail) con Playwright + mocks.

## Convenciones

- `src/routes/` — rutas TanStack file-based (no tocar `routeTree.gen.ts` a mano).
- `src/lib/server/**` — **server-only** (IA, supabase `service_role`, Gmail). Nunca
  importado desde código de browser; el import-protection de TanStack lo enforce.
- `src/routes/api/` — endpoints HTTP propios (callback OAuth de Google).
- `supabase/migrations/` — `NNNN_desc.sql`; **nunca editar una ya aplicada**.
- RLS: toda tabla de usuario lleva policies `auth.uid() = user_id` + GRANT explícito.
  Admin vía `user_roles` + `has_role()` (`security definer`, `search_path` fijo),
  nunca columna `role` en `profiles`.
- Secretos: `VITE_*` se embeben en build; el resto son secrets del runtime
  (`.env.local` dev / secrets del worker en prod). Nunca commitear credenciales.
- Sesión única: cookies vía `@supabase/ssr`. Guard server-side en
  `_authenticated/route.tsx`. No reintroducir bearer/localStorage de otra forma.

## Definition of Done

Un hito cierra solo si:
- Ruta usable de punta a punta (no capas sueltas).
- `lint` + `typecheck` + tests + `build` en verde.
- RLS verificado en toda tabla nueva.
- Resumen: qué cambió, cómo probarlo, qué se corrió y qué falta probar.