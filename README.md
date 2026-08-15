# Pixel Perfect Replica

Implement exactly the screenshot and nothing else

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b4c16aa8-651d-4965-9d9a-4cf4ca72ae5d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
bun install
bun run dev
```

> Nota: el `package.json`/`bun.lock` de este repo usan **bun**, no npm. `npm i` puede funcionar pero no
> es lo que se prueba en CI ni lo que documenta `CLAUDE.md`.

## Setup del backend (Supabase) — Hito 0

1. Instalar [Supabase CLI](https://supabase.com/docs/guides/cli).
2. `cp .env.example .env.local` y completar valores (ver comentarios de cada variable).
3. `supabase start` — levanta Postgres/Auth/Storage locales usando `supabase/config.toml`.
4. `supabase db reset` — aplica las migraciones de `supabase/migrations/` desde cero.
5. En Supabase Studio local (puerto 54323 por defecto), verificar que las tablas `profiles`, `resumes`,
   `job_posts`, `applications`, `daily_usage`, `app_settings`, `oauth_connections` tienen RLS habilitado
   (columna "RLS" en verde).

Para conectar contra un proyecto Supabase remoto: `supabase link --project-ref <ref>` y
`supabase db push` en vez de `db reset`.

## Comandos de calidad

```sh
bun run lint
bun run typecheck
bun run test        # vitest
bun run test:e2e     # playwright (requiere bun run dev corriendo o webServer autoarrancado)
bun run build
```

## Despliegue

Cloudflare Workers vía Nitro (preset que ya trae el scaffold de Lovable) — no Netlify, que asumía el
prompt de producto original antes de ver el stack real. Pasos exactos de deploy (dominio, secrets de
Cloudflare, etc.) se documentan acá en Hito 5.
