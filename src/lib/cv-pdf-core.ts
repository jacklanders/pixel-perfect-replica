/**
 * Motor de generación de PDF para CVs. Server-only y client-safe (no usa fs
 * ni APIs de Node). Compartido entre la descarga del cliente (cv.export.ts)
 * y el buffer del servidor (cv-pdf-server.ts, usado para adjuntar en emails).
 *
 * Soporta:
 *  - 2 plantillas: "clasica" (ATS) y "moderna".
 *  - Foto en el encabezado (JPG/PNG) embebida en el PDF.
 *  - Paginación dinámica: abre una página nueva automáticamente cuando el
 *    contenido vertical no entra, sin hojas en blanco.
 *  - Experiencia con fechas, educación y habilidades por categoría.
 */

import {
  PDFDocument,
  rgb,
  StandardFonts,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type PDFPageDrawTextOptions,
} from "pdf-lib";
import type { Cv } from "@/lib/cv.model";
import type { Perfil } from "@/lib/perfil.model";
import type {
  CvContenido,
  CvEducacion,
  CvHabilidadCategoria,
  PlantillaCv,
} from "@/lib/supabase/types";

export type { PlantillaCv };

export const PLANTILLAS_CV: PlantillaCv[] = ["clasica", "moderna"];

export const LABEL_PLANTILLA: Record<PlantillaCv, string> = {
  clasica: "Clásica (ATS)",
  moderna: "Moderna",
};

const A4: [number, number] = [595.28, 841.89];
const MARGEN = 50;
const MARGEN_INFERIOR = 70;

const NEGRO = rgb(0.12, 0.12, 0.14);
const MEDIO = rgb(0.35, 0.35, 0.38);
const CLARO = rgb(0.55, 0.55, 0.58);
const GRIS = rgb(0.8, 0.8, 0.82);
const ACENTO = rgb(0.13, 0.42, 0.42);
const FONDO = rgb(0.94, 0.97, 0.97);
const BLANCO = rgb(1, 1, 1);

interface Ctx {
  doc: PDFDocument;
  page: PDFPage;
  width: number;
  height: number;
  y: number;
}

interface Fonts {
  font: PDFFont;
  fontBold: PDFFont;
}

export interface DatosPdf {
  cv: Cv;
  perfil: Perfil | null;
  nombre: string;
  plantilla?: PlantillaCv | undefined;
  /** Foto como dataURL (data:image/...;base64,...) ya resuelta por el llamador. */
  fotoBase64?: string | null | undefined;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-AR");
  } catch {
    return iso;
  }
}

function textoContacto(contenido: CvContenido, perfil: Perfil | null): string {
  const partes: Array<string | null | undefined> = [
    perfil?.email,
    contenido.contacto?.telefono || perfil?.telefono,
    contenido.contacto?.ubicacion || perfil?.ubicacion,
    contenido.disponibilidad ? `Disponibilidad: ${contenido.disponibilidad}` : null,
  ];
  return partes.filter(Boolean).join(" · ");
}

export async function generarPdf(opts: DatosPdf): Promise<Uint8Array> {
  const { cv, perfil, nombre, plantilla = "clasica", fotoBase64 } = opts;
  // Defensa ante contenido viejo/sin normalizar: el caller puede pasar un Cv
  // (con `.contenido`) o un structured_json plano. Arrays siempre existentes.
  const raw = (cv?.contenido ?? cv) as CvContenido;
  const contenido: CvContenido = {
    ...raw,
    experiencia: raw?.experiencia ?? [],
    educacion: raw?.educacion ?? [],
    habilidades: raw?.habilidades ?? [],
  };
  const doc = await PDFDocument.create();
  const page = doc.addPage(A4);
  const ctx: Ctx = { doc, page, width: A4[0], height: A4[1], y: A4[1] - MARGEN };

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fonts: Fonts = { font, fontBold };

  const foto = fotoBase64 ? await embedFoto(doc, fotoBase64) : null;

  const inp: RenderInput = { cv, perfil, nombre, contenido, foto };

  if (plantilla === "moderna") {
    renderModerna(ctx, fonts, inp);
  } else {
    renderClasica(ctx, fonts, inp);
  }

  // Footer común
  ctx.y = 40;
  ctx.page.drawText(`Generado por Jack · ${formatDate(new Date().toISOString())}`, {
    x: MARGEN,
    y: ctx.y,
    size: 8,
    font,
    color: CLARO,
  });

  return doc.save();
}

async function embedFoto(doc: PDFDocument, dataUrl: string): Promise<PDFImage | null> {
  const base64 = extractBase64(dataUrl);
  if (!base64) return null;
  try {
    const bytes = base64ToBytes(base64);
    // Intentar JPG primero; si falla, PNG.
    try {
      return await doc.embedJpg(bytes);
    } catch {
      return await doc.embedPng(bytes);
    }
  } catch {
    return null;
  }
}

interface RenderInput {
  cv: Cv;
  perfil: Perfil | null;
  nombre: string;
  contenido: CvContenido;
  foto: PDFImage | null;
}

// ─── Helpers de dibujo con paginación dinámica ───
function ensureSpace(ctx: Ctx, needed: number): void {
  if (ctx.y - needed < MARGEN_INFERIOR) {
    ctx.page = ctx.doc.addPage(A4);
    ctx.width = A4[0];
    ctx.height = A4[1];
    ctx.y = A4[1] - MARGEN;
  }
}

function drawText(
  ctx: Ctx,
  fonts: Fonts,
  text: string,
  size: number,
  opts?: {
    bold?: boolean;
    color?: ReturnType<typeof rgb>;
    x?: number;
    align?: "left" | "center" | "right";
  },
) {
  const f = opts?.bold ? fonts.fontBold : fonts.font;
  let x = opts?.x ?? MARGEN;
  ensureSpace(ctx, size * 1.4);
  if (opts?.align === "center") {
    x = (ctx.width - f.widthOfTextAtSize(text, size)) / 2;
  } else if (opts?.align === "right") {
    x = ctx.width - MARGEN - f.widthOfTextAtSize(text, size);
  }
  const options: PDFPageDrawTextOptions = { x, y: ctx.y, size, font: f };
  if (opts?.color) options.color = opts.color;
  ctx.page.drawText(text, options);
  ctx.y -= size * 1.4;
}

function drawLine(ctx: Ctx, color: ReturnType<typeof rgb> = GRIS) {
  ensureSpace(ctx, 16);
  ctx.y -= 4;
  ctx.page.drawLine({
    start: { x: MARGEN, y: ctx.y },
    end: { x: ctx.width - MARGEN, y: ctx.y },
    thickness: 0.5,
    color,
  });
  ctx.y -= 12;
}

function drawSectionTitle(ctx: Ctx, fonts: Fonts, title: string) {
  ensureSpace(ctx, 44);
  drawText(ctx, fonts, title.toUpperCase(), 11, { bold: true, color: ACENTO });
  drawLine(ctx, GRIS);
}

function drawWrapped(
  ctx: Ctx,
  fonts: Fonts,
  text: string,
  size: number,
  opts?: {
    color?: ReturnType<typeof rgb>;
    x?: number;
    maxChars?: number;
    bold?: boolean;
  },
) {
  const x = opts?.x ?? MARGEN;
  const maxChars = opts?.maxChars ?? 85;
  const f = opts?.bold ? fonts.fontBold : fonts.font;
  const lines = splitLines(text, maxChars);
  for (const line of lines) {
    ensureSpace(ctx, size * 1.3);
    const options: PDFPageDrawTextOptions = { x, y: ctx.y, size, font: f };
    if (opts?.color) options.color = opts.color;
    ctx.page.drawText(line, options);
    ctx.y -= size * 1.3;
  }
}

// ─── Plantilla clásica (ATS) ───
function renderClasica(ctx: Ctx, fonts: Fonts, inp: RenderInput) {
  const { perfil, nombre, contenido, foto } = inp;
  ctx.page.drawRectangle({
    x: 0,
    y: ctx.height - 8,
    width: ctx.width,
    height: 8,
    color: ACENTO,
  });

  // Encabezado con foto a la derecha
  const fotoW = foto ? 90 : 0;
  const textW = ctx.width - MARGEN * 2 - (fotoW + 20);
  drawText(ctx, fonts, nombre || "Sin nombre", 22, { bold: true });
  drawText(ctx, fonts, contenido.titular || "Resumen profesional", 12, { color: MEDIO });
  const contacto = textoContacto(contenido, perfil);
  if (contacto) {
    drawWrapped(ctx, fonts, contacto, 10, { color: CLARO, maxChars: Math.floor(textW / 5.5) });
  }
  if (foto) {
    const yFoto = ctx.y - fotoW;
    ctx.page.drawImage(foto, {
      x: ctx.width - MARGEN - fotoW,
      y: yFoto,
      width: fotoW,
      height: fotoW,
    });
  }
  ctx.y -= 8;
  drawLine(ctx);

  // Perfil
  drawSectionTitle(ctx, fonts, "Perfil profesional");
  drawWrapped(ctx, fonts, contenido.perfil || "", 10, { color: NEGRO, maxChars: 90 });

  // Experiencia
  drawSectionTitle(ctx, fonts, "Experiencia");
  contenido.experiencia.forEach((exp) => {
    ensureSpace(ctx, 70);
    const fecha = [exp.fechaInicio, exp.actualmente ? "actualidad" : exp.fechaFin]
      .filter(Boolean)
      .join(" - ");
    drawText(ctx, fonts, exp.puesto || "Puesto", 12, { bold: true });
    if (exp.empresa || exp.ubicacion) {
      drawText(ctx, fonts, [exp.empresa, exp.ubicacion].filter(Boolean).join(" · "), 10, {
        color: MEDIO,
      });
    }
    if (fecha) drawText(ctx, fonts, fecha, 9, { color: CLARO });
    const detalle = (exp.detalle || "")
      .split("\n")
      .map((l) => "  " + l)
      .join("\n");
    drawWrapped(ctx, fonts, detalle, 10, { maxChars: 85 });
    ctx.y -= 8;
  });

  // Educación
  if (contenido.educacion.length) {
    drawSectionTitle(ctx, fonts, "Educación");
    contenido.educacion.forEach((edu) => drawItemEducacion(ctx, fonts, edu));
  }

  // Habilidades
  const habs = habilidadesParaMostrar(contenido, perfil);
  if (habs.length) {
    drawSectionTitle(ctx, fonts, "Habilidades");
    habs.forEach((h) => {
      ensureSpace(ctx, 30);
      drawText(ctx, fonts, h.categoria, 10, { bold: true });
      drawWrapped(ctx, fonts, h.items.join(" · "), 10, { color: MEDIO, maxChars: 90 });
      ctx.y -= 4;
    });
  }
}

// ─── Plantilla moderna ───
function renderModerna(ctx: Ctx, fonts: Fonts, inp: RenderInput) {
  const { perfil, nombre, contenido, foto } = inp;

  ctx.page.drawRectangle({
    x: 0,
    y: ctx.height - 150,
    width: ctx.width,
    height: 150,
    color: FONDO,
  });
  ctx.page.drawRectangle({
    x: 0,
    y: ctx.height - 150,
    width: 6,
    height: 150,
    color: ACENTO,
  });

  // Encabezado: foto a la derecha del bloque de color
  const fotoW = foto ? 96 : 0;
  const xFoto = ctx.width - MARGEN;
  const yFoto = ctx.height - 138;
  ctx.y = ctx.height - 38;
  drawText(ctx, fonts, nombre || "Sin nombre", 24, { bold: true, color: NEGRO });
  drawText(ctx, fonts, contenido.titular || "Resumen profesional", 13, { color: ACENTO });
  const contacto = textoContacto(contenido, perfil);
  if (contacto) {
    drawWrapped(ctx, fonts, contacto, 10, { color: MEDIO, maxChars: 60 });
  }
  if (foto) {
    ctx.page.drawImage(foto, { x: xFoto - fotoW, y: yFoto, width: fotoW, height: fotoW });
  }

  ctx.page.drawLine({
    start: { x: MARGEN, y: ctx.height - 162 },
    end: { x: ctx.width - MARGEN, y: ctx.height - 162 },
    thickness: 2,
    color: ACENTO,
  });
  ctx.y = ctx.height - 182;

  drawSectionTitle(ctx, fonts, "Perfil profesional");
  drawWrapped(ctx, fonts, contenido.perfil || "", 10, { color: NEGRO, maxChars: 90 });

  drawSectionTitle(ctx, fonts, "Experiencia");
  contenido.experiencia.forEach((exp) => {
    ensureSpace(ctx, 70);
    const fecha = [exp.fechaInicio, exp.actualmente ? "actualidad" : exp.fechaFin]
      .filter(Boolean)
      .join(" - ");
    drawText(ctx, fonts, exp.puesto || "Puesto", 12, { bold: true, color: NEGRO });
    if (exp.empresa || exp.ubicacion) {
      drawText(ctx, fonts, [exp.empresa, exp.ubicacion].filter(Boolean).join(" · "), 10, {
        color: ACENTO,
      });
    }
    if (fecha) drawText(ctx, fonts, fecha, 9, { color: CLARO });
    const detalle = (exp.detalle || "")
      .split("\n")
      .map((l) => "  " + l)
      .join("\n");
    drawWrapped(ctx, fonts, detalle, 10, { maxChars: 85 });
    ctx.y -= 8;
  });

  if (contenido.educacion.length) {
    drawSectionTitle(ctx, fonts, "Educación");
    contenido.educacion.forEach((edu) => drawItemEducacion(ctx, fonts, edu));
  }

  const habs = habilidadesParaMostrar(contenido, perfil);
  if (habs.length) {
    drawSectionTitle(ctx, fonts, "Habilidades");
    habs.forEach((h) => {
      ensureSpace(ctx, 30);
      drawText(ctx, fonts, h.categoria, 10, { bold: true, color: ACENTO });
      drawWrapped(ctx, fonts, h.items.join(" · "), 10, { color: NEGRO, maxChars: 90 });
      ctx.y -= 4;
    });
  }
}

function drawItemEducacion(ctx: Ctx, fonts: Fonts, edu: CvEducacion) {
  ensureSpace(ctx, 40);
  const titulo = edu.titulo || edu.institucion || "Formación";
  drawText(ctx, fonts, titulo, 11, { bold: true });
  const meta = [
    edu.institucion !== edu.titulo ? edu.institucion : null,
    edu.nivel,
    edu.anioFin ? `Año: ${edu.anioFin}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  if (meta) drawText(ctx, fonts, meta, 10, { color: MEDIO });
  ctx.y -= 4;
}

function habilidadesParaMostrar(
  contenido: CvContenido,
  perfil: Perfil | null,
): CvHabilidadCategoria[] {
  if (contenido.habilidades?.length) return contenido.habilidades;
  if (perfil?.skills?.length) return [{ categoria: "Habilidades", items: perfil.skills }];
  return [];
}

function extractBase64(dataUrl: string): string | null {
  if (dataUrl.startsWith("data:image/")) {
    const comma = dataUrl.indexOf(",");
    if (comma > 0) return dataUrl.slice(comma + 1);
  }
  return null;
}

function base64ToBytes(base64: string): Uint8Array {
  if (typeof atob === "function") {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  const buf = Buffer.from(base64, "base64");
  return new Uint8Array(buf);
}

function splitLines(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  const rawLines = text.split("\n");
  for (const raw of rawLines) {
    if (!raw.trim()) {
      lines.push(" ");
      continue;
    }
    let current = "";
    const words = raw.split(" ");
    for (const word of words) {
      if ((current + " " + word).trim().length > maxChars) {
        if (current) lines.push(current.trim());
        current = word;
      } else {
        current = current ? current + " " + word : word;
      }
    }
    if (current) lines.push(current.trim());
  }
  return lines.length ? lines : [""];
}
