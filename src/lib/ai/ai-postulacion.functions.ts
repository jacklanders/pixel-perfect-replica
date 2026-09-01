import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";
import { createAIProvider, traducirErrorIA } from "./ai-provider";
import { PROMPT_APPLICATION_EMAIL_GENERATION } from "./prompts-postulacion";
import { cvATexto, perfilATexto } from "./ai.functions";
import { filaACv } from "@/lib/cv.model";
import { filaAPerfil } from "@/lib/perfil.model";
import type { ResumeRow } from "@/lib/supabase/types";

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
  .validator((input: unknown) =>
    z
      .object({
        raw_text: z.string().min(1),
        image_base64: z.string().optional(),
        image_mime_type: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const provider = createAIProvider();

    const prompt = `Sos Jack, un asistente de IA especializado en avisos de trabajo de Argentina.

Extraé los datos de este aviso${data.image_base64 ? " (que está en la imagen adjunta)" : ""} y devolvé UN SOLO objeto JSON válido (sin markdown, sin bloques de código, sin explicaciones adicionales):

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

    const images =
      data.image_base64 && data.image_mime_type
        ? [{ mimeType: data.image_mime_type, data: data.image_base64 }]
        : undefined;

    let response;
    try {
      response = await provider.generate({
        system:
          "Sos Jack, un asistente de IA especializado en avisos de trabajo de Argentina. Respondé ÚNICAMENTE con el JSON solicitado, sin markdown ni explicaciones.",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        ...(images ? { images } : {}),
      });
    } catch (err) {
      throw traducirErrorIA(err);
    }

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

/* ─── 1b. Generar el email de postulación con Jack ─── */
const generatedEmailSchema = z.object({
  asunto: z.string().default(""),
  cuerpo: z.string().default(""),
  advertencias: z.array(z.string()).default([]),
  preguntas: z.array(z.string()).default([]),
  cumpleRequisitos: z.boolean().optional(),
});

type VacanteEmail = {
  role: string;
  company: string;
  location: string | null;
  mandatory_subject: string | null;
  requirements_required: string[];
  requirements_preferred: string[];
};

/** Genera el asunto y cuerpo del email con la IA. No toca la DB. */
async function generarEmailConJack(
  cv: ReturnType<typeof filaACv>,
  perfil: ReturnType<typeof filaAPerfil> | null,
  vacante: VacanteEmail,
): Promise<{
  asunto: string;
  cuerpo: string;
  advertencias: string[];
  preguntas: string[];
  cumpleRequisitos: boolean | null;
}> {
  const cvTexto = cvATexto(cv, perfil);
  const perfilTexto = perfilATexto(perfil);

  const prompt = `${PROMPT_APPLICATION_EMAIL_GENERATION}

DATOS DEL PERFIL:
${perfilTexto}

DATOS DEL CV:
${cvTexto}

DATOS DE LA VACANTE:
- Puesto: ${vacante.role}
- Empresa: ${vacante.company}
- Ubicación: ${vacante.location ?? "no especificada"}
- Asunto obligatorio que pide el aviso: ${vacante.mandatory_subject ?? "(ninguno)"}
- Requisitos excluyentes: ${vacante.requirements_required.join("; ") || "(ninguno detectado)"}
- Requisitos deseables: ${vacante.requirements_preferred.join("; ") || "(ninguno detectado)"}

Respondé ÚNICAMENTE con el objeto JSON acordado (sin markdown):
{
  "asunto": "asunto generico profesional",
  "cuerpo": "cuerpo del email",
  "advertencias": [],
  "preguntas": [],
  "cumpleRequisitos": true
}`;

  const provider = createAIProvider();
  let response;
  try {
    response = await provider.generate({
      system:
        "Sos Jack, un asistente de IA para postulaciones laborales de Argentina. Respondé ÚNICAMENTE con el JSON solicitado, sin markdown ni explicaciones.",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
    });
  } catch (err) {
    throw traducirErrorIA(err);
  }

  const cleaned = response.content
    .replace(/```json\s?/gi, "")
    .replace(/```/g, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("La IA no devolvió un JSON válido. Intentá de nuevo o editá el mail a mano.");
  }

  const resultado = generatedEmailSchema.parse(parsed);
  return {
    asunto: resultado.asunto,
    cuerpo: resultado.cuerpo,
    advertencias: resultado.advertencias,
    preguntas: resultado.preguntas,
    cumpleRequisitos: resultado.cumpleRequisitos ?? null,
  };
}

export const generarEmailDePostulacionConJack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        postulacion_id: z.string().uuid(),
        resume_id: z.string().uuid(),
        role: z.string().min(1),
        company: z.string().min(1),
        location: z.string().nullable(),
        mandatory_subject: z.string().nullable(),
        requirements_required: z.array(z.string()),
        requirements_preferred: z.array(z.string()),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // 1. Verificar que la postulación exista y pertenezca al usuario
    const { data: aplicacion, error: errApp } = await context.supabase
      .from("applications")
      .select("id")
      .eq("id", data.postulacion_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (errApp || !aplicacion) {
      throw new Error("La postulación no existe o no pertenece a tu cuenta");
    }

    // 2. Leer el CV (debe ser del usuario)
    const { data: resume, error: errResume } = await context.supabase
      .from("resumes")
      .select("*")
      .eq("id", data.resume_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (errResume || !resume) {
      throw new Error("El CV seleccionado no pertenece a tu cuenta");
    }

    // 3. Leer el perfil para la firma/datos personales
    const { data: perfilFila } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();

    const cv = filaACv(resume as unknown as ResumeRow);
    const perfil = perfilFila ? filaAPerfil(perfilFila as Record<string, unknown>) : null;

    const email = await generarEmailConJack(cv, perfil, {
      role: data.role,
      company: data.company,
      location: data.location,
      mandatory_subject: data.mandatory_subject,
      requirements_required: data.requirements_required,
      requirements_preferred: data.requirements_preferred,
    });

    // 4. Guardar asunto y cuerpo generados en la postulación
    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (email.asunto) update["generated_subject"] = email.asunto;
    if (email.cuerpo) update["generated_body"] = email.cuerpo;

    const { error: errUpdate } = await context.supabase
      .from("applications")
      .update(update)
      .eq("id", data.postulacion_id)
      .eq("user_id", context.userId);

    if (errUpdate) throw new Error(errUpdate.message);

    return email;
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
        raw_text: z.string().min(1).or(z.literal("")),
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
        raw_text: data.raw_text || null,
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

    // 1b. Validar que el CV pertenezca al usuario antes de vincularlo a la
    // postulación. Evita que un cliente envíe un resume_id ajeno (IDOR).
    const { data: ownedResume, error: resumeErr } = await context.supabase
      .from("resumes")
      .select("*")
      .eq("id", data.resume_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (resumeErr || !ownedResume) {
      throw new Error("El CV seleccionado no pertenece a tu cuenta");
    }

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

    // 3. Generar asunto y cuerpo del mail con Jack (best-effort). Si la IA
    // falla (ej: 503) la postulación ya quedó creada y el usuario puede
    // editarla/regenerarla desde el detalle.
    const perfilFila = (
      await context.supabase
        .from("profiles")
        .select("*")
        .eq("user_id", context.userId)
        .maybeSingle()
    ).data;

    const cv = filaACv(ownedResume as unknown as ResumeRow);
    const perfil = perfilFila ? filaAPerfil(perfilFila as Record<string, unknown>) : null;

    let email = null;
    try {
      email = await generarEmailConJack(cv, perfil, {
        role: data.role,
        company: data.company,
        location: data.location,
        mandatory_subject: data.mandatory_subject,
        requirements_required: data.requirements_required,
        requirements_preferred: data.requirements_preferred,
      });
    } catch (err) {
      // No bloqueamos la creación: la postulación ya existe.
      console.error("No se pudo generar el email de postulación:", err);
    }

    if (email?.cuerpo || email?.asunto) {
      const updateEmail: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (email.asunto) updateEmail["generated_subject"] = email.asunto;
      if (email.cuerpo) updateEmail["generated_body"] = email.cuerpo;
      await context.supabase
        .from("applications")
        .update(updateEmail)
        .eq("id", app.id)
        .eq("user_id", context.userId);
    }

    return {
      applicationId: app.id,
      jobPostId: jobPost.id,
      emailGenerado: Boolean(email?.cuerpo),
    };
  });
