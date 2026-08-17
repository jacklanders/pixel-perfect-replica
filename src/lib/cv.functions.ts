import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";
import { filaACv, guardarCvSchema, type Cv } from "@/lib/cv.model";
import type { ResumeRow } from "@/lib/supabase/types";

export const getCvById = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<Cv> => {
    const { data: fila, error } = await context.supabase
      .from("resumes")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();

    if (error) throw new Error(error.message);
    return filaACv(fila as ResumeRow);
  });

export const getCvPrimario = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Cv | null> => {
    const { data, error } = await context.supabase
      .from("resumes")
      .select("*")
      .eq("user_id", context.userId)
      .eq("is_primary", true)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? filaACv(data as ResumeRow) : null;
  });

export const listarCvs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Cv[]> => {
    const { data, error } = await context.supabase
      .from("resumes")
      .select("*")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data as ResumeRow[]).map(filaACv);
  });

export const crearCv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ title: z.string().min(1).max(160).default("Mi CV") }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<Cv> => {
    const { count } = await context.supabase
      .from("resumes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId);

    const { data: creado, error } = await context.supabase
      .from("resumes")
      .insert({
        user_id: context.userId,
        title: data.title,
        source_type: "created_from_scratch",
        is_primary: (count ?? 0) === 0,
        structured_json: { titular: "", perfil: "", experiencia: [] },
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return filaACv(creado as ResumeRow);
  });

export const guardarCv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => guardarCvSchema.parse(input))
  .handler(async ({ data, context }): Promise<Cv> => {
    const { data: actual, error: errorLectura } = await context.supabase
      .from("resumes")
      .select("version")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();

    if (errorLectura) throw new Error(errorLectura.message);

    const { data: guardado, error } = await context.supabase
      .from("resumes")
      .update({
        title: data.title,
        structured_json: data.contenido,
        version: ((actual?.version as number | undefined) ?? 1) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return filaACv(guardado as ResumeRow);
  });

export const duplicarCv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<Cv> => {
    const { data: original, error: errorLectura } = await context.supabase
      .from("resumes")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();

    if (errorLectura) throw new Error(errorLectura.message);
    const fila = original as ResumeRow;

    const { data: copia, error } = await context.supabase
      .from("resumes")
      .insert({
        user_id: context.userId,
        title: `${fila.title} (copia)`,
        source_type: fila.source_type,
        is_primary: false,
        structured_json: fila.structured_json,
        extracted_text: fila.extracted_text,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return filaACv(copia as ResumeRow);
  });

export const borrarCv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("resumes")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });
