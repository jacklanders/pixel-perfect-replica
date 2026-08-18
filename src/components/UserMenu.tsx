import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Muestra "Ingresar" o "Salir" según la sesión del browser client. Es solo UI:
 * la protección real de rutas pasa por `beforeLoad` (server-side, ver
 * src/lib/server/auth.ts) + RLS en Supabase, no por lo que se muestre acá.
 */
export function UserMenu() {
  const navigate = useNavigate();
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    supabase.auth.getSession().then(({ data }) => {
      setLoggedIn(!!data.session);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  if (loggedIn === null) {
    // Placeholder del mismo tamaño para no saltar el layout mientras se resuelve.
    return <div className="h-9 w-24" aria-hidden="true" />;
  }

  if (!loggedIn) {
    return (
      <Button asChild size="sm">
        <Link to="/login">Ingresar</Link>
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        const supabase = getSupabaseBrowserClient();
        await supabase.auth.signOut();
        void navigate({ to: "/" });
      }}
    >
      Salir
    </Button>
  );
}
