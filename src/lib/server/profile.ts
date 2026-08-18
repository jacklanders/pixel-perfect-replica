import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type Profile = {
  user_id: string;
  nombre: string | null;
  email: string;
  telefono: string | null;
  ubicacion: string | null;
  rubro_objetivo: string | null;
  firma_mail: string | null;
  avatar_url: string | null;
  skills: string[];
};

/**
 * Lee el perfil del usuario autenticado. No recibe user_id como parámetro a
 * propósito: siempre usa auth.uid() vía RLS, así es imposible pedir el perfil
 * de otra persona aunque alguien manipule el frontend.
 */
export const getMyProfile = createServerFn({ method: "GET" }).handler(
  async (): Promise<Profile | null> => {
    const supabase = getSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, nombre, email, telefono, ubicacion, rubro_objetivo, firma_mail, avatar_url, skills")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (error) {
      console.error("[profile] error leyendo perfil:", error.message);
      return null;
    }
    return data as Profile | null;
  },
);

const updateProfileSchema = z.object({
  nombre: z.string().trim().max(200).optional(),
  telefono: z.string().trim().max(50).optional(),
  ubicacion: z.string().trim().max(200).optional(),
  rubro_objetivo: z.string().trim().max(200).optional(),
  firma_mail: z.string().trim().max(2000).optional(),
  skills: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .validator(updateProfileSchema)
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return { ok: false as const, error: "No autenticado" };
    }

    // .eq("user_id", ...) es cinturón-y-tirantes: la policy de RLS ya lo exige,
    // pero dejarlo explícito documenta la intención en el propio query.
    const { error } = await supabase
      .from("profiles")
      .update(data)
      .eq("user_id", userData.user.id);

    if (error) {
      console.error("[profile] error guardando perfil:", error.message);
      return { ok: false as const, error: error.message };
    }
    return { ok: true as const };
  });
