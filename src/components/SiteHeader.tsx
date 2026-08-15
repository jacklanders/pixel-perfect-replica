import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function JackMark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display ${className}`}>
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
        J
      </span>
      <span className="text-lg font-bold tracking-tight">Jack</span>
    </span>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link to="/" aria-label="Inicio">
          <JackMark />
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <Link to="/perfil" className="transition-colors hover:text-foreground">
            Perfil
          </Link>
          <Link to="/cv" className="transition-colors hover:text-foreground">
            Mi CV
          </Link>
        </nav>
        <Button asChild size="sm">
          <Link to="/login">Ingresar</Link>
        </Button>
      </div>
    </header>
  );
}
