import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { JackMark } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
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

function destinoSeguro(redirectParam?: string): string {
  if (redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//")) {
    return redirectParam;
  }
  return "/perfil";
}

function LoginPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const { session, cargando } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!cargando && session) {
      navigate({ to: destinoSeguro(redirect), replace: true });
    }
  }, [cargando, session, redirect, navigate]);

  const entrarConGoogle = async () => {
    setError(null);
    if (!isSupabaseConfigured) {
      setError("Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.");
      return;
    }
    const destino = destinoSeguro(redirect);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}${destino}`,
      },
    });
    if (err) setError(err.message);
  };

  const entrarConEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isSupabaseConfigured) {
      setError("Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.");
      return;
    }
    setEnviando(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setEnviando(false);
    if (err) setError(err.message);
    else navigate({ to: destinoSeguro(redirect), replace: true });
  };

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

          <Button
            variant="outline"
            className="mt-7 w-full"
            size="lg"
            onClick={entrarConGoogle}
            type="button"
          >
            Continuar con Google
          </Button>

          <div className="my-6 flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">o</span>
            <Separator className="flex-1" />
          </div>

          <form className="space-y-4" onSubmit={entrarConEmail}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="vos@email.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button className="w-full" size="lg" type="submit" disabled={enviando}>
              {enviando ? "Entrando…" : "Entrar"}
            </Button>
          </form>

          {error ? (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {!isSupabaseConfigured ? (
            <p className="mt-6 text-xs text-muted-foreground">
              Supabase todavía no está configurado en este entorno: cargá VITE_SUPABASE_URL y
              VITE_SUPABASE_ANON_KEY para habilitar el login real.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
