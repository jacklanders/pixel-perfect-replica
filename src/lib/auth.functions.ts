import { createServerFn } from "@tanstack/react-start";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; email: string | null };

export const getCurrentUser = createServerFn({ method: "GET" }).handler(
  async (): Promise<CurrentUser | null> => {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  },
);
