import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";
import type { Perfil } from "@/lib/perfil.model";

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
        console.error("[perfil] Error al crear perfil:", insertError.message);
        return null;
      }

      return inserted as Perfil;
    }

    if (error) {
      console.error("[perfil] Error al obtener perfil:", error.message);
      return null;
    }

    return data as Perfil;
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
