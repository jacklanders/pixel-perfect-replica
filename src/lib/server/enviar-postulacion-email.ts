/**
 * Lógica del envío de una postulación por Gmail (server-only).
 *
 * Separada del server fn `enviarEmailGmail` para poder testearla en unit con
 * un cliente Supabase fake (el server fn de TanStack exige el contexto de
 * runtime de Start para ejecutarse).
 */

import { enviarPostulacionGmail } from "@/lib/server/gmail-send";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

export const enviarEmailGmailSchema = z.object({
  applicationId: z.string().uuid(),
  generated_body: z.string().optional(),
  destination_email: z.string().email().optional(),
  generated_subject: z.string().optional(),
  includeCopy: z.boolean().optional().default(false),
  resumeId: z.string().uuid().nullable().optional(),
  adjuntoStoragePath: z.string().optional(),
  adjuntoFileName: z.string().optional(),
  adjuntoMimeType: z.string().optional(),
});

export type EnviarEmailGmailInput = z.infer<typeof enviarEmailGmailSchema>;

/** Filas serializables que vuelven del cliente Supabase (para el check de Start). */
type SerializableRow = Record<string, string | number | boolean | null | undefined>;

export async function enviarEmailGmailCore(argv: {
  supabase: SupabaseClient;
  userId: string;
  email: string;
  data: EnviarEmailGmailInput;
}): Promise<SerializableRow & { messageId: string }> {
  const { supabase, userId, email, data } = argv;

  // 1. Leer application completa
  const { data: app, error: appError } = await supabase
    .from("applications")
    .select("*, job_posts(*), resumes(id, title)")
    .eq("id", data.applicationId)
    .eq("user_id", userId)
    .single();

  if (appError || !app) throw new Error("Postulación no encontrada");

  // 2. Verificar límite diario
  const { data: limitResult, error: limitError } = await supabase.rpc("increment_daily_usage", {
    p_limit: 2,
  });
  if (limitError) throw new Error(limitError.message);

  const allowed = (limitResult as { allowed: boolean }[])[0]?.allowed ?? false;
  if (!allowed) {
    throw new Error("Límite diario alcanzado. Podés generar hasta 2 postulaciones por día.");
  }

  // A partir de acá la reserva quedó consumida (allowed=true). Si el envío
  // falla, la liberamos para no gastar cuota en envíos fallidos ("cuota solo
  // en éxito"). Se confirma (no se revierte) únicamente al marcar como enviada.
  try {
    // 3. Preparar datos del email
    const subject = data.generated_subject ?? app.generated_subject ?? "Postulación";
    const body = data.generated_body ?? app.generated_body ?? "";
    const toEmail = data.destination_email ?? app.destination_email ?? "";
    const fromEmail = email ?? "";
    if (!fromEmail) throw new Error("No se pudo determinar el email del remitente");

    // 3b. Adjunto: o un archivo temporal subido (PDF/DOCX), o el CV seleccionado.
    // Si el usuario eligió "Subir archivo", forzamos resumeId = null para no duplicar.
    const adjunto =
      data.adjuntoStoragePath && data.adjuntoFileName && data.adjuntoMimeType
        ? {
            storagePath: data.adjuntoStoragePath,
            fileName: data.adjuntoFileName,
            mimeType: data.adjuntoMimeType,
          }
        : undefined;

    const resumeId = data.resumeId !== undefined ? data.resumeId : app.resume_id;

    // 4. Enviar vía Gmail API
    const { messageId } = await enviarPostulacionGmail({
      userId,
      fromEmail,
      toEmail,
      subject,
      body,
      resumeId,
      includeCopy: data.includeCopy ?? false,
      ...(adjunto ? { adjunto } : {}),
    });

    // 5. Marcar como enviada
    const { data: row, error } = await supabase
      .from("applications")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        generated_body: data.generated_body,
        destination_email: data.destination_email,
        generated_subject: data.generated_subject,
      })
      .eq("id", data.applicationId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { ...row, messageId };
  } catch (err) {
    // El envío falló: liberar la reserva de cuota (la revocación no debe dejar
    // un envío fallido contando en el límite del día).
    try {
      await supabase.rpc("decrement_daily_usage");
    } catch {
      // La reversión no debe enmascarar el error original del envío.
    }
    throw err;
  }
}
