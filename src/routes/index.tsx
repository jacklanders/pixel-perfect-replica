import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FileUp, MessagesSquare, Download, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import heroImg from "@/assets/jack-hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Jack — Creá y mejorá tu CV con IA" },
      {
        name: "description",
        content:
          "Subí tu CV o creálo desde cero. Jack lo mejora con IA, lo ordena para filtros ATS y lo exportás en PDF.",
      },
      { property: "og:title", content: "Jack — Creá y mejorá tu CV con IA" },
      {
        property: "og:description",
        content: "Tu asistente para armar un CV que pase los filtros y consiga entrevistas.",
      },
    ],
  }),
  component: Landing,
});

const pasos = [
  {
    icon: FileUp,
    title: "Subí o creá",
    text: "Cargá tu CV en PDF o Word, o armalo desde cero respondiendo preguntas.",
  },
  {
    icon: MessagesSquare,
    title: "Mejoralo con Jack",
    text: "Jack reescribe logros, ordena secciones y sugiere skills según tu rubro.",
  },
  {
    icon: Download,
    title: "Exportá y postulate",
    text: "Descargá un PDF limpio, apto para filtros ATS, listo para enviar.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      <section className="surface-hero relative overflow-hidden">
        <div className="grid-paper absolute inset-0 opacity-30" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 md:grid-cols-[1.05fr_1fr] md:py-28">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-ink-foreground/25 px-3 py-1 text-xs tracking-wide uppercase">
              Prototipo · Fase 1
            </p>
            <h1 className="font-display text-4xl leading-[1.05] font-bold md:text-6xl">
              Tu CV, trabajado
              <br />
              con criterio.
            </h1>
            <p className="mt-5 max-w-md text-base/relaxed opacity-85">
              Jack es tu asistente de búsqueda laboral: mejora lo que ya escribiste, completa lo
              que falta y deja tu CV listo para postular.
            </p>
            <div className="mt-8">
              <Button asChild size="lg" variant="secondary">
                <Link to="/login">
                  Empezar con mi CV
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="relative">
            <img
              src={heroImg}
              alt="CV impreso sobre un escritorio con lapicera y notas"
              width={1200}
              height={900}
              className="rounded-2xl shadow-lift"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="font-display text-2xl font-bold md:text-3xl">Cómo funciona</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {pasos.map((p, i) => (
            <article
              key={p.title}
              className="rounded-2xl border border-border bg-card p-6 shadow-soft"
            >
              <p.icon className="size-6 text-primary" />
              <p className="mt-5 text-xs font-medium text-muted-foreground">Paso {i + 1}</p>
              <h3 className="mt-1 text-lg font-bold">{p.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{p.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-secondary/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-10 text-sm">
          <ShieldCheck className="size-5 text-primary" />
          <p className="text-secondary-foreground">
            Tus archivos quedan en almacenamiento privado. Solo vos accedés a tu CV.
          </p>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-5 py-10 text-sm text-muted-foreground">
        Jack · prototipo de interfaz
      </footer>
    </div>
  );
}
