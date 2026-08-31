import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Briefcase, Plus, Search, Clock, AlertTriangle, Loader2 } from "lucide-react";
import { listarApplications, getUsoDiario } from "@/lib/application.functions";

/* ─── Tipos ─── */
type ApplicationWithJobPost = {
  id: string;
  user_id: string;
  resume_id: string;
  job_post_id: string;
  status: "pending" | "sent" | "discarded";
  discard_reason: string | null;
  generated_subject: string | null;
  required_subject: string | null;
  generated_body: string | null;
  destination_email: string | null;
  sent_at: string | null;
  created_at: string;
  job_posts: {
    id: string;
    source_type: "text" | "image" | "url";
    raw_text: string | null;
    extracted_json: Record<string, unknown>;
    posted_at: string | null;
    closing_at: string | null;
    employer: string | null;
    role: string | null;
    location: string | null;
    created_at: string;
  } | null;
};

/* ─── Helpers ─── */
function tiempoRelativo(fecha: string): string {
  const diff = Date.now() - new Date(fecha).getTime();
  const min = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  if (hrs < 24) return `hace ${hrs} hora${hrs > 1 ? "s" : ""}`;
  if (days === 1) return "ayer";
  return `hace ${days} días`;
}

function estaVencido(closingAt: string | null): boolean {
  if (!closingAt) return false;
  return new Date(closingAt) < new Date();
}

function formatearFecha(fecha: string | null): string {
  if (!fecha) return "sin fecha";
  return new Date(fecha).toLocaleDateString("es-AR");
}

function fuenteLegible(sourceType: string | null): string {
  if (sourceType === "text") return "Texto pegado";
  if (sourceType === "image") return "Imagen del aviso";
  if (sourceType === "url") return "Enlace";
  return "Otro";
}

/* ─── Mapeos de estado ─── */
const estadoStyles: Record<string, string> = {
  sent: "bg-primary text-primary-foreground",
  pending: "bg-accent text-accent-foreground",
  discarded: "bg-muted text-muted-foreground",
};

const estadoLabel: Record<string, string> = {
  sent: "Enviada",
  pending: "Pendiente",
  discarded: "Descartada",
};

const filtros = [
  { key: "todas", label: "Todas", dbStatus: null as string | null },
  { key: "pendiente", label: "Pendientes", dbStatus: "pending" },
  { key: "enviada", label: "Enviadas", dbStatus: "sent" },
  { key: "descartada", label: "Descartadas", dbStatus: "discarded" },
] as const;

/* ─── Ruta ─── */
export const Route = createFileRoute("/_authenticated/postulaciones/")({
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

function PostulacionesPage() {
  const [filtro, setFiltro] = useState<(typeof filtros)[number]["key"]>("todas");
  const [q, setQ] = useState("");

  const fetchApps = useServerFn(listarApplications);
  const fetchUso = useServerFn(getUsoDiario);

  const {
    data: apps,
    isPending: appsPending,
    error: appsError,
  } = useQuery<ApplicationWithJobPost[]>({
    queryKey: ["applications"],
    queryFn: () => fetchApps(),
  });

  const { data: uso, isPending: usoPending } = useQuery({
    queryKey: ["uso-diario"],
    queryFn: () => fetchUso(),
  });

  const lista = (apps ?? []).filter((app) => {
    const filtroDb = filtros.find((f) => f.key === filtro)?.dbStatus;
    const okEstado = filtro === "todas" || app.status === filtroDb;
    const texto =
      `${app.job_posts?.role ?? ""} ${app.job_posts?.employer ?? ""} ${app.job_posts?.location ?? ""}`.toLowerCase();
    return okEstado && texto.includes(q.toLowerCase().trim());
  });

  const enviados = uso?.used_today ?? 0;
  const limite = uso?.limit ?? 2;

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
          {usoPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            `${enviados} / ${limite} mails hoy`
          )}
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

      {appsPending ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Cargando postulaciones…
        </div>
      ) : appsError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          <p>Error al cargar las postulaciones. Intentá recargar la página.</p>
          <p className="mt-2 font-mono text-xs break-all">
            {appsError instanceof Error ? appsError.message : String(appsError)}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {lista.map((app) => {
            const vencido = estaVencido(app.job_posts?.closing_at ?? null);
            return (
              <article
                key={app.id}
                className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-soft"
              >
                <div className="flex size-11 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                  <Briefcase className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate font-medium">
                      {app.job_posts?.role ?? "Vacante sin título"}
                    </h2>
                    <Badge className={estadoStyles[app.status]}>{estadoLabel[app.status]}</Badge>
                    {vencido ? (
                      <Badge variant="outline" className="gap-1">
                        <AlertTriangle className="size-3" /> Aviso vencido
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {app.job_posts?.employer ?? "Empresa no especificada"} ·{" "}
                    {app.job_posts?.location ?? "Ubicación no especificada"}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="size-3.5" /> Actualizado {tiempoRelativo(app.created_at)}
                    {app.discard_reason ? ` · ${app.discard_reason}` : ""}
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/postulaciones/$id" params={{ id: app.id }}>
                    Ver postulación
                  </Link>
                </Button>
              </article>
            );
          })}
          {lista.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {q || filtro !== "todas"
                ? "No hay postulaciones con ese filtro."
                : "Aún no cargaste ninguna vacante. Empezá haciendo clic en “Cargar aviso”."}
            </p>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}
