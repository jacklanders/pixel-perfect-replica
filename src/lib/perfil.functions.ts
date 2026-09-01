import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";
import { getServiceClient } from "@/lib/server/supabase-service";
import { base64ToUint8Array } from "@/lib/server/adjuntos";
import { filaAPerfil } from "@/lib/perfil.model";
import type { Perfil } from "@/lib/perfil.model";

const AVATAR_MIMES_VALIDOS = ["image/jpeg", "image/png", "image/webp"];
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

function extDesdeMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "png";
}

export const getMiPerfil = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;
    const userId = context.userId;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!data || error?.code === "PGRST116") {
      const meta = context.userMetadata as Record<string, unknown> | undefined;
      const newProfile = {
        user_id: userId,
        nombre:
          (meta?.["full_name"] as string) ||
          (meta?.["name"] as string) ||
          context.email?.split("@")[0] ||
          "",
        email: context.email || "",
        telefono: "",
        ubicacion: "",
        rubro_objetivo: "",
        firma_mail: "",
        preferencias: {},
      };

      const { data: inserted, error: insertError } = await supabase
        .from("profiles")
        .insert(newProfile)
        .select()
        .single();

      if (insertError) {
        throw new Error(`No se pudo crear el perfil: ${insertError.message}`);
      }

      return filaAPerfil(inserted);
    }

    if (error) {
      console.error("[perfil] Error al obtener perfil:", error.message);
      return null;
    }

    return filaAPerfil(data);
  });

const guardarPerfilSchema = z
  .object({
    nombre: z.string().optional(),
    telefono: z.string().optional(),
    ubicacion: z.string().optional(),
    rubroObjetivo: z.string().optional(),
    firmaMail: z.string().optional(),
    preferencias: z.record(z.unknown()).optional(),
  })
  .partial();

export const guardarPerfil = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => guardarPerfilSchema.parse(input))
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;

    const updateData: Record<string, unknown> = {};
    if (data.nombre !== undefined) updateData["nombre"] = data.nombre;
    if (data.telefono !== undefined) updateData["telefono"] = data.telefono;
    if (data.ubicacion !== undefined) updateData["ubicacion"] = data.ubicacion;
    if (data.rubroObjetivo !== undefined) updateData["rubro_objetivo"] = data.rubroObjetivo;
    if (data.firmaMail !== undefined) updateData["firma_mail"] = data.firmaMail;
    if (data.preferencias !== undefined) updateData["preferencias"] = data.preferencias;

    const { data: updated, error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("user_id", context.userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return updated as Perfil;
  });

// ─── Subir / cambiar avatar ───
// El avatar se guarda SIEMPRE en la misma ruta avatars/{userId}/avatar.<ext>,
// así `getPublicUrl` se mantiene estable y cada nuevo upload sobrescribe al
// anterior sin acumular archivos huérfanos.
export const subirAvatar = createServerFn({ method: "POST" })
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
    if (!AVATAR_MIMES_VALIDOS.includes(data.mimeType)) {
      throw new Error("Solo se admiten imágenes JPG, PNG o WebP.");
    }

    const bytes = base64ToUint8Array(data.fileBase64);
    if (bytes.length > AVATAR_MAX_BYTES) {
      throw new Error("La imagen excede el límite de 5MB. Elegí una foto más liviana.");
    }

    const ext = extDesdeMime(data.mimeType);
    const storagePath = `${context.userId}/avatar.${ext}`;

    const { error: uploadError } = await getServiceClient()
      .storage.from("avatars")
      .upload(storagePath, bytes, {
        contentType: data.mimeType,
        upsert: true,
      });

    if (uploadError) throw new Error(`No se pudo subir el avatar: ${uploadError.message}`);

    const { data: publicUrl } = getServiceClient()
      .storage.from("avatars")
      .getPublicUrl(storagePath);
    const avatarUrl = publicUrl.publicUrl;

    const { error: updateError } = await context.supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .select()
      .single();

    if (updateError) throw new Error(updateError.message);

    return { avatarUrl };
  });

// ─── Quitar avatar (vuelve a no tener foto) ───
export const quitarAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await getServiceClient()
      .storage.from("avatars")
      .remove([
        `${context.userId}/avatar.jpg`,
        `${context.userId}/avatar.png`,
        `${context.userId}/avatar.webp`,
      ])
      .catch(() => {});

    const { error } = await context.supabase
      .from("profiles")
      .update({ avatar_url: null, updated_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { avatarUrl: null };
  });
