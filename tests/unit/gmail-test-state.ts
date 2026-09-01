import { FakeSupabase } from "./supabase-fake";

/**
 * Estado mutable compartido entre el factory de `vi.mock` y el cuerpo del test.
 *
 * Al estar en un módulo aparte, el factory puede importarlo sin depender de
 * `vi.hoisted` (que el runner nativo de bun no implementa). Funciona igual con
 * vitest y con `bun test`.
 */
export const gmailState = {
  env: {
    GOOGLE_CLIENT_ID: "test-client-id",
    GOOGLE_CLIENT_SECRET: "test-client-secret",
    OAUTH_ENCRYPTION_KEY: "test-enc-key-0123456789abcdef",
  } as Record<string, string | undefined>,
  client: undefined as FakeSupabase | undefined,
};
