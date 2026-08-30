import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";

const crearApplicationSchema = z.object({
  job_post_id: z.string(),
  resume_id: z.string().nullable().optional(),
  generated_subject: z.string(),
  required_subject: z.string().nullable().optional(),
  generated_body: z.string(),
  destination_email: z.string().email(),
});

export const crearApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(crearApplicationSchema)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("applications")
      .insert({
        ...data,
        user_id: context.userId,
        status: "pending",
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return row;
  });

export const listarApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("applications")
      .select("*, job_posts(*)")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  });

const actualizarStatusSchema = z.object({
  id: z.string(),
  status: z.enum(["pending", "sent", "discarded"]),
  discard_reason: z.string().nullable().optional(),
});

export const actualizarApplicationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(actualizarStatusSchema)
  .handler(async ({ data, context }) => {
    const update: Record<string, unknown> = {
      status: data.status,
      updated_at: new Date().toISOString(),
    };
    if (data.status === "sent") update["sent_at"] = new Date().toISOString();
    if (data.discard_reason !== undefined) update["discard_reason"] = data.discard_reason;

    const { data: row, error } = await context.supabase
      .from("applications")
      .update(update)
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return row;
  });

// ─── Enviar postulación con límite diario ───
export const enviarPostulacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ applicationId: z.string() }))
  .handler(async ({ data, context }) => {
    // 1. Verificar límite diario (transaccional en Postgres)
    const { data: limitResult, error: limitError } = await context.supabase.rpc(
      "increment_daily_usage",
      { p_limit: 2 },
    );

    if (limitError) throw new Error(limitError.message);

    const allowed = (limitResult as { allowed: boolean }[])[0]?.allowed ?? false;
    if (!allowed) {
      throw new Error("Límite diario alcanzado. Podés generar hasta 2 postulaciones por día.");
    }

    // 2. Marcar como enviada
    const { data: row, error } = await context.supabase
      .from("applications")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.applicationId)
      .eq("user_id", context.userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return row;
  });

// ─── Consultar uso diario real (para AppShell e indicadores) ───
export const getUsoDiario = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await context.supabase
      .from("daily_usage")
      .select("application_generations")
      .eq("user_id", context.userId)
      .eq("usage_date", today)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return {
      used_today: data?.application_generations ?? 0,
      remaining_today: Math.max(0, 2 - (data?.application_generations ?? 0)),
    };
  });
