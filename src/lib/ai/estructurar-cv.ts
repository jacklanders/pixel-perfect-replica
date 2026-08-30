/**
 * Estructuración del texto extraído de un CV (PDF/DOCX) en campos editables.
 *
 * Se intenta primero con IA (Gemini/Anthropic) y si falla o el texto es muy
 * corto, se aplica un heurístico determinístico como fallback. Nunca lanza:
 * siempre devuelve un CvContenido válido.
 */
import { createAIProvider } from "@/lib/ai/ai-provider";
import { PROMPT_STRUCTURE_CV, SYSTEM_PROMPT_BASE } from "@/lib/ai/prompts";
import { z } from "zod";
import type { CvContenido, CvExperiencia } from "@/lib/supabase/types";

const MAX_PERFIL = 3000;
const MAX_DETALLE = 2000;
const MAX_PUESTO = 160;
const MAX_TITULAR = 200;
const MAX_EXPERIENCIAS = 8;

const resumenSchema = z.object({
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
});

const HEADER_PERFIL = /^(perfil|resumen|about|profile|summary|acerca de|objetivo)/i;
const HEADER_EXPERIENCIA =
  /^(experienc|exp[- ]?laboral|historial laboral|trayectoria|work (experience|history)|professional experience|trabajo)/i;
const HEADER_OTRO =
  /^(educaci[oó]n|education|habilidades|skills|idiomas|languages|formaci[oó]n|estudios|datos personales|contacto|cursos|certificaciones|licencias|referencias|intereses)/i;

const PARSE_PUESTO_EMPRESA = /^(.{1,120}?)\s+(?:a[tn]\s+|en\s+|-|–|—|@|,\s+|para\s+)(.{1,120})$/;

function recortar(texto: string, max: number): string {
  const limpio = texto.replace(/\s+/g, " ").trim();
  return limpio.length > max ? limpio.slice(0, max).trim() : limpio;
}

function parsearExperiencia(bloque: string): CvExperiencia {
  const lineas = bloque
    .split(/\r?\n/)
    .map((l) => l.replace(/^[•·▪\-*]\s*/, "").trim())
    .filter(Boolean);

  const primera = lineas[0] ?? "";
  const match = primera.match(PARSE_PUESTO_EMPRESA);
  const puestoRaw = match?.[1] ?? "";
  const empresaRaw = match?.[2] ?? "";
  const puesto = puestoRaw
    ? recortar(puestoRaw, MAX_PUESTO)
    : recortar(primera, MAX_PUESTO).replace(/[,;:].*$/, "");
  const empresa = empresaRaw ? recortar(empresaRaw, MAX_PUESTO) : "";
  const detalle = recortar(lineas.slice(1).join(" "), MAX_DETALLE);

  return { id: nuevoId(), puesto, empresa, detalle };
}

function nuevoId(): string {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `exp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Estructura un CV sin IA: reconoce headers incluso sin línea en blanco previa. */
export function estructurarCvPorHeuristica(texto: string): CvContenido {
  const resultado: CvContenido = { titular: "", perfil: "", experiencia: [] };

  const bloques = texto
    .split(/\r?\n\r?\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  if (bloques.length === 0) return resultado;

  resultado.titular = recortar(bloques[0]!.split(/\r?\n/)[0] ?? "", MAX_TITULAR);

  let seccion: "perfil" | "experiencia" | "otra" = "perfil";
  const perfilPartes: string[] = [];

  for (const bloque of bloques.slice(1)) {
    const lineas = bloque
      .split(/\r?\n/)
      .map((l) => l.replace(/^[•·▪\-*]\s*/, "").trim())
      .filter(Boolean);
    if (lineas.length === 0) continue;

    const primera = lineas[0]!;
    let contenido: string[];
    if (HEADER_EXPERIENCIA.test(primera)) {
      seccion = "experiencia";
      contenido = lineas.slice(1);
    } else if (HEADER_PERFIL.test(primera)) {
      seccion = "perfil";
      contenido = lineas.slice(1);
    } else if (HEADER_OTRO.test(primera)) {
      seccion = "otra";
      contenido = [];
    } else {
      contenido = lineas;
    }

    if (contenido.length === 0) continue;

    if (seccion === "perfil") {
      perfilPartes.push(contenido.join("\n"));
    } else if (seccion === "experiencia") {
      if (resultado.experiencia.length < MAX_EXPERIENCIAS) {
        resultado.experiencia.push(parsearExperiencia(contenido.join("\n")));
      }
    }
  }

  if (perfilPartes.length > 0) {
    resultado.perfil = recortar(perfilPartes.join(" "), MAX_PERFIL);
  }

  return resultado;
}

/** Intenta estructurar con IA; ante cualquier fallo usa el heurístico. */
export async function estructurarCvTexto(texto: string): Promise<CvContenido> {
  const limpio = texto.trim();
  if (limpio.length < 50) {
    return estructurarCvPorHeuristica(limpio);
  }

  try {
    const provider = createAIProvider();
    const response = await provider.generate({
      system: SYSTEM_PROMPT_BASE,
      messages: [{ role: "user", content: PROMPT_STRUCTURE_CV(limpio) }],
      temperature: 0.2,
    });

    let rawJson = response.content.trim();
    if (rawJson.startsWith("```json")) rawJson = rawJson.slice(7);
    else if (rawJson.startsWith("```")) rawJson = rawJson.slice(3);
    if (rawJson.endsWith("```")) rawJson = rawJson.slice(0, -3);
    rawJson = rawJson.trim();

    const parsed = JSON.parse(rawJson) as unknown;
    const validado = resumenSchema.parse(parsed);

    return {
      titular: recortar(validado.titular, MAX_TITULAR),
      perfil: recortar(validado.perfil, MAX_PERFIL),
      experiencia: validado.experiencia.slice(0, MAX_EXPERIENCIAS).map((exp) => ({
        id: nuevoId(),
        puesto: recortar(exp.puesto, MAX_PUESTO),
        empresa: recortar(exp.empresa, MAX_PUESTO),
        detalle: recortar(exp.detalle, MAX_DETALLE),
      })),
    };
  } catch {
    return estructurarCvPorHeuristica(limpio);
  }
}
