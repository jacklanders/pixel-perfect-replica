import { createFileRoute, Link } from "@tanstack/react-router";
import { JackMark } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Ingresar a Jack" },
      {
        name: "description",
        content: "Entrá a Jack con tu cuenta de Google o tu email para trabajar en tu CV.",
      },
      { property: "og:title", content: "Ingresar a Jack" },
      {
        property: "og:description",
        content: "Accedé a tu perfil y a tu CV asistido por IA.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="surface-hero relative hidden flex-col justify-between p-10 md:flex">
        <div className="grid-paper absolute inset-0 opacity-30" aria-hidden="true" />
        <Link to="/" className="relative">
          <JackMark />
        </Link>
        <p className="relative max-w-sm font-display text-3xl leading-tight font-bold">
          “Contame qué hacés y armamos juntos un CV que se entienda en 10 segundos.”
        </p>
        <p className="relative text-sm opacity-70">Jack · asistente de CV</p>
      </div>

      <div className="flex items-center justify-center px-5 py-16">
        <div className="w-full max-w-sm">
          <div className="md:hidden">
            <Link to="/">
              <JackMark />
            </Link>
          </div>
          <h1 className="mt-8 font-display text-2xl font-bold md:mt-0">Ingresar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Usá tu cuenta de Google: es la casilla desde la que después enviás postulaciones.
          </p>

          <Button variant="outline" className="mt-7 w-full" size="lg" asChild>
            <Link to="/perfil">Continuar con Google</Link>
          </Button>

          <div className="my-6 flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">o</span>
            <Separator className="flex-1" />
          </div>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="vos@email.com" autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" autoComplete="current-password" />
            </div>
            <Button asChild className="w-full" size="lg">
              <Link to="/perfil">Entrar</Link>
            </Button>
          </form>

          <p className="mt-6 text-xs text-muted-foreground">
            Prototipo de interfaz: todavía no hay cuentas reales.
          </p>
        </div>
      </div>
    </div>
  );
}
