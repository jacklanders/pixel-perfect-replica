import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

import { getMiPerfil, guardarPerfil } from "@/lib/perfil.functions";
import { PERFIL_VACIO, completitudPerfil, firmaSugerida, type Perfil } from "@/lib/perfil.model";
import { useAuth, nombreVisible, iniciales } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Tu perfil — Jack" },
      {
        name: "description",
        content:
          "Completá tus datos, rubro, skills y firma de mail para que Jack personalice tu CV y tus postulaciones.",
      },
      { property: "og:title", content: "Tu perfil — Jack" },
      {
        property: "og:description",
        content: "Datos personales, skills y firma de mail reutilizable.",
      },
    ],
  }),
  component: PerfilPage,
});

const perfilQueryKey = ["perfil"];

function PerfilPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const fetchPerfil = useServerFn(getMiPerfil);
  const savePerfil = useServerFn(guardarPerfil);

  const { data, isPending, isError, error } = useQuery({
    queryKey: perfilQueryKey,
    queryFn: () => fetchPerfil(),
  });

  const mutation = useMutation({
    mutationFn: (perfil: Perfil) => savePerfil({ data: perfil as Partial<Perfil> }),
    onSuccess: (perfil) => {
      queryClient.setQueryData(perfilQueryKey, perfil);
      toast.success("Perfil guardado");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar el perfil");
    },
  });

  if (isPending) {
    return (
      <AppShell title="Tu perfil" subtitle="Cargando tus datos…">
        <PerfilSkeleton />
      </AppShell>
    );
  }

  if (isError || !data) {
    return (
      <AppShell title="Tu perfil" subtitle="No se pudieron cargar los datos.">
        <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-soft">
          <p className="text-sm text-destructive">{error?.message ?? "Error desconocido"}</p>
          <Button
            className="mt-4"
            onClick={() => queryClient.invalidateQueries({ queryKey: perfilQueryKey })}
          >
            Reintentar
          </Button>
        </div>
      </AppShell>
    );
  }

  // ← ACA: fuera del return, en el cuerpo de la función
  const perfilNormalizado: Perfil = { ...PERFIL_VACIO, ...data };

  return (
    <AppShell
      title="Tu perfil"
      subtitle="Jack usa estos datos para escribir tu CV y tus postulaciones."
    >
      <PerfilForm
        perfil={perfilNormalizado}
        onSubmit={(p) => mutation.mutate(p)}
        guardando={mutation.isPending}
      />
    </AppShell>
  );
}

function PerfilForm({
  perfil,
  onSubmit,
  guardando,
}: {
  perfil: Perfil;
  onSubmit: (p: Perfil) => void;
  guardando: boolean;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState<Perfil>(perfil);
  const [nuevaSkill, setNuevaSkill] = useState("");

  // Sincroniza si llegan datos nuevos desde la red (p. ej. alta automática en el primer login).
  useEffect(() => {
    setForm(perfil);
  }, [perfil]);

  const completitud = completitudPerfil(form);
  const firma = form.firmaMail.trim() ? form.firmaMail : firmaSugerida(form);
  const name = nombreVisible(user);
  const initials = iniciales(name);

  const update = <K extends keyof Perfil>(key: K, value: Perfil[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const agregarSkill = () => {
    const skill = nuevaSkill.trim();
    if (!skill || form.skills.includes(skill)) return;
    setForm((prev) => ({ ...prev, skills: [...prev.skills, skill] }));
    setNuevaSkill("");
  };

  const quitarSkill = (skill: string) => {
    setForm((prev) => ({ ...prev, skills: prev.skills.filter((s) => s !== skill) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="flex items-center gap-4">
          <Avatar className="size-14">
            <AvatarFallback className="bg-secondary text-secondary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-display text-lg font-bold">{name}</p>
            <p className="text-sm text-muted-foreground">{perfil.email}</p>
          </div>
          <Button variant="outline" size="sm" className="ml-auto" disabled>
            Cambiar foto
          </Button>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre y apellido</Label>
            <Input
              id="nombre"
              value={form.nombre}
              onChange={(e) => update("nombre", e.target.value)}
              maxLength={120}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rubro">Rubro / perfil</Label>
            <Input
              id="rubro"
              value={form.rubroObjetivo}
              onChange={(e) => update("rubroObjetivo", e.target.value)}
              maxLength={160}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tel">Teléfono</Label>
            <Input
              id="tel"
              value={form.telefono}
              onChange={(e) => update("telefono", e.target.value)}
              maxLength={60}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ubicacion">Ubicación</Label>
            <Input
              id="ubicacion"
              value={form.ubicacion}
              onChange={(e) => update("ubicacion", e.target.value)}
              maxLength={120}
            />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <Label htmlFor="resumen">Resumen profesional</Label>
          <Textarea
            id="resumen"
            rows={4}
            value={form.resumen}
            onChange={(e) => update("resumen", e.target.value)}
            maxLength={2000}
          />
        </div>

        <div className="mt-6">
          <Label>Skills</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {form.skills.map((s) => (
              <Badge key={s} variant="secondary" className="rounded-full px-3 py-1">
                {s}
                <button
                  type="button"
                  onClick={() => quitarSkill(s)}
                  className="ml-1.5 inline-flex opacity-60 hover:opacity-100"
                  aria-label={`Quitar ${s}`}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
            <div className="flex items-center gap-1">
              <Input
                value={nuevaSkill}
                onChange={(e) => setNuevaSkill(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    agregarSkill();
                  }
                }}
                placeholder="Agregar skill…"
                className="h-7 w-32 text-xs"
                maxLength={60}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={agregarSkill}
              >
                + agregar
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <Button type="submit" disabled={guardando}>
            {guardando ? <Loader2 className="size-4 animate-spin" /> : null}
            Guardar cambios
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/cv">Ir a mi CV</Link>
          </Button>
        </div>
      </section>

      <div className="space-y-6">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <p className="text-sm font-medium">Perfil completo</p>
          <Progress value={completitud} className="mt-3" />
          <p className="mt-2 text-xs text-muted-foreground">
            {completitud}% —{" "}
            {completitud < 100
              ? "completá lo que falta para mejores sugerencias"
              : "listo para postular"}
          </p>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {["Datos personales", "Skills", "Firma de mail"].map((i) => (
              <li key={i} className="flex items-center gap-2">
                <Check className="size-4 text-primary" />
                {i}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <p className="text-sm font-medium">Firma de mail</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Se reutiliza en todas tus postulaciones.
          </p>
          <Textarea
            value={firma}
            onChange={(e) => update("firmaMail", e.target.value)}
            rows={6}
            className="mt-4 resize-none bg-muted text-sm leading-relaxed"
            maxLength={1000}
          />
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            type="button"
            onClick={() => update("firmaMail", firmaSugerida(form))}
          >
            Restaurar firma sugerida
          </Button>
        </section>
      </div>
    </form>
  );
}

function PerfilSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <section className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="flex items-center gap-4">
          <Skeleton className="size-14 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-32" />
      </section>
      <div className="space-y-6">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-3 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-24" />
        </section>
        <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-4 h-24 w-full" />
        </section>
      </div>
    </div>
  );
}
