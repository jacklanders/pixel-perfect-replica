import { z } from "zod";
import type { Json } from "@/lib/supabase/types";

export const perfilSchema = z.object({
  nombre: z.string().max(120).default(""),
  telefono: z.string().max(60).default(""),
  ubicacion: z.string().max(120).default(""),
  rubroObjetivo: z.string().max(160).default(""),
  firmaMail: z.string().max(1000).default(""),
  resumen: z.string().max(2000).default(""),
  skills: z.array(z.string().min(1).max(60)).max(30).default([]),
});

export type PerfilInput = z.infer<typeof perfilSchema>;

export interface Perfil extends PerfilInput {
  email: string;
}

export const PERFIL_VACIO: Perfil = {
  email: "",
  nombre: "",
  telefono: "",
  ubicacion: "",
  rubroObjetivo: "",
  firmaMail: "",
  resumen: "",
  skills: [],
};

/** Mapea una fila de `profiles` (incluyendo `preferencias` jsonb) al modelo de UI. */
export function filaAPerfil(fila: Record<string, unknown>): Perfil {
  const prefs = (fila["preferencias"] ?? {}) as Record<string, Json>;
  const skills = Array.isArray(prefs["skills"]) ? (prefs["skills"] as Json[]) : [];

  return {
    email: (fila["email"] as string | null) ?? "",
    nombre: (fila["nombre"] as string | null) ?? "",
    telefono: (fila["telefono"] as string | null) ?? "",
    ubicacion: (fila["ubicacion"] as string | null) ?? "",
    rubroObjetivo: (fila["rubro_objetivo"] as string | null) ?? "",
    firmaMail: (fila["firma_mail"] as string | null) ?? "",
    resumen: typeof prefs["resumen"] === "string" ? prefs["resumen"] : "",
    skills: skills.filter((s): s is string => typeof s === "string"),
  };
}

/** Porcentaje de completitud del perfil, sobre datos reales. */
export function completitudPerfil(p: Perfil): number {
  const campos = [
    p.nombre,
    p.email,
    p.telefono,
    p.ubicacion,
    p.rubroObjetivo,
    p.resumen,
    p.firmaMail,
    p.skills?.length ? "ok" : "", // ← CAMBIADO: skills?.length (con ?)
  ];
  const completos = campos.filter((c) => c.trim().length > 0).length;
  return Math.round((completos / campos.length) * 100);
}

/** Firma sugerida a partir de los datos cargados. */
export function firmaSugerida(p: Perfil): string {
  return [p.nombre, p.rubroObjetivo, [p.telefono, p.email].filter(Boolean).join(" · "), p.ubicacion]
    .filter((l) => l && l.trim().length > 0)
    .join("\n");
}
