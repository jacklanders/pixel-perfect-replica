import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  // La sesión de Supabase vive en cookies y la revalidamos desde el browser client.
  ssr: false,
  beforeLoad: async ({ location }) => {
    if (!isSupabaseConfigured) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }

    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
