import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Briefcase, Plus, Search, Clock, AlertTriangle } from "lucide-react";
import {
  LIMITE_DIARIO,
  estadoLabel,
  mailsEnviadosHoy,
  usePostulaciones,
  type EstadoPostulacion,
} from "@/lib/mock-postulaciones";

export const Route = createFileRoute("/postulaciones/")({
  head: () => ({
    meta: [
      { title: "Postulaciones — Jack" },
      {
        name: "description",
        content:
          "Historial de vacantes trabajadas con Jack: enviadas, pendientes de confirmación y descartadas con su motivo.",
      },
      { property: "og:title", content: "Postulaciones — Jack" },
      {
        property: "og:description",
        content: "Seguí el estado de cada postulación generada con Jack.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PostulacionesPage,
});

const filtros = [
  { key: "todas", label: "Todas" },
  { key: "pendiente", label: "Pendientes" },
  { key: "enviada", label: "Enviadas" },
  { key: "descartada", label: "Descartadas" },
] as const;

const estadoStyles: Record<EstadoPostulacion, string> = {
  enviada: "bg-primary text-primary-foreground",
  pendiente: "bg-accent text-accent-foreground",
  descartada: "bg-muted text-muted-foreground",
};

function PostulacionesPage() {
  const postulaciones = usePostulaciones();
  const [filtro, setFiltro] = useState<(typeof filtros)[number]["key"]>("todas");
  const [q, setQ] = useState("");

  const lista = postulaciones.filter((p) => {
    const okEstado = filtro === "todas" || p.estado === filtro;
    const texto = `${p.puesto} ${p.empresa} ${p.ubicacion}`.toLowerCase();
    return okEstado && texto.includes(q.toLowerCase().trim());
  });

  const enviados = mailsEnviadosHoy();

  return (
    <AppShell
      title="Postulaciones"
      subtitle="Todo lo que trabajaste con Jack, con su estado actual."
    >
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button asChild>
          <Link to="/postulaciones/nueva">
            <Plus className="size-4" /> Cargar aviso
          </Link>
        </Button>
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por puesto o empresa"
            className="pl-9"
            aria-label="Buscar postulaciones"
          />
        </div>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {enviados} / {LIMITE_DIARIO} mails hoy
        </Badge>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {filtros.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFiltro(f.key)}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
              filtro === f.key
                ? "border-primary bg-secondary font-medium text-secondary-foreground"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4">
        {lista.map((p) => (
          <article
            key={p.id}
            className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-soft"
          >
            <div className="flex size-11 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <Briefcase className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate font-medium">{p.puesto}</h2>
                <Badge className={estadoStyles[p.estado]}>{estadoLabel[p.estado]}</Badge>
                {p.vencido ? (
                  <Badge variant="outline" className="gap-1">
                    <AlertTriangle className="size-3" /> Aviso vencido
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {p.empresa} · {p.ubicacion}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3.5" /> Actualizado {p.actualizado}
                {p.motivo ? ` · ${p.motivo}` : ""}
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/postulaciones/$id" params={{ id: p.id }}>
                Ver postulación
              </Link>
            </Button>
          </article>
        ))}
        {lista.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No hay postulaciones con ese filtro.
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
