import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getCurrentUser } from "@/lib/auth.functions";

/**
 * Guard real de las rutas privadas: corre `beforeLoad` en el servidor (SSR y en
 * cada navegación), usando la cookie de sesión — no se puede saltear editando
 * el cliente. Antes esto tenía `ssr: false` y chequeaba la sesión solo desde el
 * browser client, lo cual no es una protección real (la primera respuesta HTML
 * salía sin chequeo) y además usaba un mecanismo de sesión distinto al del
 * resto del código. Se unificó a `getCurrentUser()` (cookies).
 */
export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    const user = await getCurrentUser();
    if (!user) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    return { user };
  },
  component: () => <Outlet />,
});
