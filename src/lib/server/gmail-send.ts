/**
 * Envío de emails vía Gmail API usando MIME multipart.
 * Server-only.
 */

import { getServiceClient, getEnv } from "./supabase-service";
import { getValidAccessToken, forceRefreshAccessToken } from "@/lib/server/gmail-oauth";
import { validarTamanioAdjunto } from "@/lib/server/adjuntos";
import type { Cv } from "@/lib/cv.model";
import type { Perfil } from "@/lib/perfil.model";

export interface AdjuntoArchivo {
  storagePath: string;
  fileName: string;
  mimeType: string;
}

// ─── Base64 helpers (universal: Node/Bun/Workers) ───
function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeMimeHeader(text: string): string {
  return `=?UTF-8?B?${utf8ToBase64(text)}?=`; // Fixed: was missing closing ?=
}

// ─── Build MIME message ───
function buildMimeMessage(options: {
  from: string;
  to: string;
  subject: string;
  body: string;
  attachment?: { filename: string; mimeType: string; bytes: Uint8Array };
  bcc?: string;
}): string {
  const boundary = `----=_Part_${Math.random().toString(36).substring(2)}_${Date.now()}`;

  let mime = `MIME-Version: 1.0\r\n`;
  mime += `From: ${options.from}\r\n`;
  mime += `To: ${options.to}\r\n`;
  if (options.bcc) mime += `Bcc: ${options.bcc}\r\n`;
  mime += `Subject: ${encodeMimeHeader(options.subject)}\r\n`;
  mime += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n`;
  mime += `\r\n`;

  // Text part
  mime += `--${boundary}\r\n`;
  mime += `Content-Type: text/plain; charset="UTF-8"\r\n`;
  mime += `Content-Transfer-Encoding: base64\r\n`;
  mime += `\r\n`;
  mime += `${utf8ToBase64(options.body)}\r\n`;
  mime += `\r\n`;

  // Attachment part
  if (options.attachment) {
    mime += `--${boundary}\r\n`;
    mime += `Content-Type: ${options.attachment.mimeType}; name="${options.attachment.filename}"\r\n`;
    mime += `Content-Disposition: attachment; filename="${options.attachment.filename}"\r\n`;
    mime += `Content-Transfer-Encoding: base64\r\n`;
    mime += `\r\n`;
    mime += `${bytesToBase64(options.attachment.bytes)}\r\n`;
    mime += `\r\n`;
  }

  mime += `--${boundary}--\r\n`;
  return mime;
}

// ─── Error tipado de la API de Gmail ───
export class GmailApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "GmailApiError";
    this.status = status;
  }
}

// ─── Call Gmail API ───
async function sendGmailRaw(accessToken: string, rawBase64Url: string): Promise<{ id: string }> {
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: rawBase64Url }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new GmailApiError(res.status, `Gmail API error (${res.status}): ${err}`);
  }

  return res.json() as Promise<{ id: string }>;
}

// ─── Errores transitorios (429 rate-limit / 5xx) retryables con backoff ───
const TRANSIENT_STATUS = (status: number) => status === 429 || status >= 500;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function sendWithTransientRetry(
  attempt: () => Promise<{ id: string }>,
  maxRetries = 2,
): Promise<{ id: string }> {
  for (let i = 0; ; i++) {
    try {
      return await attempt();
    } catch (err) {
      if (!(err instanceof GmailApiError) || !TRANSIENT_STATUS(err.status) || i >= maxRetries) {
        throw err;
      }
      await delay(300 * 2 ** i);
    }
  }
}

// ─── Envío con retry por status ───
// 401 (token expirado/revocado) → forzar refresh y reintentar.
// 429 / 5xx (transitorios) → reintentar con backoff sin tocar el token.
async function sendGmailWithRetry(
  userId: string,
  rawBase64Url: string,
  supabase: ReturnType<typeof getServiceClient>,
): Promise<{ id: string }> {
  // En modo E2E (MOCK_GMAIL=true) no llamamos a la API de Gmail; el resto del
  // flujo (límite diario vía RPC, marcar sent, adjuntos en Storage) sigue real.
  if (getEnv("MOCK_GMAIL") === "true") {
    return { id: "mock-message-id" };
  }

  const accessToken = await getValidAccessToken(userId, supabase);
  try {
    return await sendGmailRaw(accessToken, rawBase64Url);
  } catch (err) {
    if (err instanceof GmailApiError && err.status === 401) {
      const newToken = await forceRefreshAccessToken(userId, supabase);
      return await sendWithTransientRetry(() => sendGmailRaw(newToken, rawBase64Url));
    }
    if (err instanceof GmailApiError && TRANSIENT_STATUS(err.status)) {
      return await sendWithTransientRetry(() => sendGmailRaw(accessToken, rawBase64Url));
    }
    throw err;
  }
}

// ─── Obtener CV como attachment ───
async function obtenerCvAttachment(
  userId: string,
  resumeId: string | null,
  supabase: ReturnType<typeof getServiceClient>,
): Promise<{ filename: string; mimeType: string; bytes: Uint8Array } | null> {
  if (!resumeId) return null;

  // 1. Leer resume
  const { data: resume, error } = await supabase
    .from("resumes")
    .select("*, profiles(user_id, nombre, email, ubicacion, telefono, skills)")
    .eq("id", resumeId)
    .eq("user_id", userId)
    .single();

  if (error || !resume) return null;

  // 2. Si es archivo subido (PDF/DOCX), devolver desde Storage
  if (
    (resume.source_type === "uploaded_pdf" || resume.source_type === "uploaded_docx") &&
    resume.file_path_original
  ) {
    const { data: fileData, error: fileError } = await supabase.storage
      .from("resumes")
      .download(resume.file_path_original);

    if (fileError || !fileData) return null;

    const bytes = new Uint8Array(await fileData.arrayBuffer());
    await validarTamanioAdjunto(bytes);

    const isPdf = resume.file_path_original.endsWith(".pdf");
    return {
      filename: resume.title ? `${resume.title}.pdf` : "CV.pdf",
      mimeType: isPdf
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      bytes,
    };
  }

  // 3. Si es CV generado por Jack, generar PDF on-the-fly
  const perfil = resume.profiles as unknown as Perfil | null;
  const cvData = resume.structured_json as unknown as Cv | null;
  if (!cvData) return null;

  const { generarPdfBuffer } = await import("@/lib/server/cv-pdf-server");

  const bytes = await generarPdfBuffer(cvData, perfil, perfil?.nombre ?? "CV");
  await validarTamanioAdjunto(bytes);

  return {
    filename: `${resume.title || "CV"}.pdf`,
    mimeType: "application/pdf",
    bytes,
  };
}

// ─── Adjunto por archivo temporal subido (PDF/DOCX) ───
async function obtenerAdjuntoArchivo(
  adjunto: AdjuntoArchivo,
  supabase: ReturnType<typeof getServiceClient>,
): Promise<{ filename: string; mimeType: string; bytes: Uint8Array } | null> {
  const { data: fileData, error: fileError } = await supabase.storage
    .from("resumes")
    .download(adjunto.storagePath);

  if (fileError || !fileData) {
    throw new Error("No se pudo leer el archivo adjuntado. Volvé a seleccionarlo.");
  }

  const bytes = new Uint8Array(await fileData.arrayBuffer());
  await validarTamanioAdjunto(bytes);

  return {
    filename: adjunto.fileName,
    mimeType: adjunto.mimeType,
    bytes,
  };
}

// ─── Validación de datos del email ───
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validarDatosEnvio(options: {
  fromEmail: string;
  toEmail: string;
  subject: string;
  body: string;
}): void {
  if (!options.fromEmail.trim()) {
    throw new Error("No se pudo determinar el email del remitente");
  }
  if (!EMAIL_RE.test(options.fromEmail.trim())) {
    throw new Error("El email del remitente no es válido");
  }
  if (!options.toEmail.trim()) {
    throw new Error("El email del destinatario no puede estar vacío");
  }
  if (!EMAIL_RE.test(options.toEmail.trim())) {
    throw new Error("El email del destinatario no es válido");
  }
  if (!options.subject.trim()) {
    throw new Error("El asunto de la postulación no puede estar vacío");
  }
  if (!options.body.trim()) {
    throw new Error("El cuerpo de la postulación no puede estar vacío");
  }
}

// ─── Función principal: enviar postulación por Gmail ───
export async function enviarPostulacionGmail(
  options: {
    userId: string;
    fromEmail: string;
    toEmail: string;
    subject: string;
    body: string;
    resumeId: string | null;
    includeCopy: boolean;
    adjunto?: AdjuntoArchivo | null;
  },
  supabase: ReturnType<typeof getServiceClient> = getServiceClient(),
): Promise<{ messageId: string }> {
  validarDatosEnvio({
    fromEmail: options.fromEmail,
    toEmail: options.toEmail,
    subject: options.subject,
    body: options.body,
  });

  // 1. Obtener adjunto: archivo temporal (PDF/DOCX subido) o CV guardado
  let attachment: { filename: string; mimeType: string; bytes: Uint8Array } | null = null;
  if (options.adjunto) {
    attachment = await obtenerAdjuntoArchivo(options.adjunto, supabase);
  } else {
    attachment = await obtenerCvAttachment(options.userId, options.resumeId, supabase);
  }

  // 2. Armar MIME
  const mimeMessage = buildMimeMessage({
    from: options.fromEmail,
    to: options.toEmail,
    subject: options.subject,
    body: options.body,
    ...(attachment ? { attachment } : {}),
    ...(options.includeCopy ? { bcc: options.fromEmail } : {}),
  });

  // 3. Codificar a base64url
  const rawBase64Url = toBase64Url(utf8ToBase64(mimeMessage));

  // 4. Enviar vía Gmail API (con retry por refresh)
  const result = await sendGmailWithRetry(options.userId, rawBase64Url, supabase);

  // 5. Limpiar adjunto temporal tras envío exitoso
  if (options.adjunto) {
    await supabase.storage
      .from("resumes")
      .remove([options.adjunto.storagePath])
      .catch(() => {});
  }

  return { messageId: result.id };
}
