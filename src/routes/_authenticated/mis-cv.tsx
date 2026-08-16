import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Copy, Download, FileText, Plus, Clock, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/mis-cv")({
  component: MisCv,
  head: () => ({
    meta: [
      { title: "Mis CVs | Jack" },
      {
        name: "description",
        content:
          "Gestiona tus versiones de CV, duplica plantillas y exporta en PDF listo para postular.",
      },
      { property: "og:title", content: "Mis CVs | Jack" },
      {
        property: "og:description",
        content: "Gestiona tus versiones de CV y expórtalas en PDF con Jack.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const cvs = [
  {
    id: 1,
    name: "CV general — Product Manager",
    updated: "hace 2 horas",
    score: 86,
    target: "General",
    primary: true,
  },
  {
    id: 2,
    name: "CV adaptado — Fintech Sr. PM",
    updated: "ayer",
    score: 74,
    target: "Mercado Pago",
    primary: false,
  },
  {
    id: 3,
    name: "CV en inglés — Remote PM",
    updated: "hace 5 días",
    score: 68,
    target: "Remoto LatAm",
    primary: false,
  },
];

const templates = [
  { id: "clasica", name: "Clásica", note: "Sobria, ideal para corporativo" },
  { id: "moderna", name: "Moderna", note: "Con acentos de color" },
  { id: "ats", name: "ATS puro", note: "Sin columnas ni gráficos" },
];

function MisCv() {
  const [template, setTemplate] = useState("ats");

  return (
    <AppShell
      title="Mis CVs"
      subtitle="Guarda distintas versiones y exporta la que necesites para cada postulación."
    >
      <div className="mb-6 flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/cv">
            <Plus className="size-4" /> Nuevo CV
          </Link>
        </Button>
      </div>

      <div className="grid gap-4">
        {cvs.map((cv) => (
          <article
            key={cv.id}
            className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-soft"
          >
            <div className="flex size-11 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <FileText className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate font-medium">{cv.name}</h2>
                {cv.primary ? <Badge>Principal</Badge> : null}
                <Badge variant="secondary">{cv.target}</Badge>
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3.5" /> Actualizado {cv.updated} · Puntaje IA {cv.score}/100
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm">
                <Copy className="size-4" /> Duplicar
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/postulaciones/nueva">Usar en postulación</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/cv">Editar</Link>
              </Button>
              <ExportDialog template={template} setTemplate={setTemplate} />
            </div>

          </article>
        ))}
      </div>
    </AppShell>
  );
}

function ExportDialog({
  template,
  setTemplate,
}: {
  template: string;
  setTemplate: (v: string) => void;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm">
          <Download className="size-4" /> Exportar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Exportar CV en PDF</DialogTitle>
          <DialogDescription>
            Elegí una plantilla. Todas son compatibles con lectores automáticos (ATS).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTemplate(t.id)}
              className={`flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                template === t.id
                  ? "border-primary bg-secondary"
                  : "border-border hover:bg-muted"
              }`}
            >
              <span>
                <span className="block text-sm font-medium">{t.name}</span>
                <span className="block text-xs text-muted-foreground">{t.note}</span>
              </span>
              {template === t.id ? <Check className="size-4 text-primary" /> : null}
            </button>
          ))}
        </div>
        <Button className="mt-2 w-full">
          <Download className="size-4" /> Descargar PDF
        </Button>
      </DialogContent>
    </Dialog>
  );
}
