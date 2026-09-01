import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ImageUp, Sparkles, Wand2, AlertTriangle, Loader2, FileText, Check } from "lucide-react";
import {
  analizarVacanteConJack,
  crearVacanteYPostulacion,
} from "@/lib/ai/ai-postulacion.functions";
import { listarCvs } from "@/lib/cv.functions";
import { FUNNEL, trackEvent } from "@/lib/observability";

/* ─── Wrappers tipados: bypass al bug de inferencia de TanStack Start ───
   El runtime espera { data: { ... } } cuando hay middleware+validator.
   V1.168 no infiere esto correctamente en el cliente, así que tipamos
   manualmente y forzamos con 'satisfies'. El servidor sigue validando
   con Zod exactamente igual. */
type AnalizarInput = { raw_text: string };
type CrearInput = {
  role: string;
  company: string;
  location: string | null;
  destination_email: string | null;
  mandatory_subject: string | null;
  raw_text: string;
  source_type: "text" | "image" | "url";
  closing_date: string | null;
  resume_id: string;
  requirements_required: string[];
  requirements_preferred: string[];
  confidence: number;
  source_notes: string;
};
async function analizarVacante(rawText: string, imageBase64?: string, imageMimeType?: string) {
  const textoBase =
    rawText ||
    (imageBase64
      ? "Analizá la imagen adjunta: es un aviso de trabajo. Extraé los datos solicitados."
      : "Extraé los datos de este aviso de trabajo.");
  return analizarVacanteConJack({
    data: {
      raw_text: textoBase,
      ...(imageBase64 ? { image_base64: imageBase64, image_mime_type: imageMimeType } : {}),
    },
  } as unknown as Parameters<typeof analizarVacanteConJack>[0]);
}

async function crearVacante(payload: CrearInput) {
  return crearVacanteYPostulacion({
    data: payload,
  } as unknown as Parameters<typeof crearVacanteYPostulacion>[0]);
}

export const Route = createFileRoute("/_authenticated/postulaciones/nueva")({
  head: () => ({
    meta: [
      { title: "Cargar aviso — Jack" },
      {
        name: "description",
        content:
          "Pegá el texto del aviso o subí una captura: Jack extrae los datos y arma la postulación.",
      },
      { property: "og:title", content: "Cargar aviso — Jack" },
      {
        property: "og:description",
        content: "Jack lee el aviso y prepara tu postulación personalizada.",
      },
    ],
  }),
  component: NuevaPostulacion,
});

const avisoDemo = `Buscamos Ejecutivo/a de cuentas corporativas para Naranja X, Corrientes (híbrido).
Requisitos: 3+ años en gestión de cuentas, manejo de CRM, vehículo propio.
Enviar CV a seleccion@naranjax.com con asunto REF-4471 ECC Corrientes.
Vigencia del aviso: hasta el 22/08/2026.`;

function NuevaPostulacion() {
  const navigate = useNavigate();
  const [texto, setTexto] = useState("");
  const [imagen, setImagen] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [extraido, setExtraido] = useState(false);
  const [imagenFile, setImagenFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [datos, setDatos] = useState({
    role: "",
    company: "",
    location: "",
    destination_email: "",
    mandatory_subject: "",
    closing_date: "",
    confidence: 0,
    source_notes: "",
    requirements_required: [] as string[],
    requirements_preferred: [] as string[],
  });
  const [requisitos, setRequisitos] = useState<string[]>([]);
  const [cvId, setCvId] = useState<string>("");

  const fetchCvs = useServerFn(listarCvs);

  const { data: cvs, isPending: cvsPending } = useQuery({
    queryKey: ["mis-cvs"],
    queryFn: () => fetchCvs(),
  });

  const analizar = useMutation({
    mutationFn: async () => {
      let imageBase64: string | undefined;
      let imageMimeType: string | undefined;

      if (imagenFile) {
        imageBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(imagenFile);
        });
        imageMimeType = imagenFile.type;
      }

      return analizarVacante(texto, imageBase64, imageMimeType);
    },
    onSuccess: (res) => {
      setDatos({
        role: res.role,
        company: res.company,
        location: res.location ?? "",
        destination_email: res.destination_email ?? "",
        mandatory_subject: res.mandatory_subject ?? "",
        closing_date: res.closing_date ?? "",
        confidence: res.confidence,
        source_notes: res.source_notes,
        requirements_required: res.requirements_required,
        requirements_preferred: res.requirements_preferred,
      });
      setRequisitos(res.requirements_required);
      setExtraido(true);
      trackEvent(FUNNEL.extraerDatos, { confidence: res.confidence });
    },
  });

  const crear = useMutation({
    mutationFn: () =>
      crearVacante({
        role: datos.role,
        company: datos.company,
        location: datos.location || null,
        destination_email: datos.destination_email || null,
        mandatory_subject: datos.mandatory_subject || null,
        raw_text: texto,
        source_type: imagen ? "image" : "text",
        closing_date: datos.closing_date || null,
        resume_id: cvId,
        requirements_required: datos.requirements_required,
        requirements_preferred: datos.requirements_preferred,
        confidence: datos.confidence,
        source_notes: datos.source_notes,
      }),
    onSuccess: (res) => {
      trackEvent(FUNNEL.generarPostulacion);
      if (!res.emailGenerado) {
        toast.warning(
          "Se creó la postulación, pero Jack no pudo armar el mail todavía. Podés regenerarlo desde el detalle.",
        );
      }
      void navigate({
        to: "/postulaciones/$id",
        params: { id: res.applicationId },
      });
    },
  });

  const puedeGenerar = extraido && cvId && !crear.isPending;

  return (
    <AppShell
      title="Cargar aviso"
      subtitle="Pegá el texto del aviso o subí una captura. Jack extrae los datos y arma el mail."
    >
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* ─── Panel izquierdo: entrada ─── */}
        <section className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="space-y-2">
            <Label htmlFor="aviso">Texto del aviso</Label>
            <Textarea
              id="aviso"
              rows={8}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Pegá acá el aviso de trabajo…"
            />
            <Button variant="ghost" size="sm" onClick={() => setTexto(avisoDemo)}>
              Usar un aviso de ejemplo
            </Button>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files[0];
              if (file) {
                setImagen(file.name);
                setImagenFile(file);
              }
            }}
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              dragging ? "border-primary bg-secondary" : "border-border"
            }`}
          >
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,application/pdf"
              ref={fileInputRef}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setImagen(file.name);
                  setImagenFile(file);
                }
              }}
            />
            <ImageUp className="size-6 text-muted-foreground" />
            <p className="text-sm font-medium">{imagen ?? "Arrastrá una captura del aviso acá"}</p>
            {imagenFile && (
              <p className="text-xs text-muted-foreground">
                {imagenFile.name} · {(imagenFile.size / 1024).toFixed(0)} KB
              </p>
            )}
            <p className="text-xs text-muted-foreground">PNG, JPG o PDF · Jack lee la imagen</p>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              Seleccionar archivo
            </Button>
          </div>

          <Button
            onClick={() => analizar.mutate()}
            disabled={(!texto && !imagenFile) || analizar.isPending}
          >
            {analizar.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Wand2 className="size-4" />
            )}
            Extraer datos con Jack
          </Button>

          {analizar.isError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {analizar.error instanceof Error
                ? analizar.error.message
                : "Error al analizar el aviso. Intentá de nuevo."}
            </div>
          ) : null}
        </section>

        {/* ─── Panel derecho: datos extraídos ─── */}
        <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-accent" />
            <p className="text-sm font-medium">Datos extraídos por Jack</p>
          </div>

          {!extraido ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Cargá el aviso y Jack completa esta ficha.
            </p>
          ) : (
            <>
              <div className="grid gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="puesto">Puesto</Label>
                  <Input
                    id="puesto"
                    value={datos.role}
                    onChange={(e) => setDatos({ ...datos, role: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="empresa">Empresa</Label>
                  <Input
                    id="empresa"
                    value={datos.company}
                    onChange={(e) => setDatos({ ...datos, company: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ubicacion">Ubicación</Label>
                  <Input
                    id="ubicacion"
                    value={datos.location}
                    onChange={(e) => setDatos({ ...datos, location: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mail">Mail de contacto</Label>
                  <Input
                    id="mail"
                    value={datos.destination_email}
                    onChange={(e) =>
                      setDatos({
                        ...datos,
                        destination_email: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              {requisitos.length > 0 ? (
                <div className="rounded-xl border border-border p-4">
                  <p className="text-sm font-medium">Requisitos detectados</p>
                  <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                    {requisitos.map((r) => (
                      <li key={r}>• {r}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {datos.confidence < 0.7 ? (
                <div className="rounded-xl border border-accent/40 bg-accent/10 p-4">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <AlertTriangle className="size-4 text-accent" />
                    Revisá los datos extraídos
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Jack no está 100% seguro de la extracción. Verificá y corregí antes de
                    continuar.
                  </p>
                </div>
              ) : null}

              {datos.closing_date ? (
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  Aviso vigente hasta el {new Date(datos.closing_date).toLocaleDateString("es-AR")}
                </Badge>
              ) : null}

              {/* Selector de CV */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <FileText className="size-3.5" /> CV para adjuntar
                </Label>
                {cvsPending ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" /> Cargando CVs…
                  </div>
                ) : !cvs || cvs.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                    No tenés CVs guardados.{" "}
                    <Button variant="link" size="sm" asChild className="h-auto p-0">
                      <a href="/cv">Creá uno primero</a>
                    </Button>
                  </div>
                ) : (
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
                )}
              </div>

              <Button className="w-full" onClick={() => crear.mutate()} disabled={!puedeGenerar}>
                {crear.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Generar postulación
              </Button>

              {crear.isError ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                  {crear.error instanceof Error
                    ? crear.error.message
                    : "Error al guardar la postulación. Intentá de nuevo."}
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}
