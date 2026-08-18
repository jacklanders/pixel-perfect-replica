import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { useEffect, useState } from "react";
import { Bot, Download, Loader2, MessageSquare, Save, Sparkles } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

import { type Cv } from "@/lib/cv.model";
import { getCvPrimario, getCvById, guardarCv } from "@/lib/cv.functions";
import { getMiPerfil } from "@/lib/perfil.functions";
import { useAuth } from "@/hooks/useAuth";
import { iniciales, nombreVisible } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/cv")({
  validateSearch: (search: Record<string, unknown>) => z.object({ id: z.string().uuid().optional() }).parse(search),
  head: () => ({
    meta: [
      { title: "Editor de CV — Jack" },
      { name: "description", content: "Editá tu CV con Jack. Mejorá el perfil, experiencias y descargá PDF." },
      { property: "og:title", content: "Editor de CV — Jack" },
      { property: "og:description", content: "Editor colaborativo con IA para tu CV." },
    ],
  }),
  component: CvEditorPage,
});

const cvQueryKey = (id: string) => ["cv", id];
const perfilQueryKey = ["perfil"];
const misCvsQueryKey = ["mis-cvs"];

const sugerenciasMock = [
  "Resaltá logros cuantificables en cada experiencia.",
  "Usá verbos de acción al inicio de cada bullet.",
  "Ajustá el perfil al rubro objetivo.",
];

function CvEditorPage() {
  const { id } = useSearch({ from: "/_authenticated/cv" });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();

  const fetchPerfil = useServerFn(getMiPerfil);
  const fetchCv = useServerFn(getCvById);
  const fetchPrimary = useServerFn(getCvPrimario);
  const saveCv = useServerFn(guardarCv);

  const { data: perfil, isPending: perfilPending } = useQuery({
    queryKey: perfilQueryKey,
    queryFn: () => fetchPerfil(),
  });

  const { data: cv, isPending, isError, error } = useQuery({
    queryKey: cvQueryKey(id ?? "primario"),
    queryFn: async () => {
      if (id) return fetchCv({ data: { id } });
      const primario = await fetchPrimary();
      if (primario) return primario;
      // Si no hay principal, se crea automáticamente un CV en blanco.
      // Esto se hace en el cliente para evitar complicar la server fn; en producción
      // se puede mejorar con una transacción server-side.
      return saveCv({
        data: {
          id: "nuevo",
          title: "Mi CV principal",
          contenido: {
            titular: perfil?.rubroObjetivo ? perfil.rubroObjetivo : "Resumen profesional",
            perfil: perfil?.resumen ?? "",
            experiencia: [{ id: "1", puesto: "", empresa: "", detalle: "" }],
          },
        },
      });
    },
  });

  const [form, setForm] = useState<Cv | null>(null);

  useEffect(() => {
    if (cv) setForm(cv);
  }, [cv]);

  const mutation = useMutation({
    mutationFn: (cv: Cv) => saveCv({ data: { id: cv.id, title: cv.title, contenido: cv.contenido } }),
    onSuccess: (updated) => {
      queryClient.setQueryData(cvQueryKey(updated.id), updated);
      queryClient.invalidateQueries({ queryKey: misCvsQueryKey });
      toast.success("CV guardado");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo guardar el CV"),
  });

  const [mensaje, setMensaje] = useState("");
  const [mensajes, setMensajes] = useState<{ de: "jack" | "yo"; texto: string }[]>([
    { de: "jack", texto: "Hola, soy Jack. ¿En qué te ayudo con tu CV hoy?" },
  ]);

  const enviarMensaje = () => {
    if (!mensaje.trim() || !form) return;
    setMensajes((prev) => [...prev, { de: "yo", texto: mensaje }]);
    setTimeout(() => {
      setMensajes((prev) => [
        ...prev,
        { de: "jack", texto: "Buen punto. Podrías reforzar el perfil con logros concretos. ¿Querés que te sugiera un redactado?" },
      ]);
    }, 800);
    setMensaje("");
  };

  if (isPending || perfilPending) {
    return (
      <AppShell title="Editor de CV" subtitle="Cargando…">
        <CvSkeleton />
      </AppShell>
    );
  }

  if (isError || !form) {
    return (
      <AppShell title="Editor de CV" subtitle="No se pudo cargar el CV.">
        <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-soft">
          <p className="text-sm text-destructive">{error?.message ?? "Error desconocido"}</p>
          <div className="mt-4 flex justify-center gap-3">
            <Button onClick={() => queryClient.invalidateQueries({ queryKey: cvQueryKey(id ?? "primario") })}>
              Reintentar
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/mis-cv">Ver mis CVs</Link>
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  const updateContenido = <K extends keyof Cv["contenido"]>(key: K, value: Cv["contenido"][K]) => {
    setForm((prev) => (prev ? { ...prev, contenido: { ...prev.contenido, [key]: value } } : prev));
  };

  const agregarExperiencia = () => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            contenido: {
              ...prev.contenido,
              experiencia: [
                ...prev.contenido.experiencia,
                { id: crypto.randomUUID(), puesto: "", empresa: "", detalle: "" },
              ],
            },
          }
        : prev,
    );
  };

  const updateExperiencia = (idx: number, field: keyof Cv["contenido"]["experiencia"][number], value: string) => {
    setForm((prev) => {
      if (!prev) return prev;
      const exp = [...prev.contenido.experiencia];
      exp[idx] = { ...exp[idx], [field]: value };
      return { ...prev, contenido: { ...prev.contenido, experiencia: exp } };
    });
  };

  const eliminarExperiencia = (idx: number) => {
    setForm((prev) => {
      if (!prev) return prev;
      return { ...prev, contenido: { ...prev.contenido, experiencia: prev.contenido.experiencia.filter((_, i) => i !== idx) } };
    });
  };

  const name = nombreVisible(user);
  const initials = iniciales(name);

  return (
    <AppShell title={form.title} subtitle="Editá el contenido, chateá con Jack y descargá tu PDF.">
      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <Tabs defaultValue="editar" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="editar">Editar</TabsTrigger>
            <TabsTrigger value="vista">Vista previa</TabsTrigger>
          </TabsList>

          <TabsContent value="editar" className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="mb-4">
                <Label htmlFor="titulo">Título del CV</Label>
                <Input
                  id="titulo"
                  value={form.title}
                  onChange={(e) => setForm((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
                  className="mt-1"
                  maxLength={160}
                />
              </div>
              <div className="mb-4">
                <Label htmlFor="titular">Titular / Rubro</Label>
                <Input
                  id="titular"
                  value={form.contenido.titular}
                  onChange={(e) => updateContenido("titular", e.target.value)}
                  className="mt-1"
                  maxLength={200}
                />
              </div>
              <div className="mb-4">
                <Label htmlFor="perfil">Perfil profesional</Label>
                <Textarea
                  id="perfil"
                  value={form.contenido.perfil}
                  onChange={(e) => updateContenido("perfil", e.target.value)}
                  rows={5}
                  className="mt-1"
                  maxLength={3000}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" onClick={() => mutation.mutate(form)} disabled={mutation.isPending}>
                  {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Guardar
                </Button>
                <Button variant="outline" type="button" asChild>
                  <Link to="/mis-cv">Mis CVs</Link>
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-lg font-bold">Experiencia</h3>
                <Button type="button" variant="outline" size="sm" onClick={agregarExperiencia}>
                  + Agregar
                </Button>
              </div>
              <div className="space-y-5">
                {form.contenido.experiencia.map((exp, idx) => (
                  <div key={exp.id} className="rounded-xl border border-border bg-muted/40 p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        placeholder="Puesto"
                        value={exp.puesto}
                        onChange={(e) => updateExperiencia(idx, "puesto", e.target.value)}
                        maxLength={160}
                      />
                      <Input
                        placeholder="Empresa"
                        value={exp.empresa}
                        onChange={(e) => updateExperiencia(idx, "empresa", e.target.value)}
                        maxLength={160}
                      />
                    </div>
                    <Textarea
                      placeholder="Descripción de logros y responsabilidades…"
                      value={exp.detalle}
                      onChange={(e) => updateExperiencia(idx, "detalle", e.target.value)}
                      rows={3}
                      className="mt-3"
                      maxLength={2000}
                    />
                    <div className="mt-2 flex justify-end">
                      <Button type="button" variant="ghost" size="sm" onClick={() => eliminarExperiencia(idx)}>
                        Eliminar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="vista">
            <div className="rounded-2xl border border-border bg-card p-8 shadow-soft">
              <div className="mb-4 border-b border-border pb-4">
                <h2 className="font-display text-2xl font-bold">{name || "Sin nombre"}</h2>
                <p className="text-primary font-medium">{form.contenido.titular}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {user?.email ?? ""} · {perfil?.ubicacion ?? ""} · {perfil?.telefono ?? ""}
                </p>
              </div>
              <div className="mb-6">
                <h3 className="font-display mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">Perfil</h3>
                <p className="whitespace-pre-line text-sm leading-relaxed">{form.contenido.perfil}</p>
              </div>
              <div>
                <h3 className="font-display mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Experiencia</h3>
                <div className="space-y-4">
                  {form.contenido.experiencia.map((exp) => (
                    <div key={exp.id}>
                      <p className="font-bold">{exp.puesto || "Puesto"}</p>
                      <p className="text-sm text-muted-foreground">{exp.empresa || "Empresa"}</p>
                      <p className="mt-1 whitespace-pre-line text-sm">{exp.detalle}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <aside className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="mb-3 flex items-center gap-2">
            <div className="bg-primary flex size-8 items-center justify-center rounded-full">
              <Sparkles className="size-4 text-primary-foreground" />
            </div>
            <h3 className="font-display font-bold">Jack</h3>
          </div>

          <div className="h-96 space-y-3 overflow-y-auto rounded-xl bg-muted p-3">
            {mensajes.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.de === "yo" ? "flex-row-reverse" : ""}`}>
                {m.de === "jack" ? (
                  <div className="bg-primary flex size-7 shrink-0 items-center justify-center rounded-full">
                    <Bot className="size-3.5 text-primary-foreground" />
                  </div>
                ) : (
                  <div className="bg-secondary flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                    {initials}
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    m.de === "yo" ? "bg-primary text-primary-foreground" : "bg-card text-card-foreground"
                  }`}
                >
                  {m.texto}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Sugerencias rápidas</p>
            <div className="flex flex-wrap gap-2">
              {sugerenciasMock.map((s) => (
                <Badge
                  key={s}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                  onClick={() => setMensajes((prev) => [...prev, { de: "jack", texto: s }])}
                >
                  {s}
                </Badge>
              ))}
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <Textarea
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviarMensaje();
                }
              }}
              placeholder="Pedile una mejora a Jack…"
              rows={2}
              className="resize-none text-sm"
            />
            <Button type="button" size="icon" className="shrink-0" onClick={enviarMensaje} disabled={!mensaje.trim()}>
              <MessageSquare className="size-4" />
            </Button>
          </div>

          <Button variant="outline" className="mt-4 w-full" type="button" disabled>
            <Download className="mr-2 size-4" /> Exportar PDF
          </Button>
        </aside>
      </div>
    </AppShell>
  );
}

function CvSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
      <div className="space-y-6">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-3 h-10 w-full" />
          <Skeleton className="mt-4 h-4 w-32" />
          <Skeleton className="mt-3 h-10 w-full" />
          <Skeleton className="mt-4 h-4 w-32" />
          <Skeleton className="mt-3 h-24 w-full" />
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-4 h-32 w-full" />
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-4 h-72 w-full" />
        <Skeleton className="mt-4 h-16 w-full" />
      </div>
    </div>
  );
}
