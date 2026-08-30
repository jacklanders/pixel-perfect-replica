import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Mail,
  Unlink,
  Upload,
} from "lucide-react";
import {
  getApplicationById,
  enviarPostulacion,
  actualizarApplication,
  actualizarApplicationStatus,
  getUsoDiario,
  enviarEmailGmail,
} from "@/lib/application.functions";
import { subirAdjuntoTemporal, borrarAdjuntoTemporal } from "@/lib/attachment.functions";
import { listarCvs } from "@/lib/cv.functions";
import { FUNNEL, trackEvent } from "@/lib/observability";
import { getMiPerfil } from "@/lib/perfil.functions";
import { verificarEstadoGmail, generarGmailAuthUrl, desconectarGmail } from "@/lib/oauth.functions";
import { useAuth } from "@/hooks/useAuth";

/* ─── Wrappers tipados ─── */
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

type SubirAdjuntoInput = {
  fileName: string;
  mimeType: string;
  fileBase64: string;
};

async function subirTemporal(payload: SubirAdjuntoInput) {
  return subirAdjuntoTemporal({
    data: payload,
  } as unknown as Parameters<typeof subirAdjuntoTemporal>[0]);
}

async function borrarTemporal(storagePath: string) {
  return borrarAdjuntoTemporal({
    data: { storagePath },
  } as unknown as Parameters<typeof borrarAdjuntoTemporal>[0]);
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

function formatearBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
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
    trackEvent(FUNNEL.copiar);
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
  const fetchGmailStatus = useServerFn(verificarEstadoGmail);
  const fetchGmailAuthUrl = useServerFn(generarGmailAuthUrl);

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

  const { data: gmailStatus, refetch: refetchGmail } = useQuery({
    queryKey: ["gmail-status"],
    queryFn: () => fetchGmailStatus(),
  });

  /* ─── Estados locales ─── */
  const [asuntoElegido, setAsuntoElegido] = useState<"generico" | "obligatorio">("generico");
  const [cuerpo, setCuerpo] = useState("");
  const [destino, setDestino] = useState("");
  const [jackCvId, setJackCvId] = useState("");
  const [firma, setFirma] = useState("");
  const [includeCopy, setIncludeCopy] = useState(false);
  const [showReconnectDialog, setShowReconnectDialog] = useState(false);
  const [gmailError, setGmailError] = useState<string | null>(null);
  const [adjuntoModo, setAdjuntoModo] = useState<"jack" | "archivo">("jack");
  const [archivoAdjunto, setArchivoAdjunto] = useState<{
    storagePath: string;
    fileName: string;
    mimeType: string;
    size: number;
  } | null>(null);
  const [adjuntoError, setAdjuntoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ─── Sincronizar con datos reales ─── */
  useEffect(() => {
    if (app) {
      setCuerpo(app.generated_body ?? "");
      setDestino(app.destination_email ?? "");
      setAsuntoElegido(app.required_subject ? "obligatorio" : "generico");
      const original = cvs?.find((c) => c.id === app.resume_id);
      if (original?.sourceType === "created_from_scratch") {
        setJackCvId(original.id);
        setAdjuntoModo("jack");
      } else {
        setJackCvId("");
        setAdjuntoModo("jack");
      }
    }
  }, [app, cvs]);

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

  const enviarGmail = useMutation({
    mutationFn: () =>
      enviarEmailGmail({
        data: {
          applicationId: id,
          generated_body: cuerpo,
          destination_email: destino,
          generated_subject: asuntoActual,
          includeCopy,
          ...(adjuntoModo === "archivo" && archivoAdjunto
            ? {
                resumeId: null,
                adjuntoStoragePath: archivoAdjunto.storagePath,
                adjuntoFileName: archivoAdjunto.fileName,
                adjuntoMimeType: archivoAdjunto.mimeType,
              }
            : { resumeId: jackCvId || null }),
        },
      } as unknown as Parameters<typeof enviarEmailGmail>[0]),
    onSuccess: () => {
      trackEvent(FUNNEL.enviarGmail);
      toast.success("Postulación enviada por Gmail");
      setGmailError(null);
      setArchivoAdjunto(null);
      void refetchGmail();
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "Error al enviar por Gmail";
      if (msg.includes("Límite diario")) {
        trackEvent(FUNNEL.limiteDiario);
      }
      setGmailError(msg);
      void refetchGmail();
      if (msg.includes("401") || msg.includes("Token expirado") || msg.includes("refresh")) {
        setShowReconnectDialog(true);
      } else {
        toast.error(msg);
      }
    },
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

  const desconectar = useMutation({
    mutationFn: () =>
      desconectarGmail({
        data: undefined,
      } as unknown as Parameters<typeof desconectarGmail>[0]),
    onSuccess: () => {
      toast.success("Gmail desconectado");
      void refetchGmail();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Error al desconectar"),
  });

  /* ─── Subir adjunto temporal (PDF/DOCX) ─── */
  const subirAdjunto = useMutation({
    mutationFn: async (file: File) => {
      const MAX_BYTES = 10 * 1024 * 1024;
      if (file.size > MAX_BYTES) {
        throw new Error("El archivo excede el límite de 10MB. Elegí un PDF o DOCX más liviano.");
      }
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (ext !== "pdf" && ext !== "docx") {
        throw new Error("Solo se admiten archivos PDF o DOCX.");
      }
      const mimeType =
        ext === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]!);
      }
      const fileBase64 = btoa(binary);

      return subirTemporal({ fileName: file.name, mimeType, fileBase64 });
    },
    onSuccess: (res) => {
      setArchivoAdjunto(res);
      setAdjuntoError(null);
      toast.success("Archivo listo para adjuntar");
    },
    onError: (err) => {
      setArchivoAdjunto(null);
      setAdjuntoError(err instanceof Error ? err.message : "No se pudo subir el adjunto");
    },
  });

  /* ─── Cambiar de opción de adjunto (limpia archivo temporal si se reemplaza) ─── */
  const cambiarModoAdjunto = (modo: "jack" | "archivo") => {
    setAdjuntoModo(modo);
    setAdjuntoError(null);
    if (modo === "jack" && archivoAdjunto) {
      void borrarTemporal(archivoAdjunto.storagePath).catch(() => {});
      setArchivoAdjunto(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /* ─── Conectar Gmail ─── */
  const conectarGmail = async () => {
    try {
      const { url, state } = await fetchGmailAuthUrl();
      sessionStorage.setItem("gmail_oauth_state", state);
      window.location.href = url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al iniciar conexión con Gmail");
    }
  };

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
    return (
      <AppShell title="Postulación no encontrada">
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <p>No se pudo cargar la postulación ({id}).</p>
          <p className="mt-1 font-mono text-xs break-all">
            {error instanceof Error ? error.message : String(error ?? "Sin resultados")}
          </p>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          <Link to="/postulaciones" className="underline">
            Volver al historial
          </Link>
        </p>
      </AppShell>
    );
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

  const isGmailConnected = gmailStatus?.connected ?? false;
  const isSending =
    enviar.isPending || enviarGmail.isPending || guardar.isPending || subirAdjunto.isPending;

  /* ─── Adjunto: derivados ─── */
  const cvsJack = cvs?.filter((c) => c.sourceType === "created_from_scratch") ?? [];
  const adjuntoJack = cvsJack.find((c) => c.id === jackCvId);
  const adjuntoListo =
    adjuntoModo === "jack"
      ? jackCvId.length > 0
      : archivoAdjunto !== null && adjuntoError === null && !subirAdjunto.isPending;

  /* ─── Copiar todo ─── */
  const copiarTodo = () => {
    const bloque = `PARA: ${destino}\nASUNTO: ${asuntoActual}\n\n${cuerpo}\n\n--\n${firma}`;
    void navigator.clipboard?.writeText(bloque);
    trackEvent(FUNNEL.copiar, { origen: "todo" });
    toast.success("Todo copiado al portapapeles");
  };

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

          {/* Botón Copiar todo */}
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={copiarTodo}>
              <Copy className="size-3.5 mr-1" /> Copiar todo
            </Button>
          </div>

          {/* Adjunto */}
          <div className="space-y-3">
            <Label className="flex items-center gap-1.5">
              <Paperclip className="size-3.5" /> Adjunto
            </Label>

            {/* Selector de modo */}
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => cambiarModoAdjunto("jack")}
                className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                  adjuntoModo === "jack"
                    ? "border-primary bg-secondary"
                    : "border-border hover:bg-muted"
                }`}
              >
                <span className="flex items-center gap-2 font-medium">
                  <Sparkles className="size-4 text-accent" /> Usar mi CV de Jack
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Generamos el PDF de tu CV al enviar
                </span>
              </button>
              <button
                type="button"
                onClick={() => cambiarModoAdjunto("archivo")}
                className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                  adjuntoModo === "archivo"
                    ? "border-primary bg-secondary"
                    : "border-border hover:bg-muted"
                }`}
              >
                <span className="flex items-center gap-2 font-medium">
                  <Upload className="size-4" /> Subir archivo
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  PDF o DOCX desde tu disco (máx. 10MB)
                </span>
              </button>
            </div>

            {/* Opción A: CV de Jack */}
            {adjuntoModo === "jack" ? (
              cvsJack.length > 0 ? (
                <div className="grid gap-2">
                  {cvsJack.map((cv) => (
                    <button
                      key={cv.id}
                      type="button"
                      onClick={() => setJackCvId(cv.id)}
                      className={`flex items-center justify-between rounded-lg border p-3 text-left text-sm transition-colors ${
                        jackCvId === cv.id
                          ? "border-primary bg-secondary"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <FileText className="size-4" />
                        {cv.title}
                      </span>
                      {jackCvId === cv.id ? <Check className="size-4 text-primary" /> : null}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No tenés CVs generados por Jack.{" "}
                  <Link to="/cv" className="underline">
                    Creá uno primero
                  </Link>{" "}
                  o subí un archivo.
                </p>
              )
            ) : (
              /* ─── Opción B: subir archivo ─── */
              <div className="space-y-3">
                {archivoAdjunto ? (
                  <div className="flex items-center justify-between rounded-lg border border-primary/40 bg-secondary p-3 text-sm">
                    <span className="flex items-center gap-2">
                      <FileText className="size-4 text-primary" />
                      <span className="font-medium">{archivoAdjunto.fileName}</span>
                      <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs">
                        {formatearBytes(archivoAdjunto.size)}
                      </Badge>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        void borrarTemporal(archivoAdjunto.storagePath).catch(() => {});
                        setArchivoAdjunto(null);
                        setAdjuntoError(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      <Trash2 className="size-3.5" /> Quitar
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) subirAdjunto.mutate(file);
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={subirAdjunto.isPending}
                    >
                      {subirAdjunto.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Upload className="size-4" />
                      )}
                      Seleccionar PDF o DOCX
                    </Button>
                    {subirAdjunto.isPending ? (
                      <span className="text-xs text-muted-foreground">Subiendo archivo…</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Se adjunta tal cual, sin procesamiento.
                      </span>
                    )}
                  </div>
                )}

                {adjuntoError ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    {adjuntoError}
                  </div>
                ) : null}
              </div>
            )}

            {/* Resumen del adjunto elegido */}
            {adjuntoListo ? (
              <p className="text-xs text-muted-foreground">
                {adjuntoModo === "jack"
                  ? `Adjuntando: ${adjuntoJack?.title ?? "CV"} · PDF generado por Jack`
                  : `Adjuntando: ${archivoAdjunto?.fileName} · ${formatearBytes(archivoAdjunto?.size ?? 0)}`}
              </p>
            ) : null}
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

          {/* Gmail error */}
          {gmailError && !showReconnectDialog ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              <p className="font-medium">Error al enviar por Gmail</p>
              <p className="mt-1">{gmailError}</p>
              <p className="mt-2 text-muted-foreground">
                Usá los botones de copiar como alternativa.
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
            <div className="space-y-4">
              {/* Checkbox enviarme copia */}
              {isGmailConnected ? (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-copy"
                    checked={includeCopy}
                    onCheckedChange={(v) => setIncludeCopy(v === true)}
                  />
                  <Label htmlFor="include-copy" className="text-sm font-normal cursor-pointer">
                    Enviarme copia (CCO)
                  </Label>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => guardar.mutate()} disabled={isSending}>
                  {guardar.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Guardar cambios
                </Button>

                {/* Enviar desde Gmail */}
                {isGmailConnected ? (
                  <Button
                    onClick={() => enviarGmail.mutate()}
                    disabled={isSending || limiteAlcanzado || !adjuntoListo}
                    title={!adjuntoListo ? "Elegí un CV o subí un archivo adjunto" : undefined}
                  >
                    {enviarGmail.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Mail className="size-4" />
                    )}
                    Enviar desde Gmail
                  </Button>
                ) : (
                  <Button variant="outline" onClick={conectarGmail} disabled={isSending}>
                    <Mail className="size-4" /> Conectar Gmail para enviar
                  </Button>
                )}

                <Button variant="ghost" onClick={() => descartar.mutate()} disabled={isSending}>
                  <Trash2 className="size-4" /> Descartar
                </Button>
              </div>

              {/* Desconectar Gmail (solo si conectado) */}
              {isGmailConnected ? (
                <Button
                  variant="link"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => desconectar.mutate()}
                  disabled={desconectar.isPending}
                >
                  <Unlink className="size-3 mr-1" />
                  Desconectar Gmail
                </Button>
              ) : null}
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

      {/* ─── Dialog: Reconectar Gmail ─── */}
      <Dialog open={showReconnectDialog} onOpenChange={setShowReconnectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reconectar Gmail</DialogTitle>
            <DialogDescription>
              Tu autorización con Gmail expiró o fue revocada. Volvé a conectar tu cuenta para
              seguir enviando postulaciones directamente.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-2">
            <Button onClick={conectarGmail}>
              <Mail className="size-4 mr-2" /> Reconectar Gmail
            </Button>
            <Button variant="outline" onClick={() => setShowReconnectDialog(false)}>
              Cancelar — usar copiar/pegar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
