import { z } from "zod";
import {
  normalizarContenidoCv,
  type CvContenido,
  type ResumeRow,
  type ResumeSourceType,
} from "@/lib/supabase/types";

export const experienciaSchema = z.object({
  id: z.string().min(1),
  puesto: z.string().max(160).default(""),
  empresa: z.string().max(160).default(""),
  detalle: z.string().max(2000).default(""),
  fechaInicio: z.string().max(40).optional(),
  fechaFin: z.string().max(40).optional(),
  actualmente: z.boolean().optional(),
  ubicacion: z.string().max(160).optional(),
});

export const educacionSchema = z.object({
  institucion: z.string().max(200).default(""),
  titulo: z.string().max(200).default(""),
  nivel: z.string().max(40).optional(),
  anioFin: z.string().max(40).optional(),
  ubicacion: z.string().max(160).optional(),
});

export const habilidadCategoriaSchema = z.object({
  categoria: z.string().max(160).default(""),
  items: z.array(z.string().max(120)).max(100).default([]),
});

export const contactoCvSchema = z.object({
  telefono: z.string().max(80).optional(),
  email: z.string().max(200).optional(),
  ubicacion: z.string().max(160).optional(),
});

export const contenidoCvSchema = z.object({
  titular: z.string().max(200).default(""),
  perfil: z.string().max(3000).default(""),
  experiencia: z.array(experienciaSchema).max(30).default([]),
  disponibilidad: z.string().max(160).optional(),
  contacto: contactoCvSchema.optional(),
  educacion: z.array(educacionSchema).max(30).default([]),
  habilidades: z.array(habilidadCategoriaSchema).max(30).default([]),
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
  sourceType: ResumeSourceType;
  version: number;
  updatedAt: string;
  contenido: CvContenido;
}

export function filaACv(fila: ResumeRow): Cv {
  return {
    id: fila.id,
    title: fila.title,
    isPrimary: fila.is_primary,
    sourceType: fila.source_type,
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
