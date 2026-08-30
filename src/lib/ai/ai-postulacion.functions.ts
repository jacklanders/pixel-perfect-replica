import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";
import { createAIProvider } from "./ai-provider";

const extractedVacanteSchema = z.object({
  role: z.string().min(1),
  company: z.string().min(1),
  location: z.string().nullable(),
  destination_email: z.string().email().nullable(),
  mandatory_subject: z.string().nullable(),
  requirements_required: z.array(z.string()),
  requirements_preferred: z.array(z.string()),
  closing_date: z.string().nullable(),
  source_notes: z.string(),
  confidence: z.number().min(0).max(1),
});

/* ─── 1. Extraer datos del aviso con IA ─── */
export const analizarVacanteConJack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ raw_text: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const provider = createAIProvider();

    const prompt = `Sos Jack, un asistente de IA especializado en avisos de trabajo de Argentina.

Extraé los datos de este aviso y devolvé UN SOLO objeto JSON válido (sin markdown, sin bloques de código, sin explicaciones adicionales):

{
  "role": "título exacto del puesto",
  "company": "nombre de la empresa",
  "location": "ubicación o modalidad",
  "destination_email": "email de contacto para enviar CV",
  "mandatory_subject": "asunto obligatorio exacto si lo pide el aviso, o null",
  "requirements_required": ["requisito excluyente 1", "requisito excluyente 2"],
  "requirements_preferred": ["requisito deseable 1"],
  "closing_date": "YYYY-MM-DD o null",
  "source_notes": "notas breves sobre el aviso",
  "confidence": 0.0-1.0
}

Aviso:
${data.raw_text}`;

    const response = await provider.generate({
      system:
        "Sos Jack, un asistente de IA especializado en avisos de trabajo de Argentina. Respondé ÚNICAMENTE con el JSON solicitado, sin markdown ni explicaciones.",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });

    const cleaned = response.content
      .replace(/```json\s?/gi, "")
      .replace(/```/g, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error(
        "La IA no devolvió un JSON válido. Intentá de nuevo o pegá el aviso con mejor formato.",
      );
    }

    return extractedVacanteSchema.parse(parsed);
  });

/* ─── 2. Crear job_post + application en DB ─── */
export const crearVacanteYPostulacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        role: z.string().min(1),
        company: z.string().min(1),
        location: z.string().nullable(),
        destination_email: z.string().email().nullable(),
        mandatory_subject: z.string().nullable(),
        raw_text: z.string().min(1),
        source_type: z.enum(["text", "image", "url"]),
        closing_date: z.string().nullable(),
        resume_id: z.string().uuid(),
        requirements_required: z.array(z.string()),
        requirements_preferred: z.array(z.string()),
        confidence: z.number().min(0).max(1),
        source_notes: z.string(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // 1. Crear job_post
    const { data: jobPost, error: errJob } = await context.supabase
      .from("job_posts")
      .insert({
        user_id: context.userId,
        source_type: data.source_type,
        raw_text: data.raw_text,
        employer: data.company,
        role: data.role,
        location: data.location,
        closing_at: data.closing_date,
        extracted_json: {
          mandatory_subject: data.mandatory_subject,
          requirements_required: data.requirements_required,
          requirements_preferred: data.requirements_preferred,
          confidence: data.confidence,
          source_notes: data.source_notes,
        },
      })
      .select()
      .single();

    if (errJob) throw new Error(errJob.message);

    // 2. Crear application vinculada
    const { data: app, error: errApp } = await context.supabase
      .from("applications")
      .insert({
        user_id: context.userId,
        resume_id: data.resume_id,
        job_post_id: jobPost.id,
        status: "pending",
        generated_subject: `Postulación — ${data.role}`,
        required_subject: data.mandatory_subject,
        generated_body: "",
        destination_email: data.destination_email,
      })
      .select()
      .single();

    if (errApp) throw new Error(errApp.message);

    return { applicationId: app.id, jobPostId: jobPost.id };
  });
