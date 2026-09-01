import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
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

export const getApplicationById = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("applications")
      .select("*, job_posts(*), resumes(id, title)")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();

    if (error) throw new Error(error.message);
    return row;
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

const actualizarApplicationSchema = z.object({
  id: z.string().uuid(),
  generated_body: z.string().optional(),
  destination_email: z.string().email().optional(),
  generated_subject: z.string().optional(),
});

export const actualizarApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(actualizarApplicationSchema)
  .handler(async ({ data, context }) => {
    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (data.generated_body !== undefined) update["generated_body"] = data.generated_body;
    if (data.destination_email !== undefined) update["destination_email"] = data.destination_email;
    if (data.generated_subject !== undefined) update["generated_subject"] = data.generated_subject;

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
  .validator(
    z.object({
      applicationId: z.string(),
      generated_body: z.string().optional(),
      destination_email: z.string().email().optional(),
    }),
  )
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

    // 2. Actualizar body/email si el usuario los editó
    const update: Record<string, unknown> = {
      status: "sent",
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (data.generated_body !== undefined) update["generated_body"] = data.generated_body;
    if (data.destination_email !== undefined) update["destination_email"] = data.destination_email;

    // 3. Marcar como enviada
    const { data: row, error } = await context.supabase
      .from("applications")
      .update(update)
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
      limit: 2,
    };
  });

import {
  enviarEmailGmailCore,
  enviarEmailGmailSchema,
  type EnviarEmailGmailInput,
} from "@/lib/server/enviar-postulacion-email";
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit";

// Rate limit anti-spam por IP en el envío real de correos.
const EMAIL_SEND_RATE_LIMIT = { limit: 5, windowMs: 60_000 };

// ─── Enviar postulación REAL vía Gmail API ───
export const enviarEmailGmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(enviarEmailGmailSchema)
  .handler(async ({ data, context }) => {
    checkRateLimit(getClientIp(getRequest()), EMAIL_SEND_RATE_LIMIT);
    return enviarEmailGmailCore({
      supabase: context.supabase,
      userId: context.userId,
      email: context.email,
      data,
    });
  });
