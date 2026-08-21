import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Perfil } from "@/lib/perfil.model";

export const getMiPerfil = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = getSupabaseServerClient();
    const user = context.user;

    // Intentar obtener el perfil existente
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // Si no existe (PGRST116 = no rows), crearlo automáticamente
    if (!data || error?.code === "PGRST116") {
      console.log("[perfil] Perfil no encontrado, creando automáticamente para:", user.email);

      const newProfile = {
        user_id: user.id,
        nombre:
          (user as Record<string, unknown>).user_metadata?.full_name ||
          (user as Record<string, unknown>).user_metadata?.name ||
          user.email?.split("@")[0] ||
          "",
        email: user.email || "",
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

export const guardarPerfil = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({ context, data }: { context: { user: { id: string } }; data: Partial<Perfil> }) => {
      const supabase = getSupabaseServerClient();

      const { data: updated, error } = await supabase
        .from("profiles")
        .update({
          nombre: data.nombre,
          telefono: data.telefono,
          ubicacion: data.ubicacion,
          rubro_objetivo: data.rubro_objetivo,
          firma_mail: data.firma_mail,
          preferencias: data.preferencias,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", context.user.id)
        .select()
        .single();

      if (error) {
        console.error("[perfil] Error al guardar perfil:", error.message);
        throw new Error("No se pudo guardar el perfil");
      }

      return updated as Perfil;
    },
  );
