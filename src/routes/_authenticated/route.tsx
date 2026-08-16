import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  // La sesión de Supabase vive en localStorage: el servidor no puede leerla.
  ssr: false,
  beforeLoad: async ({ location }) => {
    if (!isSupabaseConfigured) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
