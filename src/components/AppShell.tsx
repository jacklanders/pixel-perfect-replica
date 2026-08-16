import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { FileText, User, Sparkles, Briefcase } from "lucide-react";
import { JackMark } from "@/components/SiteHeader";
import { LIMITE_DIARIO, mailsEnviadosHoy, usePostulaciones } from "@/lib/mock-postulaciones";

const nav = [
  { to: "/perfil", label: "Perfil", icon: User },
  { to: "/cv", label: "Editor", icon: Sparkles },
  { to: "/mis-cv", label: "Mis CVs", icon: FileText },
  { to: "/postulaciones", label: "Postulaciones", icon: Briefcase },
] as const;

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  usePostulaciones();
  const enviados = mailsEnviadosHoy();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-6xl gap-8 px-5 py-6 md:py-10">
        <aside className="hidden w-52 shrink-0 md:block">
          <Link to="/" className="mb-8 inline-flex" aria-label="Inicio">
            <JackMark />
          </Link>
          <nav className="flex flex-col gap-1">
            {nav.map((item) => {
              const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-secondary font-medium text-secondary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-8 rounded-xl border border-border bg-card p-4 shadow-soft">
            <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3.5 text-accent" />
              Uso diario
            </p>
            <p className="mt-2 font-display text-2xl font-bold">
              {enviados} / {LIMITE_DIARIO}
            </p>
            <p className="text-xs text-muted-foreground">postulaciones enviadas hoy</p>
            <p className="mt-3 text-xs text-muted-foreground">
              Mejorar tu CV con Jack es siempre gratis y sin límite.
            </p>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-bold md:text-3xl">{title}</h1>
              {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
            </div>
            <nav className="flex gap-2 md:hidden">
              {nav.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
