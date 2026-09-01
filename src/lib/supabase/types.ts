/**
 * Tipos de la base, escritos a mano a partir de supabase/migrations/0001_init.sql.
 * Al usar un proyecto Supabase externo (no Lovable Cloud) no hay generación
 * automática: si se agrega una migración nueva, actualizar este archivo también.
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface ProfileRow {
  user_id: string;
  nombre: string | null;
  email: string;
  telefono: string | null;
  ubicacion: string | null;
  rubro_objetivo: string | null;
  firma_mail: string | null;
  preferencias: Json;
  created_at: string;
  updated_at: string;
}

export type ResumeSourceType = "uploaded_pdf" | "uploaded_docx" | "created_from_scratch";

export interface ResumeRow {
  id: string;
  user_id: string;
  title: string;
  is_primary: boolean;
  source_type: ResumeSourceType;
  structured_json: Json;
  extracted_text: string | null;
  file_path_original: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface DailyUsageRow {
  user_id: string;
  usage_date: string;
  application_generations: number;
  ai_calls: number;
  cost_estimate_usd: number;
}

export interface UserRoleRow {
  user_id: string;
  role: "user" | "admin";
  granted_at: string;
}

/** Contenido estructurado del CV (columna resumes.structured_json). */
export interface CvExperiencia {
  id: string;
  puesto: string;
  empresa: string;
  detalle: string;
  /** Formato ISO (AAAA-MM) o texto libre legible. Opcional (CVs legados). */
  fechaInicio?: string | undefined;
  fechaFin?: string | undefined;
  /** true si el puesto es el empleo actual (sin fechaFin). */
  actualmente?: boolean | undefined;
  ubicacion?: string | undefined;
}

export interface CvEducacion {
  institucion: string;
  titulo: string;
  /** Ej: "terciario", "universitario", "posgrado", "secundario", "curso". */
  nivel?: string | undefined;
  /** Año de finalización (o en curso si falta). */
  anioFin?: string | undefined;
  ubicacion?: string | undefined;
}

export interface CvHabilidadCategoria {
  categoria: string;
  items: string[];
}

export interface CvContacto {
  telefono?: string | undefined;
  email?: string | undefined;
  ubicacion?: string | undefined;
}

/** Plantillas de exportación de CV disponibles para el PDF. */
export type PlantillaCv = "clasica" | "moderna";

export interface CvContenido {
  titular: string;
  perfil: string;
  experiencia: CvExperiencia[];
  /** Disponibilidad laboral (ej: "inmediata", "disponibilidad inmediata"). */
  disponibilidad?: string | undefined;
  contacto?: CvContacto | undefined;
  educacion: CvEducacion[];
  habilidades: CvHabilidadCategoria[];
  /** Plantilla de exportación elegida por el usuario. */
  plantilla?: PlantillaCv | undefined;
  /** Foto del CV como dataURL (data:image/...;base64,...). */
  fotoBase64?: string | undefined;
}

export const CV_CONTENIDO_VACIO: CvContenido = {
  titular: "",
  perfil: "",
  experiencia: [],
  educacion: [],
  habilidades: [],
};

/** Lee un string de un objeto JSON, con fallback. */
function leerString(record: Record<string, Json>, key: string): string | undefined {
  const v = record[key];
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
}

export function normalizarContenidoCv(value: Json | null | undefined): CvContenido {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...CV_CONTENIDO_VACIO, experiencia: [] };
  }
  const raw = value as Record<string, Json>;
  const experiencia = Array.isArray(raw["experiencia"]) ? (raw["experiencia"] as Json[]) : [];
  const educacion = Array.isArray(raw["educacion"]) ? (raw["educacion"] as Json[]) : [];
  const habilidades = Array.isArray(raw["habilidades"]) ? (raw["habilidades"] as Json[]) : [];
  const contacto = raw["contacto"];

  return {
    titular: typeof raw["titular"] === "string" ? raw["titular"] : "",
    perfil: typeof raw["perfil"] === "string" ? raw["perfil"] : "",
    experiencia: experiencia
      .filter(
        (e): e is { [key: string]: Json } => !!e && typeof e === "object" && !Array.isArray(e),
      )
      .map((e, i) => ({
        id: typeof e["id"] === "string" ? e["id"] : `exp-${i}`,
        puesto: typeof e["puesto"] === "string" ? e["puesto"] : "",
        empresa: typeof e["empresa"] === "string" ? e["empresa"] : "",
        detalle: typeof e["detalle"] === "string" ? e["detalle"] : "",
        fechaInicio: leerString(e, "fechaInicio"),
        fechaFin: leerString(e, "fechaFin"),
        actualmente: e["actualmente"] === true ? true : undefined,
        ubicacion: leerString(e, "ubicacion"),
      })),
    disponibilidad: leerString(raw, "disponibilidad"),
    contacto:
      contacto && !Array.isArray(contacto) && typeof contacto === "object"
        ? {
            telefono: leerString(contacto as Record<string, Json>, "telefono"),
            email: leerString(contacto as Record<string, Json>, "email"),
            ubicacion: leerString(contacto as Record<string, Json>, "ubicacion"),
          }
        : undefined,
    educacion: educacion
      .filter(
        (e): e is { [key: string]: Json } => !!e && typeof e === "object" && !Array.isArray(e),
      )
      .map((e) => ({
        institucion: typeof e["institucion"] === "string" ? e["institucion"] : "",
        titulo: typeof e["titulo"] === "string" ? e["titulo"] : "",
        nivel: leerString(e, "nivel"),
        anioFin: leerString(e, "anioFin"),
        ubicacion: leerString(e, "ubicacion"),
      }))
      .filter((e) => e.institucion !== "" || e.titulo !== ""),
    habilidades: habilidades
      .filter(
        (h): h is { [key: string]: Json } => !!h && typeof h === "object" && !Array.isArray(h),
      )
      .map((h) => ({
        categoria: typeof h["categoria"] === "string" ? h["categoria"] : "",
        items: Array.isArray(h["items"])
          ? (h["items"] as Json[]).filter((x): x is string => typeof x === "string")
          : [],
      }))
      .filter((h) => h.categoria !== "" && h.items.length > 0),
    plantilla:
      raw["plantilla"] === "clasica" || raw["plantilla"] === "moderna"
        ? (raw["plantilla"] as "clasica" | "moderna")
        : undefined,
    fotoBase64: typeof raw["fotoBase64"] === "string" ? raw["fotoBase64"] : undefined,
  };
}

// ─── OAuth (Gmail) ───
export interface OAuthConnectionRow {
  user_id: string;
  provider: string;
  encrypted_access_token: string | null;
  encrypted_refresh_token: string | null;
  scopes: string[];
  connected_at: string;
  revoked_at: string | null;
  expires_at: string | null;
}

export interface OAuthConnectionStatusRow {
  user_id: string;
  provider: string;
  connected: boolean;
  updated_at: string;
}
