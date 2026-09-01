/**
 * Generación de PDF como buffer (Uint8Array) para adjuntar en emails.
 * Server-only: delega en el motor compartido (cv-pdf-core) que soporta
 * 2 plantillas, foto y paginación dinámica.
 */

import { generarPdf, type PlantillaCv } from "@/lib/cv-pdf-core";
import type { Cv } from "@/lib/cv.model";
import type { Perfil } from "@/lib/perfil.model";

export interface OpcionesPdfServer {
  plantilla?: PlantillaCv;
  /** Foto del CV en base64 (dataURL del avatar/cv). */
  fotoBase64?: string | null;
}

export async function generarPdfBuffer(
  cv: Cv,
  perfil: Perfil | null,
  nombre: string,
  opciones: OpcionesPdfServer = {},
): Promise<Uint8Array> {
  return generarPdf({
    cv,
    perfil,
    nombre,
    plantilla: opciones.plantilla,
    fotoBase64: opciones.fotoBase64,
  });
}
