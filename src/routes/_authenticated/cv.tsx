import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { useEffect, useState } from "react";
import {
  Bot,
  Download,
  Loader2,
  MessageSquare,
  Save,
  Sparkles,
  FilePlus,
  FileText,
} from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { type Cv } from "@/lib/cv.model";
import { getCvPrimario, getCvById, guardarCv, crearCv } from "@/lib/cv.functions";
import { mejorarCvConJack } from "@/lib/ai/ai.functions";
import { getMiPerfil } from "@/lib/perfil.functions";
import { useAuth } from "@/hooks/useAuth";
import { iniciales, nombreVisible } from "@/hooks/useAuth";
import { CvDiff } from "@/components/cv-diff";
import { PLANTILLAS_CV } from "@/lib/cv-pdf-core";

export const Route = createFileRoute("/_authenticated/cv")({
  validateSearch: (search: Record<string, unknown>) =>
    z.object({ id: z.string().optional() }).parse(search),
  head: () => ({
    meta: [
      { title: "Editor de CV — Jack" },
      {
        name: "description",
        content: "Editá tu CV con Jack. Mejorá el perfil, experiencias y descargá PDF.",
      },
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
  "Mejorá mi perfil profesional",
  "Reforzá mis experiencias con logros",
  "Hacé mi CV más breve y claro",
];

function CvEditorPage() {
  const search = useSearch({ from: "/_authenticated/cv" });
  const rawId = search.id;
  const id = rawId && rawId.trim() !== "" ? rawId : undefined;

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();

  const fetchPerfil = useServerFn(getMiPerfil);
  const fetchCv = useServerFn(getCvById);
  const fetchPrimary = useServerFn(getCvPrimario);
  const saveCv = useServerFn(guardarCv);
  const createCvFn = useServerFn(crearCv);
  const mejorarCv = useServerFn(mejorarCvConJack);

  const { data: perfil, isPending: perfilPending } = useQuery({
    queryKey: perfilQueryKey,
    queryFn: () => fetchPerfil(),
  });

  const {
    data: cv,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: cvQueryKey(id ?? "primario"),
    queryFn: async () => {
      if (id) return fetchCv({ data: { id } });
      const primario = await fetchPrimary();
      if (primario) return primario;
      return null;
    },
  });

  const [form, setForm] = useState<Cv | null>(null);
  const [creando, setCreando] = useState(false);
  const [jackLoading, setJackLoading] = useState(false);
  const [mejora, setMejora] = useState<{
    mejorado: Cv["contenido"];
    cambios: Array<{ campo: string; antes: string; despues: string; razon: string }>;
    preguntas: string[];
  } | null>(null);
  const [aplicandoMejora, setAplicandoMejora] = useState(false);

  useEffect(() => {
    if (cv) setForm(cv);
  }, [cv]);

  const crearCvNuevo = async () => {
    if (!perfil) return;
    setCreando(true);
    try {
      const nuevoCv = await createCvFn({ data: { title: "Mi CV principal" } });
      if (nuevoCv) {
        const cvConContenido: Cv = {
          ...nuevoCv,
          contenido: {
            titular: perfil?.rubroObjetivo ? perfil.rubroObjetivo : "Resumen profesional",
            perfil: "",
            experiencia: [{ id: crypto.randomUUID(), puesto: "", empresa: "", detalle: "" }],
            educacion: [],
            habilidades: [],
          },
        };
        await saveCv({
          data: {
            id: cvConContenido.id,
            title: cvConContenido.title,
            contenido: cvConContenido.contenido,
          },
        });
        queryClient.setQueryData(cvQueryKey(nuevoCv.id), cvConContenido);
        queryClient.invalidateQueries({ queryKey: misCvsQueryKey });
        toast.success("CV creado");
        navigate({ to: "/cv", search: { id: nuevoCv.id } });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear el CV");
    } finally {
      setCreando(false);
    }
  };

  const mutation = useMutation({
    mutationFn: (cv: Cv) =>
      saveCv({ data: { id: cv.id, title: cv.title, contenido: cv.contenido } }),
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

  const enviarMensaje = async () => {
    if (!mensaje.trim() || !form || jackLoading) return;
    const texto = mensaje.trim();
    setMensajes((prev) => [...prev, { de: "yo", texto }]);
    setMensaje("");
    setJackLoading(true);
    setMejora(null);

    try {
      const resultado = await mejorarCv({
        data: { cvId: form.id, mensajeUsuario: texto },
      });

      setMensajes((prev) => [
        ...prev,
        {
          de: "jack",
          texto: `Analicé tu CV. Tengo ${resultado.cambios.length} sugerencia${
            resultado.cambios.length !== 1 ? "s" : ""
          }${
            resultado.preguntas.length
              ? ` y ${resultado.preguntas.length} pregunta${resultado.preguntas.length !== 1 ? "s" : ""}`
              : ""
          }. Revisá los cambios abajo y confirmá si los querés aplicar.`,
        },
      ]);
      setMejora(resultado);
    } catch (err) {
      setMensajes((prev) => [
        ...prev,
        {
          de: "jack",
          texto:
            err instanceof Error ? err.message : "No pude procesar tu solicitud. Probá de nuevo.",
        },
      ]);
    } finally {
      setJackLoading(false);
    }
  };

  const aplicarMejora = async () => {
    if (!form || !mejora) return;
    setAplicandoMejora(true);
    try {
      const nuevoCv = await createCvFn({ data: { title: `${form.title} (mejorado)` } });
      await saveCv({
        data: {
          id: nuevoCv.id,
          title: nuevoCv.title,
          contenido: mejora.mejorado,
        },
      });
      toast.success("CV mejorado creado como nueva versión");
      setMejora(null);
      queryClient.invalidateQueries({ queryKey: misCvsQueryKey });
      navigate({ to: "/cv", search: { id: nuevoCv.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al aplicar cambios");
    } finally {
      setAplicandoMejora(false);
    }
  };

  if (isPending || perfilPending) {
    return (
      <AppShell title="Editor de CV" subtitle="Cargando…">
        <CvSkeleton />
      </AppShell>
    );
  }

  if (isError) {
    return (
      <AppShell title="Editor de CV" subtitle="No se pudo cargar el CV.">
        <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-soft">
          <p className="text-sm text-destructive">{error?.message ?? "Error desconocido"}</p>
          <div className="mt-4 flex justify-center gap-3">
            <Button
              onClick={() =>
                queryClient.invalidateQueries({ queryKey: cvQueryKey(id ?? "primario") })
              }
            >
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

  if (!cv) {
    return (
      <AppShell title="Editor de CV" subtitle="No tenés un CV todavía.">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <div className="bg-primary/10 flex size-16 items-center justify-center rounded-full">
            <FilePlus className="size-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold">Creá tu primer CV</h2>
          <p className="text-muted-foreground text-center max-w-md">
            Jack te va a ayudar a armarlo, mejorarlo y descargarlo en PDF o Word.
          </p>
          <div className="flex gap-3">
            <Button onClick={crearCvNuevo} disabled={creando} className="gap-2">
              {creando ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FilePlus className="size-4" />
              )}
              Crear CV nuevo
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/mis-cv">Ver mis CVs</Link>
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!form) {
    return (
      <AppShell title="Editor de CV" subtitle="Cargando…">
        <CvSkeleton />
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

  const updateExperiencia = (
    idx: number,
    field: keyof Cv["contenido"]["experiencia"][number],
    value: string | boolean | undefined,
  ) => {
    setForm((prev) => {
      if (!prev) return prev;
      const exp = prev.contenido.experiencia.map((item, i) =>
        i === idx ? ({ ...item, [field]: value } as Cv["contenido"]["experiencia"][number]) : item,
      );
      return { ...prev, contenido: { ...prev.contenido, experiencia: exp } };
    });
  };

  const toggleActualmente = (idx: number) => {
    setForm((prev) => {
      if (!prev) return prev;
      const exp = prev.contenido.experiencia.map((item, i) =>
        i === idx
          ? ({
              ...item,
              actualmente: !(item.actualmente ?? false),
              fechaFin: item.actualmente ? item.fechaFin : undefined,
            } as Cv["contenido"]["experiencia"][number])
          : item,
      );
      return { ...prev, contenido: { ...prev.contenido, experiencia: exp } };
    });
  };

  const eliminarExperiencia = (idx: number) => {
    setForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        contenido: {
          ...prev.contenido,
          experiencia: prev.contenido.experiencia.filter((_, i) => i !== idx),
        },
      };
    });
  };

  const agregarEducacion = () => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            contenido: {
              ...prev.contenido,
              educacion: [
                ...prev.contenido.educacion,
                { institucion: "", titulo: "", nivel: "", anioFin: "", ubicacion: "" },
              ],
            },
          }
        : prev,
    );
  };

  const updateEducacion = (
    idx: number,
    field: keyof Cv["contenido"]["educacion"][number],
    value: string,
  ) => {
    setForm((prev) => {
      if (!prev) return prev;
      const edu = prev.contenido.educacion.map((item, i) =>
        i === idx ? ({ ...item, [field]: value } as Cv["contenido"]["educacion"][number]) : item,
      );
      return { ...prev, contenido: { ...prev.contenido, educacion: edu } };
    });
  };

  const eliminarEducacion = (idx: number) => {
    setForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        contenido: {
          ...prev.contenido,
          educacion: prev.contenido.educacion.filter((_, i) => i !== idx),
        },
      };
    });
  };

  const agregarCategoriaHabilidad = () => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            contenido: {
              ...prev.contenido,
              habilidades: [...prev.contenido.habilidades, { categoria: "", items: [] }],
            },
          }
        : prev,
    );
  };

  const updateHabilidad = (idx: number, field: "categoria" | "items", value: string) => {
    setForm((prev) => {
      if (!prev) return prev;
      const hab = prev.contenido.habilidades.map((item, i) => {
        if (i !== idx) return item;
        if (field === "items") {
          return {
            ...item,
            items: value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          };
        }
        return { ...item, categoria: value };
      });
      return { ...prev, contenido: { ...prev.contenido, habilidades: hab } };
    });
  };

  const eliminarHabilidad = (idx: number) => {
    setForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        contenido: {
          ...prev.contenido,
          habilidades: prev.contenido.habilidades.filter((_, i) => i !== idx),
        },
      };
    });
  };

  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setForm((prev) =>
        prev ? { ...prev, contenido: { ...prev.contenido, fotoBase64: dataUrl } } : prev,
      );
    };
    reader.readAsDataURL(file);
  };

  const quitarFoto = () => {
    setForm((prev) =>
      prev ? { ...prev, contenido: { ...prev.contenido, fotoBase64: undefined } } : prev,
    );
  };

  const name = nombreVisible(user);
  const initials = iniciales(name);

  const esUpload = cv.sourceType === "uploaded_pdf" || cv.sourceType === "uploaded_docx";

  return (
    <AppShell title={form.title} subtitle="Editá el contenido, chateá con Jack y descargá tu PDF.">
      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <Tabs defaultValue="editar" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="editar">Editar</TabsTrigger>
            <TabsTrigger value="vista">Vista previa</TabsTrigger>
          </TabsList>

          <TabsContent value="editar" className="space-y-6">
            {esUpload && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                <p className="font-medium">CV extraído de archivo</p>
                <p className="mt-1 text-xs">
                  Revisá que los datos estén correctos. Si la extracción fue incompleta, completá
                  manualmente lo que falte.
                </p>
              </div>
            )}

            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="mb-4">
                <Label htmlFor="titulo">Título del CV</Label>
                <Input
                  id="titulo"
                  value={form.title}
                  onChange={(e) =>
                    setForm((prev) => (prev ? { ...prev, title: e.target.value } : prev))
                  }
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
              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="plantilla">Plantilla de exportación</Label>
                  <Select
                    value={form.contenido.plantilla ?? "clasica"}
                    onValueChange={(value) =>
                      updateContenido("plantilla", value as "clasica" | "moderna")
                    }
                  >
                    <SelectTrigger id="plantilla" className="mt-1">
                      <SelectValue placeholder="Elegí una plantilla" />
                    </SelectTrigger>
                    <SelectContent>
                      {PLANTILLAS_CV.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p === "clasica" ? "Clásica" : "Moderna"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="foto">Foto del CV</Label>
                  <div className="mt-1 flex items-center gap-3">
                    {form.contenido.fotoBase64 ? (
                      <>
                        <img
                          src={form.contenido.fotoBase64}
                          alt="Foto del CV"
                          className="size-16 rounded-full border border-border object-cover"
                        />
                        <Button type="button" variant="ghost" size="sm" onClick={quitarFoto}>
                          Quitar foto
                        </Button>
                      </>
                    ) : (
                      <div className="flex w-full items-center gap-2">
                        <Input
                          id="foto"
                          type="file"
                          accept="image/jpeg,image/png"
                          onChange={handleFoto}
                          className="file:text-muted-foreground"
                        />
                        <p className="text-xs text-muted-foreground">JPG o PNG</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={() => mutation.mutate(form)}
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
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
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div>
                        <Label
                          htmlFor={`exp-inicio-${exp.id}`}
                          className="mb-1 block text-xs text-muted-foreground"
                        >
                          Inicio
                        </Label>
                        <Input
                          id={`exp-inicio-${exp.id}`}
                          type="month"
                          value={exp.fechaInicio ?? ""}
                          onChange={(e) =>
                            updateExperiencia(idx, "fechaInicio", e.target.value || undefined)
                          }
                        />
                      </div>
                      <div>
                        <Label
                          htmlFor={`exp-fin-${exp.id}`}
                          className="mb-1 block text-xs text-muted-foreground"
                        >
                          Fin
                        </Label>
                        <Input
                          id={`exp-fin-${exp.id}`}
                          type="month"
                          value={exp.fechaFin ?? ""}
                          onChange={(e) =>
                            updateExperiencia(idx, "fechaFin", e.target.value || undefined)
                          }
                          disabled={exp.actualmente ?? false}
                        />
                      </div>
                      <div className="flex items-end pb-1">
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={exp.actualmente ?? false}
                            onCheckedChange={() => toggleActualmente(idx)}
                          />
                          Trabajo acá actualmente
                        </label>
                      </div>
                    </div>
                    <Input
                      className="mt-3"
                      placeholder="Ubicación (opcional)"
                      value={exp.ubicacion ?? ""}
                      onChange={(e) =>
                        updateExperiencia(idx, "ubicacion", e.target.value || undefined)
                      }
                      maxLength={160}
                    />
                    <Textarea
                      placeholder="Descripción de logros y responsabilidades…"
                      value={exp.detalle}
                      onChange={(e) => updateExperiencia(idx, "detalle", e.target.value)}
                      rows={3}
                      className="mt-3"
                      maxLength={2000}
                    />
                    <div className="mt-2 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => eliminarExperiencia(idx)}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-lg font-bold">Educación</h3>
                <Button type="button" variant="outline" size="sm" onClick={agregarEducacion}>
                  + Agregar
                </Button>
              </div>
              <div className="space-y-5">
                {form.contenido.educacion.map((edu, idx) => (
                  <div key={idx} className="rounded-xl border border-border bg-muted/40 p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        placeholder="Institución"
                        value={edu.institucion}
                        onChange={(e) => updateEducacion(idx, "institucion", e.target.value)}
                        maxLength={160}
                      />
                      <Input
                        placeholder="Título / carrera"
                        value={edu.titulo}
                        onChange={(e) => updateEducacion(idx, "titulo", e.target.value)}
                        maxLength={200}
                      />
                      <Input
                        placeholder="Nivel (ej: universitario)"
                        value={edu.nivel ?? ""}
                        onChange={(e) => updateEducacion(idx, "nivel", e.target.value)}
                        maxLength={80}
                      />
                      <Input
                        placeholder="Año de finalización (o en curso)"
                        value={edu.anioFin ?? ""}
                        onChange={(e) => updateEducacion(idx, "anioFin", e.target.value)}
                        maxLength={40}
                      />
                      <Input
                        className="sm:col-span-2"
                        placeholder="Ubicación (opcional)"
                        value={edu.ubicacion ?? ""}
                        onChange={(e) => updateEducacion(idx, "ubicacion", e.target.value)}
                        maxLength={160}
                      />
                    </div>
                    <div className="mt-2 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => eliminarEducacion(idx)}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-lg font-bold">Habilidades</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={agregarCategoriaHabilidad}
                >
                  + Agregar categoría
                </Button>
              </div>
              <div className="space-y-5">
                {form.contenido.habilidades.map((hab, idx) => (
                  <div key={idx} className="rounded-xl border border-border bg-muted/40 p-4">
                    <Input
                      placeholder="Categoría (ej: Herramientas, Idiomas)"
                      value={hab.categoria}
                      onChange={(e) => updateHabilidad(idx, "categoria", e.target.value)}
                      maxLength={80}
                    />
                    <Textarea
                      className="mt-3"
                      placeholder="Habilidades separadas por coma (ej: Figma, Photoshop, Illustrator)"
                      value={hab.items.join(", ")}
                      onChange={(e) => updateHabilidad(idx, "items", e.target.value)}
                      rows={2}
                      maxLength={1000}
                    />
                    <div className="mt-2 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => eliminarHabilidad(idx)}
                      >
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
              <div className="mb-4 flex items-start gap-4 border-b border-border pb-4">
                {form.contenido.fotoBase64 && (
                  <img
                    src={form.contenido.fotoBase64}
                    alt="Foto"
                    className="size-20 shrink-0 rounded-full border border-border object-cover"
                  />
                )}
                <div>
                  <h2 className="font-display text-2xl font-bold">{name || "Sin nombre"}</h2>
                  <p className="text-primary font-medium">{form.contenido.titular}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {user?.email ?? ""} · {perfil?.ubicacion ?? ""} · {perfil?.telefono ?? ""}
                  </p>
                </div>
              </div>
              <div className="mb-6">
                <h3 className="font-display mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  Perfil
                </h3>
                <p className="whitespace-pre-line text-sm leading-relaxed">
                  {form.contenido.perfil}
                </p>
              </div>
              <div className="mb-6">
                <h3 className="font-display mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  Experiencia
                </h3>
                <div className="space-y-4">
                  {form.contenido.experiencia.map((exp) => (
                    <div key={exp.id}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-bold">{exp.puesto || "Puesto"}</p>
                        {formatPeriodo(exp.fechaInicio, exp.fechaFin, exp.actualmente) && (
                          <p className="text-xs text-muted-foreground">
                            {formatPeriodo(exp.fechaInicio, exp.fechaFin, exp.actualmente)}
                          </p>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {exp.empresa || "Empresa"}
                        {exp.ubicacion ? ` · ${exp.ubicacion}` : ""}
                      </p>
                      <p className="mt-1 whitespace-pre-line text-sm">{exp.detalle}</p>
                    </div>
                  ))}
                </div>
              </div>
              {form.contenido.educacion.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-display mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                    Educación
                  </h3>
                  <div className="space-y-3">
                    {form.contenido.educacion.map((edu, idx) => (
                      <div key={idx}>
                        <p className="font-bold">{edu.titulo || "Título"}</p>
                        <p className="text-sm text-muted-foreground">
                          {[edu.institucion, edu.nivel, edu.anioFin].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {form.contenido.habilidades.filter((h) => h.items.length > 0).length > 0 && (
                <div>
                  <h3 className="font-display mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                    Habilidades
                  </h3>
                  <div className="space-y-3">
                    {form.contenido.habilidades
                      .filter((h) => h.items.length > 0)
                      .map((hab, idx) => (
                        <div key={idx}>
                          <p className="text-sm font-semibold">{hab.categoria}</p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {hab.items.map((item) => (
                              <Badge key={item} variant="secondary">
                                {item}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
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
                    m.de === "yo"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-card-foreground"
                  }`}
                >
                  {m.texto}
                </div>
              </div>
            ))}

            {jackLoading && (
              <div className="flex gap-2">
                <div className="bg-primary flex size-7 shrink-0 items-center justify-center rounded-full">
                  <Bot className="size-3.5 text-primary-foreground" />
                </div>
                <div className="bg-card max-w-[80%] rounded-2xl px-3 py-2 text-sm">
                  <Loader2 className="size-4 animate-spin" />
                </div>
              </div>
            )}

            {mejora && (
              <div className="flex gap-2">
                <div className="bg-primary flex size-7 shrink-0 items-center justify-center rounded-full">
                  <Bot className="size-3.5 text-primary-foreground" />
                </div>
                <div className="max-w-[95%] flex-1">
                  <CvDiff
                    cambios={mejora.cambios}
                    preguntas={mejora.preguntas}
                    onAplicar={aplicarMejora}
                    onCancelar={() => setMejora(null)}
                    isApplying={aplicandoMejora}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Sugerencias rápidas</p>
            <div className="flex flex-wrap gap-2">
              {sugerenciasMock.map((s) => (
                <Badge
                  key={s}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                  onClick={() => {
                    setMensaje(s);
                    setTimeout(() => {
                      const btn = document.getElementById("jack-send-btn");
                      btn?.click();
                    }, 50);
                  }}
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
            <Button
              id="jack-send-btn"
              type="button"
              size="icon"
              className="shrink-0"
              onClick={enviarMensaje}
              disabled={!mensaje.trim() || jackLoading}
            >
              <MessageSquare className="size-4" />
            </Button>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <Button
              variant="outline"
              className="w-full"
              type="button"
              onClick={() => {
                if (!form) return;
                const plantilla = form.contenido.plantilla ?? "clasica";
                const fotoBase64 = form.contenido.fotoBase64;
                import("@/lib/cv.export").then(({ descargarPdf }) => {
                  descargarPdf(form, perfil ?? null, name || "", {
                    plantilla,
                    ...(fotoBase64 ? { fotoBase64 } : {}),
                  });
                });
              }}
            >
              <Download className="mr-2 size-4" /> Exportar PDF
            </Button>
            <Button
              variant="outline"
              className="w-full"
              type="button"
              onClick={() => {
                if (!form) return;
                import("@/lib/cv.export").then(({ descargarDocx }) => {
                  descargarDocx(form, perfil ?? null, name || "");
                });
              }}
            >
              <FileText className="mr-2 size-4" /> Exportar DOCX
            </Button>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

function formatPeriodo(
  fechaInicio?: string,
  fechaFin?: string,
  actualmente?: boolean,
): string | null {
  if (!fechaInicio && !fechaFin && !actualmente) return null;
  const inicio = fechaInicio ? mesNombreCorto(fechaInicio) : "—";
  const fin = actualmente ? "actualidad" : fechaFin ? mesNombreCorto(fechaFin) : "—";
  return `${inicio} – ${fin}`;
}

function mesNombreCorto(isoYM: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(isoYM);
  if (!match) return isoYM;
  const meses = [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
  ];
  const mes = Number(match[2]);
  return `${meses[mes - 1] ?? match[2]}. ${match[1]}`;
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
