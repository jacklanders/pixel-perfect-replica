import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";
import { perfilSchema, type Perfil, filaAPerfil } from "@/lib/perfil.model";

export const getMiPerfil = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Perfil> => {
    const { supabase, userId, email, userMetadata } = context;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data) return filaAPerfil(data);

    // Alta automática en el primer login, con nombre y mail de Google.
    const nombre =
      (userMetadata["full_name"] as string | undefined) ??
      (userMetadata["name"] as string | undefined) ??
      null;

    const { data: creado, error: errorAlta } = await supabase
      .from("profiles")
      .insert({ user_id: userId, email, nombre })
      .select("*")
      .single();

    if (errorAlta) throw new Error(errorAlta.message);
    return filaAPerfil(creado);
  });

export const guardarPerfil = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => perfilSchema.parse(input))
  .handler(async ({ data, context }): Promise<Perfil> => {
    const { supabase, userId, email } = context;

    const { data: guardado, error } = await supabase
      .from("profiles")
      .upsert(
        {
          user_id: userId,
          email,
          nombre: data.nombre || null,
          telefono: data.telefono || null,
          ubicacion: data.ubicacion || null,
          rubro_objetivo: data.rubroObjetivo || null,
          firma_mail: data.firmaMail || null,
          preferencias: { resumen: data.resumen, skills: data.skills },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return filaAPerfil(guardado);
  });
