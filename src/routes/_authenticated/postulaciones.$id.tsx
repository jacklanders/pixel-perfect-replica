import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
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
} from "lucide-react";
import {
  LIMITE_DIARIO,
  actualizarPostulacion,
  cvsDisponibles,
  estadoLabel,
  firmaMail,
  mailsEnviadosHoy,
  usePostulaciones,
  usuario,
} from "@/lib/mock-postulaciones";

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
        <Input
          id={id}
          value={value}
          readOnly={fijo}
          onChange={(e) => onChange?.(e.target.value)}
        />
      )}
    </div>
  );
}

function DetallePostulacion() {
  const { id } = Route.useParams();
  const postulaciones = usePostulaciones();
  const p = postulaciones.find((x) => x.id === id);
  if (!p) throw notFound();

  const [asunto, setAsunto] = useState<"generico" | "obligatorio">("generico");
  const [cuerpo, setCuerpo] = useState(p.cuerpo);
  const [firma, setFirma] = useState(firmaMail);
  const [cv, setCv] = useState<string>(p.cvAdjunto);
  const [destino, setDestino] = useState(p.mailContacto);
  const [enviado, setEnviado] = useState(p.estado === "enviada");

  const asuntoActual =
    asunto === "obligatorio" && p.asuntoObligatorio ? p.asuntoObligatorio : p.asuntoGenerico;

  const enviados = mailsEnviadosHoy();
  const limiteAlcanzado = !enviado && enviados >= LIMITE_DIARIO;
  const faltaConfirmar = p.requisitos.some((r) => r.cumple === null);
  const noCumple = p.requisitos.filter((r) => r.cumple === false);

  const enviar = () => {
    actualizarPostulacion(p.id, { estado: "enviada", cuerpo, cvAdjunto: cv });
    setEnviado(true);
  };

  return (
    <AppShell title={p.puesto} subtitle={`${p.empresa} · ${p.ubicacion} · ${p.fuente}`}>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Badge>{estadoLabel[p.estado]}</Badge>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {enviados} / {LIMITE_DIARIO} mails hoy
        </Badge>
        {p.vencido ? (
          <Badge variant="outline" className="gap-1">
            <AlertTriangle className="size-3" /> Aviso vencido el {p.vence}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">Vigente hasta el {p.vence}</span>
        )}
        <Button variant="ghost" size="sm" asChild className="ml-auto">
          <Link to="/postulaciones">Volver al historial</Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <section className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="space-y-2">
            <Label>Asunto</Label>
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => setAsunto("generico")}
                className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                  asunto === "generico"
                    ? "border-primary bg-secondary"
                    : "border-border hover:bg-muted"
                }`}
              >
                <span className="block text-xs text-muted-foreground">Genérico de Jack</span>
                {p.asuntoGenerico}
              </button>
              {p.asuntoObligatorio ? (
                <button
                  type="button"
                  onClick={() => setAsunto("obligatorio")}
                  className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                    asunto === "obligatorio"
                      ? "border-primary bg-secondary"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <span className="block text-xs text-muted-foreground">
                    Asunto exacto que pide el aviso
                  </span>
                  {p.asuntoObligatorio}
                </button>
              ) : null}
            </div>
          </div>

          <CampoCopiable label="Asunto elegido" value={asuntoActual} fijo />
          <CampoCopiable label="Origen" value={usuario.mail} fijo />
          <CampoCopiable label="Destino" value={destino} onChange={setDestino} />
          <CampoCopiable label="CCO" value={usuario.mail} fijo />
          <CampoCopiable label="Cuerpo" value={cuerpo} multiline onChange={setCuerpo} />
          <CampoCopiable label="Firma" value={firma} multiline onChange={setFirma} />

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Paperclip className="size-3.5" /> CV adjunto
            </Label>
            <div className="grid gap-2">
              {cvsDisponibles.map((nombre) => (
                <button
                  key={nombre}
                  type="button"
                  onClick={() => setCv(nombre)}
                  className={`flex items-center justify-between rounded-lg border p-3 text-left text-sm transition-colors ${
                    cv === nombre ? "border-primary bg-secondary" : "border-border hover:bg-muted"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <FileText className="size-4" />
                    {nombre}
                  </span>
                  {cv === nombre ? <Check className="size-4 text-primary" /> : null}
                </button>
              ))}
              <Button variant="outline" size="sm">
                Subir otro PDF o Word
              </Button>
            </div>
          </div>

          {limiteAlcanzado ? (
            <div className="rounded-xl border border-border bg-muted p-4 text-sm">
              <p className="font-medium">Llegaste al límite gratuito de hoy</p>
              <p className="mt-1 text-muted-foreground">
                Podés enviar {LIMITE_DIARIO} postulaciones por día. Mañana se renueva, o desbloqueá
                más mirando un aviso.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled>
                  Ver publicidad
                </Button>
                <Button size="sm" variant="outline" disabled>
                  Pasar a plan pago
                </Button>
              </div>
            </div>
          ) : null}

          {enviado ? (
            <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-secondary p-4 text-sm">
              <Check className="size-4 text-primary" />
              Mail enviado desde {usuario.mail} con copia oculta a tu casilla.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button onClick={enviar} disabled={limiteAlcanzado}>
                <Send className="size-4" /> Enviar postulación
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  actualizarPostulacion(p.id, {
                    estado: "descartada",
                    motivo: "Descartada por el usuario.",
                  })
                }
              >
                Descartar
              </Button>
            </div>
          )}
        </section>

        <section className="h-fit space-y-4 rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-accent" />
            <p className="text-sm font-medium">Análisis de Jack</p>
          </div>

          <div className="rounded-xl border border-border p-4">
            <p className="text-sm font-medium">Requisitos excluyentes</p>
            <ul className="mt-2 space-y-2 text-sm">
              {p.requisitos.map((r) => (
                <li key={r.texto} className="flex items-start gap-2">
                  <span
                    className={`mt-1 size-2 shrink-0 rounded-full ${
                      r.cumple === true
                        ? "bg-primary"
                        : r.cumple === false
                          ? "bg-destructive"
                          : "bg-accent"
                    }`}
                  />
                  <span className="text-muted-foreground">
                    {r.texto}
                    {r.cumple === true
                      ? " — cumplís"
                      : r.cumple === false
                        ? " — no cumplís"
                        : " — falta confirmar"}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {noCumple.length > 0 ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <AlertTriangle className="size-4 text-destructive" /> Hay requisitos que no cumplís
              </p>
              <p className="mt-1 text-muted-foreground">
                Redacté el mail siendo honesta con ese punto, pero en positivo. Si preferís, podés
                descartar la vacante.
              </p>
            </div>
          ) : null}

          {faltaConfirmar ? (
            <div className="rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm">
              <p className="font-medium">Necesito una confirmación tuya</p>
              <p className="mt-1 text-muted-foreground">
                Hay un requisito que no puedo deducir de tu perfil. Confirmalo antes de enviar.
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline">
                  Sí
                </Button>
                <Button size="sm" variant="outline">
                  No
                </Button>
              </div>
            </div>
          ) : null}

          {p.vencido ? (
            <div className="rounded-xl border border-border bg-muted p-4 text-sm">
              <p className="font-medium">El aviso venció el {p.vence}</p>
              <p className="mt-1 text-muted-foreground">
                ¿Querés que lo enviemos igual? Muchas empresas siguen recibiendo CVs.
              </p>
            </div>
          ) : null}

          <div className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
            El cuerpo destaca tu experiencia más relevante para esta vacante. Si querés otro
            enfoque, pedime otra versión.
          </div>
          <Button variant="outline" size="sm" className="w-full">
            <Sparkles className="size-4" /> Otra versión del mail
          </Button>
        </section>
      </div>
    </AppShell>
  );
}
