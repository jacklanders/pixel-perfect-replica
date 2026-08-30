import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { FilePlus, Trash2, Copy, Download, Loader2, Upload } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listarCvs, crearCv, borrarCv, duplicarCv, crearCvDesdeUpload } from "@/lib/cv.functions";
import { extraerTextoPdf, extraerTextoDocx, detectarTipoArchivo } from "@/lib/extract";
import { hace } from "@/lib/cv.model";
import { FUNNEL, trackEvent } from "@/lib/observability";

export const Route = createFileRoute("/_authenticated/mis-cv")({
  component: MisCvsPage,
});

const cvsQueryKey = ["mis-cvs"];

function MisCvsPage() {
  const queryClient = useQueryClient();
  const fetchCvs = useServerFn(listarCvs);
  const createCvFn = useServerFn(crearCv);
  const deleteCv = useServerFn(borrarCv);
  const dupCv = useServerFn(duplicarCv);
  const crearDesdeUpload = useServerFn(crearCvDesdeUpload);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: cvs, isPending } = useQuery({
    queryKey: cvsQueryKey,
    queryFn: () => fetchCvs(),
  });

  const crearMutation = useMutation({
    mutationFn: () => createCvFn({ data: { title: "Mi CV" } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cvsQueryKey });
      trackEvent(FUNNEL.crearCv);
      toast.success("CV creado");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Error al crear CV"),
  });

  const borrarMutation = useMutation({
    mutationFn: (id: string) => deleteCv({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cvsQueryKey });
      toast.success("CV eliminado");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Error al eliminar"),
  });

  const duplicarMutation = useMutation({
    mutationFn: (id: string) => dupCv({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cvsQueryKey });
      toast.success("CV duplicado");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Error al duplicar"),
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const tipo = detectarTipoArchivo(file);
    if (!tipo) {
      toast.error("Solo se aceptan archivos .pdf o .docx");
      return;
    }

    setUploading(true);
    try {
      let texto = "";
      if (tipo === "pdf") {
        texto = await extraerTextoPdf(file);
      } else {
        texto = await extraerTextoDocx(file);
      }

      if (texto.length < 50) {
        toast.warning(
          "Extracción incompleta: el archivo parece estar escaneado o protegido. Revisá y completá los datos manualmente.",
        );
      }

      // Convertir a base64
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i] as number);
      }
      const base64 = btoa(binary);

      const nuevoCv = await crearDesdeUpload({
        data: {
          title: file.name.replace(/\.(pdf|docx)$/i, ""),
          extractedText: texto,
          sourceType: tipo === "pdf" ? "uploaded_pdf" : "uploaded_docx",
          fileName: file.name,
          fileBase64: base64,
          mimeType:
            tipo === "pdf"
              ? "application/pdf"
              : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
      });

      queryClient.invalidateQueries({ queryKey: cvsQueryKey });
      toast.success(`CV "${nuevoCv.title}" creado desde ${tipo.toUpperCase()}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al procesar el archivo");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (isPending) {
    return (
      <AppShell title="Mis CVs" subtitle="Cargando…">
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Mis CVs"
      subtitle={
        cvs?.length
          ? `${cvs.length} CV${cvs.length > 1 ? "s" : ""} guardado${cvs.length > 1 ? "s" : ""}`
          : "No tenés CVs todavía."
      }
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold">Tus currículums</h2>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || crearMutation.isPending}
            className="gap-2"
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            Subir CV
          </Button>
          <Button
            onClick={() => crearMutation.mutate()}
            disabled={crearMutation.isPending || uploading}
            className="gap-2"
          >
            {crearMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FilePlus className="size-4" />
            )}
            Crear nuevo
          </Button>
        </div>
      </div>

      {!cvs?.length ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 rounded-2xl border border-border bg-card p-8 shadow-soft">
          <div className="bg-primary/10 flex size-16 items-center justify-center rounded-full">
            <FilePlus className="size-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold">Creá tu primer CV</h3>
          <p className="text-muted-foreground text-center max-w-md">
            Jack te va a ayudar a armarlo, mejorarlo y descargarlo en PDF o Word. También podés
            subir uno que ya tengas.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="gap-2"
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Subir existente
            </Button>
            <Button onClick={() => crearMutation.mutate()} disabled={crearMutation.isPending}>
              {crearMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FilePlus className="size-4" />
              )}
              Crear CV nuevo
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {cvs.map((cv) => (
            <div
              key={cv.id}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <h3 className="font-display truncate text-lg font-bold">{cv.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {cv.contenido.titular || "Sin titular"} · v{cv.version} · {hace(cv.updatedAt)}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {cv.isPrimary && (
                    <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      Principal
                    </span>
                  )}
                  {cv.sourceType === "uploaded_pdf" && (
                    <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      PDF
                    </span>
                  )}
                  {cv.sourceType === "uploaded_docx" && (
                    <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      DOCX
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/cv" search={{ id: cv.id }}>
                    <Download className="mr-1 size-4" /> Editar
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => duplicarMutation.mutate(cv.id)}
                  disabled={duplicarMutation.isPending}
                >
                  <Copy className="mr-1 size-4" /> Duplicar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm("¿Eliminar este CV? No se puede deshacer.")) {
                      borrarMutation.mutate(cv.id);
                    }
                  }}
                  disabled={borrarMutation.isPending}
                >
                  <Trash2 className="mr-1 size-4" /> Eliminar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
