import { createServerFn } from "@tanstack/react-start";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isMockAuthEnabled } from "@/lib/server/env";

export type CurrentUser = { id: string; email: string | null };

const MOCK_USER_ID = "00000000-0000-0000-0000-000000000001";
const MOCK_USER_EMAIL = "test@jack.local";

export const getCurrentUser = createServerFn({ method: "GET" }).handler(
  async (): Promise<CurrentUser | null> => {
    // Modo E2E: no depender de un login real con Google en CI.
    if (isMockAuthEnabled()) {
      return { id: MOCK_USER_ID, email: MOCK_USER_EMAIL };
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  },
);
