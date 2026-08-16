import { createFileRoute } from "@tanstack/react-router";
import { Download, FileUp, Sparkles, Send, Wand2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/cv")({
  head: () => ({
    meta: [
      { title: "Mi CV — Jack" },
      {
        name: "description",
        content:
          "Editá tu CV, pedile mejoras a Jack sección por sección y exportalo en PDF apto para filtros ATS.",
      },
      { property: "og:title", content: "Mi CV — Jack" },
      {
        property: "og:description",
        content: "Editor de CV con sugerencias de IA y exportación a PDF.",
      },
    ],
  }),
  component: CvPage,
});

const chat = [
  {
    from: "jack" as const,
    text: "Leí tu CV. La experiencia está bien, pero los logros son genéricos. ¿Querés que los reescriba con números?",
  },
  { from: "user" as const, text: "Sí, sobre todo el puesto en Telecom." },
  {
    from: "jack" as const,
    text: 'Propongo: "Reduje el tiempo de resolución de reclamos de 48 a 26 horas gestionando una cartera de 120 cuentas". ¿Lo aplico?',
  },
];

const experiencia = [
  {
    puesto: "Ejecutiva de cuentas",
    empresa: "Telecom · 2021 – actualidad",
    detalle:
      "Gestión de cartera de 120 cuentas corporativas. Seguimiento de reclamos y renovaciones.",
  },
  {
    puesto: "Asesora de atención al cliente",
    empresa: "Banco Río · 2019 – 2021",
    detalle: "Atención presencial y telefónica, venta cruzada de productos financieros.",
  },
];

function CvPage() {
  return (
    <AppShell title="Mi CV" subtitle="Versión: CV general · guardado hace 2 minutos">
      <div className="mb-6 flex flex-wrap gap-3">
        <Button variant="outline">
          <FileUp className="size-4" />
          Subir PDF o Word
        </Button>
        <Button variant="outline">
          <Download className="size-4" />
          Exportar PDF
        </Button>
        <Badge variant="secondary" className="self-center rounded-full px-3 py-1">
          Apto ATS
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="rounded-2xl border border-border bg-card shadow-soft">
          <Tabs defaultValue="editar">
            <div className="border-b border-border px-4 pt-4">
              <TabsList>
                <TabsTrigger value="editar">Editar</TabsTrigger>
                <TabsTrigger value="vista">Vista previa</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="editar" className="space-y-6 p-6">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="titular">
                  Titular
                </label>
                <Input id="titular" defaultValue="Ejecutiva de cuentas | Atención al cliente" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium" htmlFor="perfil">
                    Perfil
                  </label>
                  <Button variant="ghost" size="sm">
                    <Wand2 className="size-3.5" />
                    Mejorar con Jack
                  </Button>
                </div>
                <Textarea
                  id="perfil"
                  rows={4}
                  defaultValue="Profesional con seis años de experiencia en atención al cliente y ventas corporativas, orientada a la retención de cuentas."
                />
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium">Experiencia</p>
                {experiencia.map((e) => (
                  <div key={e.puesto} className="rounded-xl border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{e.puesto}</p>
                        <p className="text-xs text-muted-foreground">{e.empresa}</p>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Wand2 className="size-3.5" />
                      </Button>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{e.detalle}</p>
                  </div>
                ))}
                <Button variant="outline" size="sm">
                  + Agregar experiencia
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="vista" className="p-6">
              <div className="mx-auto max-w-xl rounded-xl border border-border bg-background p-8 shadow-soft">
                <p className="font-display text-xl font-bold">María Paz Duarte</p>
                <p className="text-sm text-muted-foreground">
                  Ejecutiva de cuentas | Atención al cliente
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Corrientes, Argentina · +54 9 379 000 0000 · mariapaz@gmail.com
                </p>
                <hr className="my-5" />
                <p className="text-sm font-bold">Perfil</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Profesional con seis años de experiencia en atención al cliente y ventas
                  corporativas, orientada a la retención de cuentas.
                </p>
                <p className="mt-5 text-sm font-bold">Experiencia</p>
                {experiencia.map((e) => (
                  <div key={e.puesto} className="mt-3">
                    <p className="text-sm font-medium">{e.puesto}</p>
                    <p className="text-xs text-muted-foreground">{e.empresa}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{e.detalle}</p>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </section>

        <section className="flex h-fit flex-col rounded-2xl border border-border bg-card shadow-soft">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <Sparkles className="size-4 text-accent" />
            <p className="text-sm font-medium">Jack</p>
            <span className="ml-auto text-xs text-muted-foreground">3 / 10 hoy</span>
          </div>
          <div className="space-y-4 p-5">
            {chat.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  m.from === "jack"
                    ? "bg-muted text-foreground"
                    : "ml-auto bg-primary text-primary-foreground"
                }`}
              >
                {m.text}
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <Button size="sm">Aplicar sugerencia</Button>
              <Button size="sm" variant="ghost">
                Otra versión
              </Button>
            </div>
          </div>
          <form
            className="flex gap-2 border-t border-border p-4"
            onSubmit={(e) => e.preventDefault()}
          >
            <Input placeholder="Escribile a Jack…" />
            <Button size="icon" type="submit" aria-label="Enviar">
              <Send className="size-4" />
            </Button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
