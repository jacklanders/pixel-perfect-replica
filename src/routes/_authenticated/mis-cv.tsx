import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { FilePlus, Trash2, Copy, Download, Loader2 } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listarCvs, crearCv, borrarCv, duplicarCv } from "@/lib/cv.functions";
import { hace } from "@/lib/cv.model";

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

  const { data: cvs, isPending } = useQuery({
    queryKey: cvsQueryKey,
    queryFn: () => fetchCvs(),
  });

  const crearMutation = useMutation({
    mutationFn: () => createCvFn({ data: { title: "Mi CV" } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cvsQueryKey });
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
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">Tus currículums</h2>
        <Button
          onClick={() => crearMutation.mutate()}
          disabled={crearMutation.isPending}
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

      {!cvs?.length ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 rounded-2xl border border-border bg-card p-8 shadow-soft">
          <div className="bg-primary/10 flex size-16 items-center justify-center rounded-full">
            <FilePlus className="size-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold">Creá tu primer CV</h3>
          <p className="text-muted-foreground text-center max-w-md">
            Jack te va a ayudar a armarlo, mejorarlo y descargarlo en PDF o Word.
          </p>
          <Button onClick={() => crearMutation.mutate()} disabled={crearMutation.isPending}>
            {crearMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FilePlus className="size-4" />
            )}
            Crear CV nuevo
          </Button>
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
                {cv.isPrimary && (
                  <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    Principal
                  </span>
                )}
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
