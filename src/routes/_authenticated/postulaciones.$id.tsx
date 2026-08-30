import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Check,
  Copy,
  FileText,
  Paperclip,
  Send,
  Sparkles,
  Lock,
  Loader2,
  Save,
  Trash2,
} from "lucide-react";
import {
  getApplicationById,
  enviarPostulacion,
  actualizarApplication,
  actualizarApplicationStatus,
  getUsoDiario,
} from "@/lib/application.functions";
import { listarCvs } from "@/lib/cv.functions";
import { getMiPerfil } from "@/lib/perfil.functions";
import { useAuth } from "@/hooks/useAuth";

/* ─── Wrappers tipados para bypassar inferencia de TanStack Start v1.168 ─── */
type EnviarInput = {
  applicationId: string;
  generated_body?: string;
  destination_email?: string;
};
type ActualizarInput = {
  id: string;
  generated_body?: string;
  destination_email?: string;
  generated_subject?: string;
};
type StatusInput = {
  id: string;
  status: "pending" | "sent" | "discarded";
  discard_reason?: string | null;
};

async function fetchApplication(id: string) {
  return getApplicationById({
    data: { id },
  } as unknown as Parameters<typeof getApplicationById>[0]);
}

async function enviarApp(payload: EnviarInput) {
  return enviarPostulacion({
    data: payload,
  } as unknown as Parameters<typeof enviarPostulacion>[0]);
}

async function actualizarApp(payload: ActualizarInput) {
  return actualizarApplication({
    data: payload,
  } as unknown as Parameters<typeof actualizarApplication>[0]);
}

async function cambiarStatus(payload: StatusInput) {
  return actualizarApplicationStatus({
    data: payload,
  } as unknown as Parameters<typeof actualizarApplicationStatus>[0]);
}

/* ─── Tipos ─── */
type AppDetail = {
  id: string;
  user_id: string;
  resume_id: string | null;
  job_post_id: string;
  status: "pending" | "sent" | "discarded";
  discard_reason: string | null;
  generated_subject: string;
  required_subject: string | null;
  generated_body: string;
  destination_email: string;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  job_posts: {
    id: string;
    source_type: string;
    raw_text: string | null;
    extracted_json: Record<string, unknown> | null;
    posted_at: string | null;
    closing_at: string | null;
    employer: string | null;
    role: string | null;
    location: string | null;
    created_at: string;
  } | null;
  resumes: {
    id: string;
    title: string;
  } | null;
};

/* ─── Helpers ─── */
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

function estaVencido(closingAt: string | null): boolean {
  if (!closingAt) return false;
  return new Date(closingAt) < new Date();
}

function formatearFecha(fecha: string | null): string {
  if (!fecha) return "sin fecha";
  return new Date(fecha).toLocaleDateString("es-AR");
}

function CampoCopiable({
  label,
  value,
  fijo,
  multiline,
  onChange,
}: {
  label: string;
  value: string;
  fijo?: boolean;
  multiline?: boolean;
  onChange?: (v: string) => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const id = label.toLowerCase().replace(/\s/g, "-");

  const copiar = () => {
    void navigator.clipboard?.writeText(value);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1600);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="flex items-center gap-1.5">
          {label}
          {fijo ? <Lock className="size-3 text-muted-foreground" /> : null}
        </Label>
        <Button variant="ghost" size="sm" onClick={copiar}>
          {copiado ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copiado ? "Copiado" : "Copiar"}
        </Button>
      </div>
      {multiline ? (
        <Textarea
          id={id}
          rows={12}
          value={value}
          readOnly={fijo}
          onChange={(e) => onChange?.(e.target.value)}
        />
      ) : (
        <Input id={id} value={value} readOnly={fijo} onChange={(e) => onChange?.(e.target.value)} />
      )}
    </div>
  );
}

/* ─── Ruta ─── */
export const Route = createFileRoute("/_authenticated/postulaciones/$id")({
  head: () => ({
    meta: [
      { title: "Mail de postulación — Jack" },
      {
        name: "description",
        content:
          "Revisá el asunto, el cuerpo y el CV adjunto que armó Jack, copiá cada campo o enviá la postulación.",
      },
      { property: "og:title", content: "Mail de postulación — Jack" },
      {
        property: "og:description",
        content: "Postulación personalizada lista para enviar.",
      },
    ],
  }),
  component: DetallePostulacion,
  notFoundComponent: () => (
    <AppShell title="Postulación no encontrada">
      <p className="text-sm text-muted-foreground">
        Esa postulación ya no existe.{" "}
        <Link to="/postulaciones" className="underline">
          Volver al historial
        </Link>
      </p>
    </AppShell>
  ),
});

function DetallePostulacion() {
  const { id } = Route.useParams();
  const { user } = useAuth();

  const fetchUso = useServerFn(getUsoDiario);
  const fetchCvs = useServerFn(listarCvs);
  const fetchPerfil = useServerFn(getMiPerfil);

  const {
    data: app,
    isPending,
    error,
  } = useQuery<AppDetail>({
    queryKey: ["application", id],
    queryFn: () => fetchApplication(id),
  });

  const { data: uso } = useQuery({
    queryKey: ["uso-diario"],
    queryFn: () => fetchUso(),
  });

  const { data: cvs } = useQuery({
    queryKey: ["mis-cvs", id],
    queryFn: () => fetchCvs(),
  });

  const { data: perfil } = useQuery({
    queryKey: ["perfil"],
    queryFn: () => fetchPerfil(),
  });

  /* ─── Estados locales de edición ─── */
  const [asuntoElegido, setAsuntoElegido] = useState<"generico" | "obligatorio">("generico");
  const [cuerpo, setCuerpo] = useState("");
  const [destino, setDestino] = useState("");
  const [cvId, setCvId] = useState("");
  const [firma, setFirma] = useState("");

  /* ─── Sincronizar con datos reales ─── */
  useEffect(() => {
    if (app) {
      setCuerpo(app.generated_body ?? "");
      setDestino(app.destination_email ?? "");
      setCvId(app.resume_id ?? "");
      setAsuntoElegido(app.required_subject ? "obligatorio" : "generico");
    }
  }, [app]);

  useEffect(() => {
    if (perfil) {
      const f = perfil.firmaMail?.trim()
        ? perfil.firmaMail
        : `${perfil.nombre ?? ""}\n${perfil.rubroObjetivo ?? ""}\n${perfil.telefono ?? ""} · ${perfil.email ?? ""}\n${perfil.ubicacion ?? ""}`.trim();
      setFirma(f);
    }
  }, [perfil]);

  /* ─── Mutations ─── */
  const guardar = useMutation({
    mutationFn: () =>
      actualizarApp({
        id,
        generated_body: cuerpo,
        destination_email: destino,
      }),
    onSuccess: () => toast.success("Cambios guardados"),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Error al guardar"),
  });

  const enviar = useMutation({
    mutationFn: () =>
      enviarApp({
        applicationId: id,
        generated_body: cuerpo,
        destination_email: destino,
      }),
    onSuccess: () => toast.success("Postulación enviada"),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Error al enviar"),
  });

  const descartar = useMutation({
    mutationFn: () =>
      cambiarStatus({
        id,
        status: "discarded",
        discard_reason: "Descartada por el usuario.",
      }),
    onSuccess: () => toast.success("Postulación descartada"),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Error al descartar"),
  });

  if (isPending) {
    return (
      <AppShell title="Cargando postulación…">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (error || !app) {
    throw notFound();
  }

  const job = app.job_posts;
  const vencido = estaVencido(job?.closing_at ?? null);
  const enviados = uso?.used_today ?? 0;
  const limite = uso?.limit ?? 2;
  const limiteAlcanzado = app.status !== "sent" && enviados >= limite;
  const asuntoActual =
    asuntoElegido === "obligatorio" && app.required_subject
      ? app.required_subject
      : app.generated_subject;

  return (
    <AppShell
      title={job?.role ?? "Vacante sin título"}
      subtitle={`${job?.employer ?? "Empresa no especificada"} · ${job?.location ?? ""}`}
    >
      {/* ─── Header ─── */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Badge className={estadoStyles[app.status]}>{estadoLabel[app.status]}</Badge>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {enviados} / {limite} mails hoy
        </Badge>
        {vencido ? (
          <Badge variant="outline" className="gap-1">
            <AlertTriangle className="size-3" /> Aviso vencido el{" "}
            {formatearFecha(job?.closing_at ?? null)}
          </Badge>
        ) : job?.closing_at ? (
          <span className="text-xs text-muted-foreground">
            Vigente hasta el {formatearFecha(job.closing_at)}
          </span>
        ) : null}
        <Button variant="ghost" size="sm" asChild className="ml-auto">
          <Link to="/postulaciones">Volver al historial</Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        {/* ─── Panel izquierdo: mail ─── */}
        <section className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-soft">
          {/* Selector de asunto */}
          <div className="space-y-2">
            <Label>Asunto</Label>
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => setAsuntoElegido("generico")}
                className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                  asuntoElegido === "generico"
                    ? "border-primary bg-secondary"
                    : "border-border hover:bg-muted"
                }`}
              >
                <span className="block text-xs text-muted-foreground">Genérico de Jack</span>
                {app.generated_subject}
              </button>
              {app.required_subject ? (
                <button
                  type="button"
                  onClick={() => setAsuntoElegido("obligatorio")}
                  className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                    asuntoElegido === "obligatorio"
                      ? "border-primary bg-secondary"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <span className="block text-xs text-muted-foreground">
                    Asunto exacto que pide el aviso
                  </span>
                  {app.required_subject}
                </button>
              ) : null}
            </div>
          </div>

          <CampoCopiable label="Asunto elegido" value={asuntoActual} fijo />
          <CampoCopiable label="Origen" value={user?.email ?? ""} fijo />
          <CampoCopiable label="Destino" value={destino} onChange={setDestino} />
          <CampoCopiable label="Cuerpo" value={cuerpo} multiline onChange={setCuerpo} />
          <CampoCopiable label="Firma" value={firma} multiline onChange={setFirma} />

          {/* CV adjunto */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Paperclip className="size-3.5" /> CV adjunto
            </Label>
            {cvs && cvs.length > 0 ? (
              <div className="grid gap-2">
                {cvs.map((cv) => (
                  <button
                    key={cv.id}
                    type="button"
                    onClick={() => setCvId(cv.id)}
                    className={`flex items-center justify-between rounded-lg border p-3 text-left text-sm transition-colors ${
                      cvId === cv.id
                        ? "border-primary bg-secondary"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="size-4" />
                      {cv.title}
                    </span>
                    {cvId === cv.id ? <Check className="size-4 text-primary" /> : null}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No tenés CVs guardados.</p>
            )}
          </div>

          {/* Límite alcanzado */}
          {limiteAlcanzado ? (
            <div className="rounded-xl border border-border bg-muted p-4 text-sm">
              <p className="font-medium">Llegaste al límite gratuito de hoy</p>
              <p className="mt-1 text-muted-foreground">
                Podés enviar {limite} postulaciones por día. Mañana se renueva.
              </p>
            </div>
          ) : null}

          {/* Estado enviado / descartado / acciones */}
          {app.status === "sent" ? (
            <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-secondary p-4 text-sm">
              <Check className="size-4 text-primary" />
              Mail enviado el {formatearFecha(app.sent_at)} desde {user?.email ?? "tu cuenta"}.
            </div>
          ) : app.status === "discarded" ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              <p className="font-medium">Postulación descartada</p>
              {app.discard_reason ? <p className="mt-1">{app.discard_reason}</p> : null}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => guardar.mutate()} disabled={guardar.isPending}>
                {guardar.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Guardar cambios
              </Button>
              <Button
                onClick={() => enviar.mutate()}
                disabled={enviar.isPending || limiteAlcanzado}
              >
                <Send className="size-4" /> Enviar postulación
              </Button>
              <Button
                variant="ghost"
                onClick={() => descartar.mutate()}
                disabled={descartar.isPending}
              >
                <Trash2 className="size-4" /> Descartar
              </Button>
            </div>
          )}
        </section>

        {/* ─── Panel derecho: análisis ─── */}
        <section className="h-fit space-y-4 rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-accent" />
            <p className="text-sm font-medium">Análisis de Jack</p>
          </div>

          <div className="rounded-xl border border-border p-4">
            <p className="text-sm font-medium">Datos de la vacante</p>
            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Empresa:</span>{" "}
                {job?.employer ?? "No especificada"}
              </p>
              <p>
                <span className="font-medium text-foreground">Ubicación:</span>{" "}
                {job?.location ?? "No especificada"}
              </p>
              <p>
                <span className="font-medium text-foreground">Fuente:</span>{" "}
                {job?.source_type === "text"
                  ? "Texto pegado"
                  : job?.source_type === "image"
                    ? "Imagen"
                    : "Otro"}
              </p>
            </div>
          </div>

          {job?.extracted_json &&
          typeof job.extracted_json === "object" &&
          Array.isArray(job.extracted_json["requirements_required"]) &&
          (job.extracted_json["requirements_required"] as string[]).length > 0 ? (
            <div className="rounded-xl border border-border p-4">
              <p className="text-sm font-medium">Requisitos detectados</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {(job.extracted_json["requirements_required"] as string[]).map((r, i) => (
                  <li key={i}>• {r}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {vencido ? (
            <div className="rounded-xl border border-border bg-muted p-4 text-sm">
              <p className="font-medium">
                El aviso venció el {formatearFecha(job?.closing_at ?? null)}
              </p>
              <p className="mt-1 text-muted-foreground">
                ¿Querés que lo enviemos igual? Muchas empresas siguen recibiendo CVs.
              </p>
            </div>
          ) : null}

          <div className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
            El cuerpo destaca tu experiencia más relevante para esta vacante. Editá lo que necesites
            antes de enviar.
          </div>
        </section>
      </div>
    </AppShell>
  );
}
