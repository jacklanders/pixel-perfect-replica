import { createMiddleware } from "@tanstack/react-start";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isMockAuthEnabled } from "@/lib/server/env";

// Identidad de test usada cuando MOCK_AUTH=true. Debe existir en la base (con
// filas en profiles/user_roles) para que el resto del flujo funcione bajo RLS.
// Se inyecta una cookie y también se acepta vía env para flexibilidad en CI.
const MOCK_USER_ID = "00000000-0000-0000-0000-000000000001";
const MOCK_USER_EMAIL = "test@jack.local";

function getMockHeaderValue(): string | null {
  if (isMockAuthEnabled()) {
    return `${MOCK_USER_ID}:${MOCK_USER_EMAIL}`;
  }
  return null;
}

/**
 * Valida la sesión (cookies, no bearer token) y deja en contexto un cliente
 * Supabase que actúa como el usuario (RLS aplicada, nunca service_role).
 *
 * En modo MOCK_AUTH=true (tests E2E) se omite la validación real contra
 * Supabase Auth y se usa una identidad determinística de test, para no
 * depender de un login real con Google en CI. El cliente Supabase sigue siendo
 * el real, así que el resto del flujo (queries con RLS) debe contar con ese
 * usuario de prueba existiendo en la base.
 */
export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const supabase = getSupabaseServerClient();

    const mockHeader = getMockHeaderValue();
    if (mockHeader) {
      const [userIdRaw, email] = mockHeader.split(":");
      const userId = userIdRaw ?? MOCK_USER_ID;
      const userMetadata: Record<string, unknown> = {
        full_name: "Usuario de Test",
        email: email ?? "",
      };
      return next({
        context: {
          supabase,
          userId,
          email: email ?? "",
          userMetadata,
        },
      });
    }

    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      // FIX: Usar error con statusCode para que errorMiddleware lo deje pasar
      const authError = new Error("Unauthorized") as Error & { statusCode: number };
      authError.statusCode = 401;
      throw authError;
    }

    return next({
      context: {
        supabase,
        userId: data.user.id,
        email: data.user.email ?? "",
        userMetadata: (data.user.user_metadata ?? {}) as Record<string, unknown>,
      },
    });
  },
);
