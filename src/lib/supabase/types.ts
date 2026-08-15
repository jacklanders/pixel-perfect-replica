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
}

export interface CvContenido {
  titular: string;
  perfil: string;
  experiencia: CvExperiencia[];
}

export const CV_CONTENIDO_VACIO: CvContenido = {
  titular: "",
  perfil: "",
  experiencia: [],
};

export function normalizarContenidoCv(value: Json | null | undefined): CvContenido {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...CV_CONTENIDO_VACIO, experiencia: [] };
  }
  const raw = value as Record<string, Json>;
  const experiencia = Array.isArray(raw["experiencia"]) ? (raw["experiencia"] as Json[]) : [];

  return {
    titular: typeof raw["titular"] === "string" ? raw["titular"] : "",
    perfil: typeof raw["perfil"] === "string" ? raw["perfil"] : "",
    experiencia: experiencia
      .filter((e): e is { [key: string]: Json } => !!e && typeof e === "object" && !Array.isArray(e))
      .map((e, i) => ({
        id: typeof e["id"] === "string" ? e["id"] : `exp-${i}`,
        puesto: typeof e["puesto"] === "string" ? e["puesto"] : "",
        empresa: typeof e["empresa"] === "string" ? e["empresa"] : "",
        detalle: typeof e["detalle"] === "string" ? e["detalle"] : "",
      })),
  };
}
