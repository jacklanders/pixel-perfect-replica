import { z } from "zod";
import { normalizarContenidoCv, type CvContenido, type ResumeRow } from "@/lib/supabase/types";

export const experienciaSchema = z.object({
  id: z.string().min(1),
  puesto: z.string().max(160).default(""),
  empresa: z.string().max(160).default(""),
  detalle: z.string().max(2000).default(""),
});

export const contenidoCvSchema = z.object({
  titular: z.string().max(200).default(""),
  perfil: z.string().max(3000).default(""),
  experiencia: z.array(experienciaSchema).max(30).default([]),
});

export const guardarCvSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(160),
  contenido: contenidoCvSchema,
});

export interface Cv {
  id: string;
  title: string;
  isPrimary: boolean;
  version: number;
  updatedAt: string;
  contenido: CvContenido;
}

export function filaACv(fila: ResumeRow): Cv {
  return {
    id: fila.id,
    title: fila.title,
    isPrimary: fila.is_primary,
    version: fila.version,
    updatedAt: fila.updated_at,
    contenido: normalizarContenidoCv(fila.structured_json),
  };
}

/** Texto relativo simple para "actualizado hace…". */
export function hace(iso: string, ahora: Date = new Date()): string {
  const ms = ahora.getTime() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "ayer" : `hace ${d} días`;
}
