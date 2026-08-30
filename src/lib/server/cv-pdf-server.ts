/**
 * Generación de PDF como buffer (Uint8Array) para adjuntar en emails.
 * Server-only: reutiliza la lógica de cv.export.ts pero sin saveAs().
 */

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { Cv } from "@/lib/cv.model";
import type { Perfil } from "@/lib/perfil.model";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-AR");
  } catch {
    return iso;
  }
}

function splitLines(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  const rawLines = text.split("\n");
  for (const raw of rawLines) {
    let current = "";
    const words = raw.split(" ");
    for (const word of words) {
      if ((current + " " + word).trim().length > maxChars) {
        lines.push(current.trim());
        current = word;
      } else {
        current = current ? current + " " + word : word;
      }
    }
    if (current) lines.push(current.trim());
  }
  return lines.length ? lines : [""];
}

export async function generarPdfBuffer(
  cv: Cv,
  perfil: Perfil | null,
  nombre: string,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595.28, 841.89]);
  let { width, height } = page.getSize();
  const margin = 50;
  let y = height - margin;

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const drawText = (text: string, size: number, bold = false, color = rgb(0.1, 0.1, 0.1)) => {
    const f = bold ? fontBold : font;
    page.drawText(text, { x: margin, y, size, font: f, color });
    y -= size * 1.4;
  };

  const drawLine = () => {
    y -= 4;
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 0.5,
      color: rgb(0.75, 0.75, 0.75),
    });
    y -= 12;
  };

  // Header
  drawText(nombre || "Sin nombre", 22, true);
  drawText(cv.contenido.titular || "Resumen profesional", 12, false, rgb(0.35, 0.35, 0.35));
  const contacto = [perfil?.email, perfil?.ubicacion, perfil?.telefono].filter(Boolean).join(" · ");
  if (contacto) drawText(contacto, 10, false, rgb(0.45, 0.45, 0.45));
  y -= 10;
  drawLine();

  // Perfil
  drawText("PERFIL PROFESIONAL", 11, true, rgb(0.2, 0.2, 0.2));
  const perfilLines = splitLines(cv.contenido.perfil || "", 75);
  perfilLines.forEach((line) => drawText(line, 10));
  y -= 8;
  drawLine();

  // Experiencia
  drawText("EXPERIENCIA", 11, true, rgb(0.2, 0.2, 0.2));
  cv.contenido.experiencia.forEach((exp) => {
    if (y < 120) {
      const newPage = pdfDoc.addPage([595.28, 841.89]);
      page = newPage;
      ({ width, height } = page.getSize());
      y = height - margin;
    }
    drawText(exp.puesto || "Puesto", 11, true);
    drawText(exp.empresa || "Empresa", 10, false, rgb(0.4, 0.4, 0.4));
    const detalleLines = splitLines(exp.detalle || "", 80);
    detalleLines.forEach((line) => drawText("  " + line, 10));
    y -= 6;
  });

  // Skills
  if (perfil?.skills?.length) {
    if (y < 100) {
      const newPage = pdfDoc.addPage([595.28, 841.89]);
      page = newPage;
      ({ width, height } = page.getSize());
      y = height - margin;
    }
    drawText("HABILIDADES", 11, true, rgb(0.2, 0.2, 0.2));
    const skillsText = perfil.skills.join(" · ");
    const skillLines = splitLines(skillsText, 85);
    skillLines.forEach((line) => drawText(line, 10));
    y -= 8;
    drawLine();
  }

  // Footer
  y = 40;
  page.drawText(`Generado por Jack · ${formatDate(new Date().toISOString())}`, {
    x: margin,
    y,
    size: 8,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  return pdfDoc.save();
}
