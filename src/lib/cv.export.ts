import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { saveAs } from "file-saver";
import { generarPdf, type PlantillaCv } from "@/lib/cv-pdf-core";
import type { Cv } from "@/lib/cv.model";
import type { Perfil } from "@/lib/perfil.model";

export interface OpcionesDescarga {
  plantilla?: PlantillaCv;
  /** dataURL de la foto del CV (data:image/...;base64,...) */
  fotoBase64?: string | null;
}

export async function descargarPdf(
  cv: Cv,
  perfil: Perfil | null,
  nombre: string,
  opciones: OpcionesDescarga = {},
) {
  const bytes = await generarPdf({
    cv,
    perfil,
    nombre,
    plantilla: opciones.plantilla,
    fotoBase64: opciones.fotoBase64,
  });
  const blob = new Blob([bytes as unknown as ArrayBuffer], { type: "application/pdf" });
  saveAs(blob, `${cv.title || "CV"}.pdf`);
}

export async function descargarDocx(cv: Cv, perfil: Perfil | null, nombre: string) {
  const contenido = cv.contenido;
  const contacto = [
    perfil?.email,
    contenido.contacto?.telefono || perfil?.telefono,
    contenido.contacto?.ubicacion || perfil?.ubicacion,
    contenido.disponibilidad ? `Disponibilidad: ${contenido.disponibilidad}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const children: Paragraph[] = [
    new Paragraph({
      text: nombre || "Sin nombre",
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: contenido.titular || "Resumen profesional",
          bold: true,
          color: "555555",
        }),
      ],
      spacing: { after: 40 },
    }),
  ];

  if (contacto) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: contacto, size: 20, color: "777777" })],
        spacing: { after: 200 },
      }),
    );
  }

  children.push(
    new Paragraph({
      text: "PERFIL PROFESIONAL",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120 },
    }),
    new Paragraph({
      children: (contenido.perfil || "")
        .split("\n")
        .map((line) => new TextRun({ text: line, break: 1 })),
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: "EXPERIENCIA",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120 },
    }),
  );

  contenido.experiencia.forEach((exp) => {
    const fecha = [exp.fechaInicio, exp.actualmente ? "actualidad" : exp.fechaFin]
      .filter(Boolean)
      .join(" - ");
    const lugar = [exp.empresa, exp.ubicacion].filter(Boolean).join(" · ");
    children.push(
      new Paragraph({
        children: [new TextRun({ text: exp.puesto || "Puesto", bold: true })],
        spacing: { before: 120, after: 40 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: lugar, italics: true, color: "666666" }),
          fecha
            ? new TextRun({ text: `  (${fecha})`, color: "888888" })
            : new TextRun({ text: "" }),
        ],
        spacing: { after: 60 },
      }),
      new Paragraph({
        children: (exp.detalle || "")
          .split("\n")
          .map((line) => new TextRun({ text: line, break: 1 })),
        spacing: { after: 120 },
      }),
    );
  });

  if (contenido.educacion.length) {
    children.push(
      new Paragraph({
        text: "EDUCACIÓN",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 120 },
      }),
    );
    contenido.educacion.forEach((edu) => {
      const meta = [edu.institucion, edu.nivel, edu.anioFin ? `Año: ${edu.anioFin}` : null]
        .filter(Boolean)
        .join(" · ");
      children.push(
        new Paragraph({
          children: [new TextRun({ text: edu.titulo || edu.institucion, bold: true })],
          spacing: { before: 100, after: 40 },
        }),
        meta
          ? new Paragraph({
              children: [new TextRun({ text: meta, color: "666666" })],
              spacing: { after: 120 },
            })
          : new Paragraph({ text: "", spacing: { after: 120 } }),
      );
    });
  }

  const habilidades = contenido.habilidades?.length
    ? contenido.habilidades
    : perfil?.skills?.length
      ? [{ categoria: "Habilidades", items: perfil.skills }]
      : [];
  if (habilidades.length) {
    children.push(
      new Paragraph({
        text: "HABILIDADES",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 120 },
      }),
    );
    habilidades.forEach((h) => {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: h.categoria, bold: true })],
          spacing: { before: 80, after: 40 },
        }),
        new Paragraph({
          children: [new TextRun({ text: h.items.join(" · ") })],
          spacing: { after: 100 },
        }),
      );
    });
  }
  const doc = new Document({
    sections: [
      {
        properties: {
          page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${cv.title || "CV"}.docx`);
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
