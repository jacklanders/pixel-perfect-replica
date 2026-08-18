import { createFileRoute, Link, useNavigate, useServerFn } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, FileText, Loader2, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { type Cv } from "@/lib/cv.model";
import { listarMisCvs, crearCv, duplicarCv, eliminarCv } from "@/lib/cv.functions";
import { PERFIL_VACIO } from "@/lib/perfil.model";

export const Route = createFileRoute("/_authenticated/mis-cv")({
  head: () => ({
    meta: [
      { title: "Mis CVs — Jack" },
      { name: "description", content: "Versiones de tu CV. Duplicá, editá y exportá a PDF." },
      { property: "og:title", content: "Mis CVs — Jack" },
      { property: "og:description", content: "Versiones de tu CV. Duplicá, editá y exportá a PDF." },
    ],
  }),
  component: MisCvsPage,
});

const misCvsQueryKey = ["mis-cvs"];

const contenidoInicial = {
  titular: "Resumen profesional",
  perfil: "",
  experiencia: [{ id: "1", puesto: "", empresa: "", detalle: "" }],
};

function MisCvsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fetchList = useServerFn(listarMisCvs);
  const createCv = useServerFn(crearCv);
  const duplicateCv = useServerFn(duplicarCv);
  const deleteCv = useServerFn(eliminarCv);

  const { data: cvs = [], isPending, isError, error } = useQuery({
    queryKey: misCvsQueryKey,
    queryFn: () => fetchList(),
  });

  const [borrando, setBorrando] = useState<string | null>(null);
  const [confirmarId, setConfirmarId] = useState<string | null>(null);

  const crearMutation = useMutation({
    mutationFn: () => createCv({ data: { title: "Nuevo CV", contenido: contenidoInicial } }),
    onSuccess: (cv) => {
      queryClient.invalidateQueries({ queryKey: misCvsQueryKey });
      toast.success("Nuevo CV creado");
      navigate({ to: "/cv", search: { id: cv.id } });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo crear el CV"),
  });

  const duplicarMutation = useMutation({
    mutationFn: (id: string) => duplicateCv({ data: { id } }),
    onSuccess: (cv) => {
      queryClient.invalidateQueries({ queryKey: misCvsQueryKey });
      toast.success("CV duplicado");
      navigate({ to: "/cv", search: { id: cv.id } });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo duplicar"),
  });

  const eliminarMutation = useMutation({
    mutationFn: (id: string) => deleteCv({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: misCvsQueryKey });
      setBorrando(null);
      setConfirmarId(null);
      toast.success("CV eliminado");
    },
    onError: (err) => {
      setBorrando(null);
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar");
    },
  });

  if (isPending) {
    return (
      <AppShell title="Mis CVs" subtitle="Cargando tus versiones guardadas…">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </AppShell>
    );
  }

  if (isError) {
    return (
      <AppShell title="Mis CVs" subtitle="No se pudieron cargar los CVs.">
        <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-soft">
          <p className="text-sm text-destructive">{error?.message ?? "Error"}</p>
          <Button className="mt-4" onClick={() => queryClient.invalidateQueries({ queryKey: misCvsQueryKey })}>
            Reintentar
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Mis CVs" subtitle="Versiones guardadas. Tu versión principal es la que se adjunta por defecto.">
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{cvs.length} versión{cvs.length === 1 ? "" : "es"} guardada</p>
        <Button onClick={() => crearMutation.mutate()} disabled={crearMutation.isPending}>
          {crearMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Nuevo CV
        </Button>
      </div>

      {cvs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <FileText className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-4 font-medium">Aún no tenés CVs guardados</p>
          <p className="text-sm text-muted-foreground">Creá tu primera versión para empezar a postularte.</p>
          <Button className="mt-6" onClick={() => crearMutation.mutate()} disabled={crearMutation.isPending}>
            Crear mi primer CV
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cvs.map((cv) => (
            <CvCard
              key={cv.id}
              cv={cv}
              onDuplicar={() => duplicarMutation.mutate(cv.id)}
              duplicando={duplicarMutation.isPending && duplicarMutation.variables === cv.id}
              onEliminar={() => setConfirmarId(cv.id)}
              eliminando={borrando === cv.id}
            />
          ))}
        </div>
      )}

      <Dialog open={!!confirmarId} onOpenChange={() => setConfirmarId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar CV?</DialogTitle>
            <DialogDescription>Esta acción no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmarId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmarId) {
                  setBorrando(confirmarId);
                  eliminarMutation.mutate(confirmarId);
                }
              }}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function CvCard({
  cv,
  onDuplicar,
  duplicando,
  onEliminar,
  eliminando,
}: {
  cv: Cv;
  onDuplicar: () => void;
  duplicando: boolean;
  onEliminar: () => void;
  eliminando: boolean;
}) {
  return (
    <Card className="group relative flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-soft transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <FileText className="size-5 text-primary" />
          <h3 className="font-display font-bold">{cv.title}</h3>
        </div>
        {cv.isPrimary ? <Badge variant="default">Principal</Badge> : null}
      </div>
      <p className="text-xs text-muted-foreground">{cv.version ? `v${cv.version}` : "v1"} · Actualizado recientemente</p>
      <div className="mt-auto flex items-center gap-2">
        <Button variant="outline" size="sm" className="flex-1" asChild>
          <Link to="/cv" search={{ id: cv.id }}>
            <Pencil className="mr-1 size-3.5" /> Editar
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onDuplicar} disabled={duplicando || eliminando}>
              <Copy className="mr-2 size-4" /> Duplicar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEliminar} disabled={duplicando || eliminando} className="text-destructive">
              <Trash2 className="mr-2 size-4" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}
