/**
 * Lógica del envío de una postulación por Gmail (server-only).
 *
 * Separada del server fn `enviarEmailGmail` para poder testearla en unit con
 * un cliente Supabase fake (el server fn de TanStack exige el contexto de
 * runtime de Start para ejecutarse).
 */

import { enviarPostulacionGmail, GmailEnvioAmbiguoError } from "@/lib/server/gmail-send";
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
  const { supabase, userId, data } = argv;

  // 1. Leer application completa
  const { data: app, error: appError } = await supabase
    .from("applications")
    .select("*, job_posts(*), resumes(id, title)")
    .eq("id", data.applicationId)
    .eq("user_id", userId)
    .single();

  if (appError || !app) throw new Error("Postulación no encontrada");

  // 1b. Guarda de idempotencia en server: la UI deshabilita el botón cuando
  // status === "sent", pero un cliente puede llamar el endpoint directo sobre
  // una postulación ya enviada. Acá se corta ese camino para no duplicar el
  // mail ni volver a gastar cuota.
  if (app.status === "sent") {
    throw new Error("Esa postulación ya fue enviada");
  }

  // 2. Verificar límite diario
  const { data: limitResult, error: limitError } = await supabase.rpc("increment_daily_usage", {
    p_limit: 2,
  });
  if (limitError) throw new Error(limitError.message);

  const allowed = (limitResult as { allowed: boolean }[])[0]?.allowed ?? false;
  if (!allowed) {
    throw new Error("Límite diario alcanzado. Podés generar hasta 2 postulaciones por día.");
  }

  // A partir de acá la reserva quedó consumida (allowed=true). La cuota se
  // revierte únicamente si el envío POR GMAIL fue rechazado de forma definitiva:
  // si el resultado es ambiguo (no se sabe si el correo salió) o el mail ya
  // salió y lo que falla es la persistencia posterior, devolver la cuota
  // dejaría que el reenvío duplique el correo y gaste doble cuota.
  // 3. Preparar datos del email
  // El remitente sale del perfil del usuario en la DB (email confirmado), no
  // del valor de sesión/payload que pudiera llegar manipulable. Así el "From:"
  // del correo saliente siempre es el email real y verificado del usuario.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("email")
    .eq("user_id", userId)
    .single();
  if (profileError || !profile?.email) {
    throw new Error("No se pudo determinar el email del remitente");
  }
  const fromEmail = profile.email;

  const subject = data.generated_subject ?? app.generated_subject ?? "Postulación";
  const body = data.generated_body ?? app.generated_body ?? "";
  const toEmail = data.destination_email ?? app.destination_email ?? "";

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
  let messageId: string;
  try {
    ({ messageId } = await enviarPostulacionGmail({
      userId,
      fromEmail,
      toEmail,
      subject,
      body,
      resumeId,
      includeCopy: data.includeCopy ?? false,
      ...(adjunto ? { adjunto } : {}),
    }));
  } catch (err) {
    // El envío por Gmail falló de forma DEFINITIVA (rechazo HTTP evidente, token
    // sin refrescar, etc.): liberar la reserva de cuota, porque no salió nada.
    // En cambio, si el resultado es AMBIGUO (GmailEnvioAmbiguoError: la petición
    // pudo haber llegado aunque no hubo respuesta, o hubo 200 ilegible), NO se
    // revierte: el correo pudo haber salido, y devolver la cuota habilitaría un
    // reintento que duplica el envío.
    if (!(err instanceof GmailEnvioAmbiguoError)) {
      try {
        await supabase.rpc("decrement_daily_usage");
      } catch {
        // La reversión no debe enmascarar el error original del envío.
      }
    }
    throw err;
  }

  // 5. Marcar como enviada. No se revierte la reserva acá (a diferencia del
  // catch de arriba): el mail ya salió por Gmail, la cuota ya se consumió.
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
}
