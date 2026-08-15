import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ImageUp, Sparkles, Wand2, AlertTriangle } from "lucide-react";
import { crearPostulacion } from "@/lib/mock-postulaciones";

export const Route = createFileRoute("/postulaciones/nueva")({
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
  const [datos, setDatos] = useState({
    puesto: "Ejecutiva de cuentas corporativas",
    empresa: "Naranja X",
    ubicacion: "Corrientes (híbrido)",
    mailContacto: "seleccion@naranjax.com",
  });

  const extraer = () => setExtraido(true);

  const generar = () => {
    const id = crearPostulacion({
      ...datos,
      fuente: imagen ? "Imagen del aviso" : "Texto pegado",
    });
    void navigate({ to: "/postulaciones/$id", params: { id } });
  };

  return (
    <AppShell
      title="Cargar aviso"
      subtitle="Pegá el texto del aviso o subí una captura. Jack extrae los datos y arma el mail."
    >
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
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
              setImagen(e.dataTransfer.files[0]?.name ?? "captura-aviso.png");
            }}
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              dragging ? "border-primary bg-secondary" : "border-border"
            }`}
          >
            <ImageUp className="size-6 text-muted-foreground" />
            <p className="text-sm font-medium">
              {imagen ?? "Arrastrá una captura del aviso acá"}
            </p>
            <p className="text-xs text-muted-foreground">PNG, JPG o PDF · Jack lee la imagen</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImagen("captura-aviso.png")}
            >
              Seleccionar archivo
            </Button>
          </div>

          <Button onClick={extraer} disabled={!texto && !imagen}>
            <Wand2 className="size-4" /> Extraer datos con Jack
          </Button>
        </section>

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
                    value={datos.puesto}
                    onChange={(e) => setDatos({ ...datos, puesto: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="empresa">Empresa</Label>
                  <Input
                    id="empresa"
                    value={datos.empresa}
                    onChange={(e) => setDatos({ ...datos, empresa: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ubicacion">Ubicación</Label>
                  <Input
                    id="ubicacion"
                    value={datos.ubicacion}
                    onChange={(e) => setDatos({ ...datos, ubicacion: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mail">Mail de contacto</Label>
                  <Input
                    id="mail"
                    value={datos.mailContacto}
                    onChange={(e) => setDatos({ ...datos, mailContacto: e.target.value })}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border p-4">
                <p className="text-sm font-medium">Requisitos excluyentes</p>
                <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                  <li>3+ años en gestión de cuentas — cumplís</li>
                  <li>Manejo de CRM — cumplís</li>
                  <li>Vehículo propio — falta confirmar</li>
                </ul>
              </div>

              <div className="rounded-xl border border-accent/40 bg-accent/10 p-4">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <AlertTriangle className="size-4 text-accent" />
                  Jack necesita una confirmación
                </p>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  El aviso pide vehículo propio. ¿Contás con uno? No lo asumo: según lo que me
                  digas redacto el mail con honestidad y en positivo.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline">
                    Sí, tengo
                  </Button>
                  <Button size="sm" variant="outline">
                    No tengo
                  </Button>
                  <Button size="sm" variant="ghost">
                    Descartar esta vacante
                  </Button>
                </div>
              </div>

              <Badge variant="secondary" className="rounded-full px-3 py-1">
                Aviso vigente hasta el 22/08/2026
              </Badge>

              <Button className="w-full" onClick={generar}>
                <Sparkles className="size-4" /> Generar postulación
              </Button>
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}
