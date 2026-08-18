import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Check, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getCurrentUser } from "@/lib/server/auth";
import { getMyProfile, updateMyProfile, type Profile } from "@/lib/server/profile";

export const Route = createFileRoute("/perfil")({
  beforeLoad: async () => {
    const user = await getCurrentUser();
    if (!user) throw redirect({ to: "/login" });
  },
  loader: async () => {
    const profile = await getMyProfile();
    return { profile };
  },
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

function initials(nombre: string | null, email: string): string {
  if (nombre?.trim()) {
    const parts = nombre.trim().split(/\s+/);
    return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  }
  return email.slice(0, 2).toUpperCase();
}

function completitud(p: Pick<Profile, "nombre" | "rubro_objetivo" | "telefono" | "ubicacion" | "firma_mail" | "skills">) {
  const campos = [p.nombre, p.rubro_objetivo, p.telefono, p.ubicacion, p.firma_mail];
  const completos = campos.filter((c) => !!c && c.trim().length > 0).length + (p.skills.length > 0 ? 1 : 0);
  return Math.round((completos / (campos.length + 1)) * 100);
}

function PerfilPage() {
  const { profile } = Route.useLoaderData();

  if (!profile) {
    return (
      <AppShell title="Tu perfil">
        <p className="text-sm text-muted-foreground">
          No pudimos cargar tu perfil. Recargá la página; si el problema sigue, puede ser que la
          fila de <code>profiles</code> no se haya creado al registrarte — revisar el trigger
          <code> handle_new_user</code> en Supabase Studio.
        </p>
      </AppShell>
    );
  }

  return <PerfilForm initial={profile} />;
}

function PerfilForm({ initial }: { initial: Profile }) {
  const [nombre, setNombre] = useState(initial.nombre ?? "");
  const [rubro, setRubro] = useState(initial.rubro_objetivo ?? "");
  const [telefono, setTelefono] = useState(initial.telefono ?? "");
  const [ubicacion, setUbicacion] = useState(initial.ubicacion ?? "");
  const [firmaMail, setFirmaMail] = useState(initial.firma_mail ?? "");
  const [skills, setSkills] = useState<string[]>(initial.skills);
  const [nuevaSkill, setNuevaSkill] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const pct = completitud({
    nombre,
    rubro_objetivo: rubro,
    telefono,
    ubicacion,
    firma_mail: firmaMail,
    skills,
  });

  function agregarSkill() {
    const s = nuevaSkill.trim();
    if (s && !skills.includes(s)) setSkills([...skills, s]);
    setNuevaSkill("");
  }

  async function guardar() {
    setStatus("saving");
    const res = await updateMyProfile({
      data: {
        nombre: nombre || undefined,
        telefono: telefono || undefined,
        ubicacion: ubicacion || undefined,
        rubro_objetivo: rubro || undefined,
        firma_mail: firmaMail || undefined,
        skills,
      },
    });
    setStatus(res.ok ? "saved" : "error");
  }

  return (
    <AppShell
      title="Tu perfil"
      subtitle="Jack usa estos datos para escribir tu CV y tus postulaciones."
    >
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center gap-4">
            <Avatar className="size-14">
              {initial.avatar_url ? <AvatarImage src={initial.avatar_url} alt="" /> : null}
              <AvatarFallback className="bg-secondary text-secondary-foreground">
                {initials(initial.nombre, initial.email)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-display text-lg font-bold">{nombre || "Sin nombre todavía"}</p>
              <p className="text-sm text-muted-foreground">{initial.email}</p>
            </div>
          </div>

          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre y apellido</Label>
              <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rubro">Rubro / perfil</Label>
              <Input id="rubro" value={rubro} onChange={(e) => setRubro(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tel">Teléfono</Label>
              <Input id="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ubicacion">Ubicación</Label>
              <Input
                id="ubicacion"
                value={ubicacion}
                onChange={(e) => setUbicacion(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-6">
            <Label>Skills</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {skills.map((s) => (
                <Badge
                  key={s}
                  variant="secondary"
                  className="flex items-center gap-1 rounded-full px-3 py-1"
                >
                  {s}
                  <button
                    type="button"
                    aria-label={`Quitar ${s}`}
                    onClick={() => setSkills(skills.filter((sk) => sk !== s))}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <Input
                placeholder="Agregar skill y Enter"
                value={nuevaSkill}
                onChange={(e) => setNuevaSkill(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    agregarSkill();
                  }
                }}
                className="max-w-xs"
              />
              <Button type="button" variant="outline" size="sm" onClick={agregarSkill}>
                Agregar
              </Button>
            </div>
          </div>

          <div className="mt-8 flex items-center gap-3">
            <Button onClick={guardar} disabled={status === "saving"}>
              {status === "saving" ? "Guardando…" : "Guardar cambios"}
            </Button>
            {status === "saved" ? (
              <span className="text-sm text-primary">Guardado.</span>
            ) : null}
            {status === "error" ? (
              <span className="text-sm text-destructive">
                No se pudo guardar. Probá de nuevo.
              </span>
            ) : null}
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <p className="text-sm font-medium">Perfil completo</p>
            <Progress value={pct} className="mt-3" />
            <p className="mt-2 text-xs text-muted-foreground">{pct}%</p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              {[
                { label: "Datos personales", ok: !!nombre && !!telefono && !!ubicacion },
                { label: "Skills", ok: skills.length > 0 },
                { label: "Firma de mail", ok: !!firmaMail },
              ].map((i) => (
                <li key={i.label} className="flex items-center gap-2">
                  <Check className={`size-4 ${i.ok ? "text-primary" : "text-muted-foreground/30"}`} />
                  {i.label}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <p className="text-sm font-medium">Firma de mail</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Se reutiliza en todas tus postulaciones.
            </p>
            <div className="mt-4 space-y-2">
              <Textarea
                rows={5}
                value={firmaMail}
                onChange={(e) => setFirmaMail(e.target.value)}
                placeholder={`${nombre || "Tu nombre"}\n${rubro || "Tu rubro"}\n${telefono || "Tu teléfono"} · ${initial.email}\n${ubicacion || "Tu ubicación"}`}
              />
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
