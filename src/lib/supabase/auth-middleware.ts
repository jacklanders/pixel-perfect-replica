import { createMiddleware } from "@tanstack/react-start";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isMockAuthEnabled } from "@/lib/server/env";

const MOCK_USER_ID = "00000000-0000-0000-0000-000000000001";
const MOCK_USER_EMAIL = "test@jack.local";

function getMockHeaderValue(): string | null {
  if (isMockAuthEnabled()) {
    return `${MOCK_USER_ID}:${MOCK_USER_EMAIL}`;
  }
  return null;
}

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
      // FIX: Usar error con statusCode para que pase limpio por el middleware.
      // Distingue sesión expirada (refresh fallido) de "nunca autenticado".
      const msg = (error?.message ?? "").toLowerCase();
      const sesionExpirada = /(refresh|expirad|expired|jwt)/.test(msg);
      const authError = new Error(
        sesionExpirada
          ? "Tu sesión expiró. Volvé a iniciar sesión."
          : "Debés iniciar sesión para continuar.",
      ) as Error & { statusCode: number };
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
