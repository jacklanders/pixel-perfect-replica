/**
 * Helpers server-only para adjuntos de postulación.
 * Validación de MIME y tamaño (configurable vía app_settings.max_upload_size_mb).
 */

import { getServiceClient } from "./supabase-service";

export const ADJUNTO_MIMES_VALIDOS = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const EXT_A_MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/** Extensión permitida → mime canónico (útil para normalizar mimes vacíos del browser). */
export function mimeDesdeExtension(fileName: string): string | null {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return EXT_A_MIME[ext] ?? null;
}

export function mimeAdjuntoValido(fileName: string, mimeType: string): boolean {
  const porExtension = mimeDesdeExtension(fileName);
  if (porExtension) return true;
  return ADJUNTO_MIMES_VALIDOS.includes(mimeType);
}

/** Límite máximo en bytes, leído de app_settings (default 10MB). */
export async function getMaxUploadBytes(): Promise<number> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "max_upload_size_mb")
    .maybeSingle();

  const mb = Number(data?.value) || 10;
  return mb * 1024 * 1024;
}

export async function validarTamanioAdjunto(bytes: Uint8Array): Promise<void> {
  const maxBytes = await getMaxUploadBytes();
  if (bytes.length > maxBytes) {
    const maxMb = Math.max(1, Math.round(maxBytes / (1024 * 1024)));
    throw new Error(`El adjunto excede el límite de ${maxMb}MB. Elegí un PDF o DOCX más liviano.`);
  }
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
