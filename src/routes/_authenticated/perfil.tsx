import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

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

const skills = ["Atención al cliente", "Excel avanzado", "Ventas B2B", "CRM", "Inglés B2"];

function PerfilPage() {
  return (
    <AppShell
      title="Tu perfil"
      subtitle="Jack usa estos datos para escribir tu CV y tus postulaciones."
    >
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center gap-4">
            <Avatar className="size-14">
              <AvatarFallback className="bg-secondary text-secondary-foreground">MP</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-display text-lg font-bold">María Paz Duarte</p>
              <p className="text-sm text-muted-foreground">mariapaz@gmail.com</p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto">
              Cambiar foto
            </Button>
          </div>

          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre y apellido</Label>
              <Input id="nombre" defaultValue="María Paz Duarte" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rubro">Rubro / perfil</Label>
              <Input id="rubro" defaultValue="Atención al cliente y ventas" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tel">Teléfono</Label>
              <Input id="tel" defaultValue="+54 9 379 000 0000" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ubicacion">Ubicación</Label>
              <Input id="ubicacion" defaultValue="Corrientes, Argentina" />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <Label htmlFor="resumen">Resumen profesional</Label>
            <Textarea
              id="resumen"
              rows={4}
              defaultValue="Seis años de experiencia en atención al cliente y ventas, con foco en retención de cuentas y resolución de reclamos."
            />
          </div>

          <div className="mt-6">
            <Label>Skills</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {skills.map((s) => (
                <Badge key={s} variant="secondary" className="rounded-full px-3 py-1">
                  {s}
                </Badge>
              ))}
              <Badge variant="outline" className="cursor-pointer rounded-full px-3 py-1">
                + agregar
              </Badge>
            </div>
          </div>

          <div className="mt-8 flex gap-3">
            <Button>Guardar cambios</Button>
            <Button variant="ghost" asChild>
              <Link to="/cv">Ir a mi CV</Link>
            </Button>
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <p className="text-sm font-medium">Perfil completo</p>
            <Progress value={72} className="mt-3" />
            <p className="mt-2 text-xs text-muted-foreground">72% — falta cargar tu experiencia</p>
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
            <div className="mt-4 rounded-xl bg-muted p-4 text-sm leading-relaxed">
              <p className="font-medium">María Paz Duarte</p>
              <p className="text-muted-foreground">Atención al cliente y ventas</p>
              <p className="text-muted-foreground">+54 9 379 000 0000 · mariapaz@gmail.com</p>
              <p className="text-muted-foreground">Corrientes, Argentina</p>
            </div>
            <Button variant="outline" size="sm" className="mt-4">
              Editar firma
            </Button>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
