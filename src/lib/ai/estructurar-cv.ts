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
import type {
  CvContenido,
  CvEducacion,
  CvExperiencia,
  CvHabilidadCategoria,
} from "@/lib/supabase/types";

const MAX_PERFIL = 3000;
const MAX_DETALLE = 2000;
const MAX_PUESTO = 160;
const MAX_TITULAR = 200;
const MAX_EXPERIENCIAS = 8;
const MAX_EDUCACION = 6;
const MAX_HABILIDAD_CAT = 8;

const resumenSchema = z.object({
  titular: z.string().default(""),
  perfil: z.string().default(""),
  disponibilidad: z.string().optional(),
  contacto: z
    .object({
      telefono: z.string().optional(),
      email: z.string().optional(),
      ubicacion: z.string().optional(),
    })
    .optional(),
  experiencia: z
    .array(
      z.object({
        puesto: z.string().default(""),
        empresa: z.string().default(""),
        fechaInicio: z.string().optional(),
        fechaFin: z.string().optional(),
        actualmente: z.boolean().optional(),
        ubicacion: z.string().optional(),
        detalle: z.string().default(""),
      }),
    )
    .default([]),
  educacion: z
    .array(
      z.object({
        institucion: z.string().default(""),
        titulo: z.string().default(""),
        nivel: z.string().optional(),
        anioFin: z.string().optional(),
        ubicacion: z.string().optional(),
      }),
    )
    .default([]),
  habilidades: z
    .array(
      z.object({
        categoria: z.string().default(""),
        items: z.array(z.string()).default([]),
      }),
    )
    .default([]),
});

const HEADER_PERFIL = /^(perfil|resumen|about|profile|summary|acerca de|objetivo)/i;
const HEADER_EXPERIENCIA =
  /^(experienc|exp[- ]?laboral|historial laboral|trayectoria|work (experience|history)|professional experience|trabajo)/i;
const HEADER_EDUCACION =
  /^(educaci[oó]n|education|formaci[oó]n acad[ée]mica|estudios|academic|estudios formales|formaci[oó]n)/i;
const HEADER_HABILIDADES =
  /^(habilidades|skills|competencias|aptitudes|technologies|technical skills|hard skills)/i;
const HEADER_OTRO =
  /^(idiomas|languages|datos personales|contacto|cursos|certificaciones|licencias|referencias|intereses|certifications|licenses|interests)/i;

const PARSE_PUESTO_EMPRESA = /^(.{1,120}?)\s+(?:a[tn]\s+|en\s+|-|–|—|@|,\s+|para\s+)(.{1,120})$/;

// Fechas: AAAA, AAAA-MM, "desde AAAA hasta AAAA/presente/actualidad", o "AAAA - AAAA".
// Captura en dos grupos opcionales. Es más un reconocimiento de contexto que un parseo
// estricto; el valor se conserva como texto para no perder información.
const PARSE_FECHAS =
  /(\d{4}(?:[-/]\d{1,2})?)\s*[-–—a]{1,6}\s*(\d{4}(?:[-/]\d{1,2})?|present[ea]|hoy|actual|actualidad|a la fecha|al presente)?/i;
const PARSE_ANIO_FIN = /(\d{4})/;

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

  // Buscar fechas en las primeras líneas del bloque (pueden estar en la primer
  // línea como "2023 - 2024" o en una línea dedicada justo debajo del puesto).
  let fechaInicio: string | undefined;
  let fechaFin: string | undefined;
  let actualmente = false;

  const resto = lineas.slice(1);
  const lineaFechas = resto.find(
    (l) =>
      PARSE_FECHAS.test(l) && !l.startsWith("-") && !/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+$/i.test(l.trim()),
  );
  if (lineaFechas) {
    const fm = lineaFechas.match(PARSE_FECHAS)!;
    fechaInicio = fmt(fm[1]);
    const finRaw = fm[2];
    if (finRaw && /^(present[ea]|hoy|actual|actualidad|a la fecha|al presente)$/i.test(finRaw)) {
      actualmente = true;
    } else if (finRaw) {
      fechaFin = fmt(finRaw);
    }
  }
  // Si la primera línea tiene formato "Puesto ... — 2021 - 2023"
  if (!fechaInicio && primera.match(PARSE_FECHAS)) {
    const fm = primera.match(PARSE_FECHAS)!;
    fechaInicio = fmt(fm[1]);
    const finRaw = fm[2];
    if (finRaw && /^(present[ea]|hoy|actual|actualidad|a la fecha|al presente)$/i.test(finRaw)) {
      actualmente = true;
    } else if (finRaw) {
      fechaFin = fmt(finRaw);
    }
  }

  const detalle = recortar(
    lineas
      .slice(1)
      .filter((l) => l !== lineaFechas)
      .join(" "),
    MAX_DETALLE,
  );

  return {
    id: nuevoId(),
    puesto,
    empresa,
    detalle,
    fechaInicio,
    fechaFin,
    actualmente: actualmente || undefined,
  };
}

function fmt(v: string | undefined): string | undefined {
  if (!v) return undefined;
  // Normaliza "2024-1" -> "2024-01" y "2024/01" -> "2024-01"
  const m = v.match(/^(\d{4})\s*[-/]\s*(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2]!.padStart(2, "0")}`;
  return v.trim();
}

function parsearEducacion(bloque: string): CvEducacion {
  const lineas = bloque
    .split(/\r?\n/)
    .map((l) => l.replace(/^[•·▪\-*]\s*/, "").trim())
    .filter(Boolean);
  const primera = lineas[0] ?? "";
  // "Ingeniería en Sistemas — UTN" | "UTN — Ingeniería"
  let institucion = "";
  let titulo = primera;
  let anioFin: string | undefined;
  if (primera.includes("—") || primera.includes("-")) {
    const partes = primera
      .split(/\s*(?:—|-|–)\s*/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (partes.length >= 2) {
      // Intentar detectar cuál es la institución: suele ser el acrónimo o venir
      // después. Simple heurística: si la primera parte parece institución la usamos.
      institucion = partes[0]!;
      titulo = partes.slice(1).join(" — ");
    }
  }
  const anioMatch =
    primera.match(PARSE_ANIO_FIN) ?? lineas.slice(1).join(" ").match(PARSE_ANIO_FIN);
  if (anioMatch) anioFin = fmt(anioMatch[1]);
  return {
    institucion: institucion ? recortar(institucion, 200) : "",
    titulo: titularFin(primera),
    anioFin,
  };
}

function titularFin(primera: string): string {
  // Saca el año para no dejarlo en el título
  return recortar(
    primera
      .replace(PARSE_ANIO_FIN, "")
      .replace(/\s*(?:—|-|–)\s*$/, "")
      .trim(),
    200,
  );
}

function parsearHabilidades(texto: string): CvHabilidadCategoria[] {
  const lineas = texto
    .split(/\r?\n/)
    .map((l) => l.replace(/^[•·▪\-*]\s*/, "").trim())
    .filter(Boolean);
  const categorias: CvHabilidadCategoria[] = [];
  let actual: CvHabilidadCategoria | null = null;

  // Detecta "Categoria: items" o "Categoria" seguido de items en líneas siguientes.
  const HEADER_CATEGORIA = /^([A-Za-zÁÉÍÓÚÑáéíóúñ ]{1,80})\s*:\s*(.+)$/;

  for (const linea of lineas) {
    if (!linea) continue;
    const match = linea.match(HEADER_CATEGORIA);
    if (match) {
      // Línea de categoría "Categoria: items"
      actual = { categoria: match[1]!.trim(), items: [] };
      categorias.push(actual);
      const items = match[2]!.split(/[,;•]/)
        .map((s) => s.trim())
        .filter(Boolean);
      actual.items.push(...items);
    } else if (actual) {
      // Items sueltos bajo la categoría actual
      const items = linea
        .split(/[,;•]/)
        .map((s) => s.trim())
        .filter(Boolean);
      actual.items.push(...items);
    } else {
      // Sin categorías: meter todo en una categoría "General"
      if (!categorias[0] || categorias[0].categoria !== "General") {
        categorias.unshift({ categoria: "General", items: [] });
      }
      const items = linea
        .split(/[,;•]/)
        .map((s) => s.trim())
        .filter(Boolean);
      categorias[0]!.items.push(...items);
    }
  }

  return categorias
    .map((c) => ({
      categoria: recortar(c.categoria, 160),
      items: c.items.map((i) => recortar(i, 120)).filter(Boolean),
    }))
    .filter((c) => c.items.length > 0)
    .slice(0, MAX_HABILIDAD_CAT);
}

function nuevoId(): string {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `exp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Estructura un CV sin IA: reconoce headers incluso sin línea en blanco previa. */
export function estructurarCvPorHeuristica(texto: string): CvContenido {
  const resultado: CvContenido = {
    titular: "",
    perfil: "",
    experiencia: [],
    educacion: [],
    habilidades: [],
  };

  const bloques = texto
    .split(/\r?\n\r?\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  if (bloques.length === 0) return resultado;

  resultado.titular = recortar(bloques[0]!.split(/\r?\n/)[0] ?? "", MAX_TITULAR);

  let seccion: "perfil" | "experiencia" | "educacion" | "habilidades" | "otra" = "perfil";
  const perfilPartes: string[] = [];
  const educacionBloques: string[] = [];
  const habilidadesBloques: string[] = [];

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
    } else if (HEADER_EDUCACION.test(primera)) {
      seccion = "educacion";
      contenido = lineas.slice(1);
    } else if (HEADER_HABILIDADES.test(primera)) {
      seccion = "habilidades";
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

    if (seccion === "perfil") {
      if (contenido.length > 0) perfilPartes.push(contenido.join("\n"));
    } else if (seccion === "experiencia") {
      if (contenido.length > 0 && resultado.experiencia.length < MAX_EXPERIENCIAS) {
        resultado.experiencia.push(parsearExperiencia(contenido.join("\n")));
      }
    } else if (seccion === "educacion") {
      if (contenido.length > 0) {
        educacionBloques.push(contenido.join("\n"));
      }
    } else if (seccion === "habilidades") {
      if (contenido.length > 0) {
        habilidadesBloques.push(contenido.join("\n"));
      }
    }
  }

  if (perfilPartes.length > 0) {
    resultado.perfil = recortar(perfilPartes.join(" "), MAX_PERFIL);
  }
  if (educacionBloques.length > 0) {
    const educacionLista: CvEducacion[] = [];
    for (const bloque of educacionBloques) {
      const e = parsearEducacion(bloque);
      if (e.institucion || e.titulo) {
        educacionLista.push(e);
        if (educacionLista.length >= MAX_EDUCACION) break;
      }
    }
    resultado.educacion = educacionLista;
  }
  if (habilidadesBloques.length > 0) {
    const habilidades: CvHabilidadCategoria[] = [];
    for (const bloque of habilidadesBloques) {
      habilidades.push(...parsearHabilidades(bloque));
      if (habilidades.length >= MAX_HABILIDAD_CAT) break;
    }
    resultado.habilidades = habilidades;
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
      disponibilidad: validado.disponibilidad ? recortar(validado.disponibilidad, 160) : undefined,
      contacto:
        validado.contacto &&
        (validado.contacto.telefono || validado.contacto.email || validado.contacto.ubicacion)
          ? {
              telefono: validado.contacto.telefono?.trim() || undefined,
              email: validado.contacto.email?.trim() || undefined,
              ubicacion: validado.contacto.ubicacion?.trim() || undefined,
            }
          : undefined,
      experiencia: validado.experiencia.slice(0, MAX_EXPERIENCIAS).map((exp) => ({
        id: nuevoId(),
        puesto: recortar(exp.puesto, MAX_PUESTO),
        empresa: recortar(exp.empresa, MAX_PUESTO),
        fechaInicio: exp.fechaInicio ? fmt(exp.fechaInicio) : undefined,
        fechaFin: exp.fechaFin ? fmt(exp.fechaFin) : undefined,
        actualmente: exp.actualmente === true ? true : undefined,
        ubicacion: exp.ubicacion?.trim() || undefined,
        detalle: recortar(exp.detalle, MAX_DETALLE),
      })),
      educacion: validado.educacion
        .slice(0, MAX_EDUCACION)
        .map((edu) => ({
          institucion: recortar(edu.institucion, 200),
          titulo: recortar(edu.titulo, 200),
          nivel: edu.nivel?.trim() || undefined,
          anioFin: edu.anioFin ? fmt(edu.anioFin) : undefined,
          ubicacion: edu.ubicacion?.trim() || undefined,
        }))
        .filter((edu) => edu.institucion !== "" || edu.titulo !== ""),
      habilidades: validado.habilidades
        .slice(0, MAX_HABILIDAD_CAT)
        .map((h) => ({
          categoria: recortar(h.categoria, 160),
          items: h.items.map((i) => recortar(i, 120)).filter(Boolean),
        }))
        .filter((h) => h.categoria !== "" && h.items.length > 0),
    };
  } catch {
    return estructurarCvPorHeuristica(limpio);
  }
}
