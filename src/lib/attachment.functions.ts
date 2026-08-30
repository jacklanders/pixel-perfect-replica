import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";
import { getServiceClient } from "@/lib/server/supabase-service";
import {
  base64ToUint8Array,
  mimeAdjuntoValido,
  validarTamanioAdjunto,
} from "@/lib/server/adjuntos";

// ─── Subir adjunto temporal a Storage privado ───
// El archivo queda en resumes/{userId}/tmp/... y se borra tras el envío exitoso.
export const subirAdjuntoTemporal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        fileName: z.string().min(1).max(255),
        mimeType: z.string().min(1),
        fileBase64: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!mimeAdjuntoValido(data.fileName, data.mimeType)) {
      throw new Error("Solo se admiten archivos PDF o DOCX.");
    }

    const bytes = base64ToUint8Array(data.fileBase64);
    await validarTamanioAdjunto(bytes);

    const fileNameLimpio = data.fileName
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\.\./g, "")
      .slice(0, 150);

    const storagePath = `${context.userId}/tmp/${crypto.randomUUID()}/${fileNameLimpio}`;

    const { error } = await getServiceClient()
      .storage.from("resumes")
      .upload(storagePath, bytes, { contentType: data.mimeType });

    if (error) throw new Error(`No se pudo subir el adjunto: ${error.message}`);

    return {
      storagePath,
      fileName: fileNameLimpio,
      mimeType: data.mimeType,
      size: bytes.length,
    };
  });

// ─── Borrar adjunto temporal (limpieza best-effort) ───
export const borrarAdjuntoTemporal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ storagePath: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    if (!data.storagePath.startsWith(`${context.userId}/tmp/`)) {
      throw new Error("Path de adjunto inválido");
    }
    await getServiceClient().storage.from("resumes").remove([data.storagePath]);
    return { ok: true as const };
  });
