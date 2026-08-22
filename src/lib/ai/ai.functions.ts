import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";
import { createAIProvider } from "@/lib/ai/ai-provider";
import { PROMPT_RESUME_IMPROVEMENT, SYSTEM_PROMPT_BASE } from "@/lib/ai/prompts";
import { filaACv } from "@/lib/cv.model";
import { filaAPerfil } from "@/lib/perfil.model";
import type { CvContenido, CvExperiencia } from "@/lib/supabase/types";
import type { Perfil } from "@/lib/perfil.model";
import type { ResumeRow } from "@/lib/supabase/types";

const mejoraSchema = z.object({
  mejorado: z.object({
    titular: z.string().default(""),
    perfil: z.string().default(""),
    experiencia: z
      .array(
        z.object({
          puesto: z.string().default(""),
          empresa: z.string().default(""),
          detalle: z.string().default(""),
        }),
      )
      .default([]),
  }),
  cambios: z
    .array(
      z.object({
        campo: z.string(),
        antes: z.string(),
        despues: z.string(),
        razon: z.string(),
      }),
    )
    .default([]),
  preguntas: z.array(z.string()).default([]),
});

export interface MejoraSugerida {
  mejorado: CvContenido;
  cambios: Array<{ campo: string; antes: string; despues: string; razon: string }>;
  preguntas: string[];
}

function cvATexto(cv: { contenido: CvContenido }, perfil: Perfil | null): string {
  const lineas: string[] = [];
  lineas.push(`TITULAR: ${cv.contenido.titular}`);
  lineas.push(`PERFIL: ${cv.contenido.perfil}`);
  if (perfil?.skills?.length) {
    lineas.push(`HABILIDADES: ${perfil.skills.join(", ")}`);
  }
  cv.contenido.experiencia.forEach((exp: CvExperiencia, i: number) => {
    lineas.push(`EXPERIENCIA ${i + 1}:`);
    lineas.push(`  Puesto: ${exp.puesto}`);
    lineas.push(`  Empresa: ${exp.empresa}`);
    lineas.push(`  Detalle: ${exp.detalle}`);
  });
  return lineas.join("\n");
}

function perfilATexto(perfil: Perfil | null): string {
  if (!perfil) return "Perfil no cargado";
  const lineas: string[] = [];
  lineas.push(`Nombre: ${perfil.nombre}`);
  lineas.push(`Rubro objetivo: ${perfil.rubroObjetivo}`);
  lineas.push(`Ubicación: ${perfil.ubicacion}`);
  lineas.push(`Teléfono: ${perfil.telefono}`);
  lineas.push(`Resumen: ${perfil.resumen}`);
  if (perfil.skills.length) lineas.push(`Skills: ${perfil.skills.join(", ")}`);
  return lineas.join("\n");
}

export const mejorarCvConJack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        cvId: z.string().uuid(),
        mensajeUsuario: z.string().max(1000).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<MejoraSugerida> => {
    // 1. Leer CV actual
    const { data: fila, error: errorCv } = await context.supabase
      .from("resumes")
      .select("*")
      .eq("id", data.cvId)
      .eq("user_id", context.userId)
      .single();

    if (errorCv) throw new Error(errorCv.message);

    // 2. Leer perfil
    const { data: perfilFila, error: errorPerfil } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("user_id", context.userId)
      .single();

    if (errorPerfil && errorPerfil.code !== "PGRST116") {
      throw new Error(errorPerfil.message);
    }

    const cv = filaACv(fila as unknown as ResumeRow);
    const perfil = perfilFila ? filaAPerfil(perfilFila as Record<string, unknown>) : null;

    // 3. Preparar texto para la IA
    const cvTexto = cvATexto(cv, perfil);
    const perfilTexto = perfilATexto(perfil);

    const userPrompt = data.mensajeUsuario.trim()
      ? `${data.mensajeUsuario}\n\n${PROMPT_RESUME_IMPROVEMENT(cvTexto, perfilTexto)}`
      : PROMPT_RESUME_IMPROVEMENT(cvTexto, perfilTexto);

    // 4. Llamar a IA
    const provider = createAIProvider();
    const response = await provider.generate({
      system: SYSTEM_PROMPT_BASE,
      messages: [{ role: "user", content: userPrompt }],
      temperature: 0.7,
    });

    // 5. Parsear JSON
    let rawJson = response.content.trim();
    // Limpiar bloques markdown si la IA los agregó
    if (rawJson.startsWith("```json")) {
      rawJson = rawJson.slice(7);
      if (rawJson.endsWith("```")) rawJson = rawJson.slice(0, -3);
    } else if (rawJson.startsWith("```")) {
      rawJson = rawJson.slice(3);
      if (rawJson.endsWith("```")) rawJson = rawJson.slice(0, -3);
    }
    rawJson = rawJson.trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      throw new Error("Jack no pudo generar una respuesta válida. Probá de nuevo.");
    }

    const resultado = mejoraSchema.parse(parsed);

    // 6. Mapear a tipo interno
    return {
      mejorado: {
        titular: resultado.mejorado.titular,
        perfil: resultado.mejorado.perfil,
        experiencia: resultado.mejorado.experiencia.map((exp) => ({
          id: generarId(),
          puesto: exp.puesto,
          empresa: exp.empresa,
          detalle: exp.detalle,
        })),
      },
      cambios: resultado.cambios,
      preguntas: resultado.preguntas,
    };
  });

function generarId(): string {
  if (typeof globalThis !== "undefined" && "crypto" in globalThis) {
    const c = globalThis.crypto as { randomUUID?: () => string };
    if (c.randomUUID) return c.randomUUID();
  }
  return `exp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
