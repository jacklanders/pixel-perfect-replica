import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";
import { createAIProvider } from "./ai-provider";
import {
  PROMPT_JOB_REQUIREMENT_ANALYSIS,
  PROMPT_APPLICATION_EMAIL_GENERATION,
} from "./prompts-postulacion";

const VacanteExtraidaSchema = z.object({
  role: z.string().min(1),
  company: z.string().min(1),
  location: z.string().min(1),
  destinationEmail: z.string().email(),
  mandatorySubject: z.string().nullable(),
  requirementsRequired: z.array(z.string()),
  requirementsPreferred: z.array(z.string()),
  closingDate: z.string().nullable(),
  sourceNotes: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
});

const EmailGeneradoSchema = z.object({
  asunto: z.string().min(1),
  cuerpo: z.string().min(1),
  advertencias: z.array(z.string()),
  preguntas: z.array(z.string()),
  cumpleRequisitos: z.boolean(),
});

export const analizarVacanteConJack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      textoVacante: z.string().min(10),
    }),
  )
  .handler(async ({ data }) => {
    const provider = createAIProvider();
    const response = await provider.generate({
      system: PROMPT_JOB_REQUIREMENT_ANALYSIS,
      messages: [{ role: "user", content: data.textoVacante }],
    });

    const parsed = JSON.parse(response.content);
    const result = VacanteExtraidaSchema.parse(parsed);
    return result;
  });

export const generarEmailPostulacionConJack = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      jobPostId: z.string(),
      perfil: z.object({
        nombre: z.string(),
        rubro: z.string(),
        experiencia: z.string(),
        skills: z.string(),
        firma: z.string(),
      }),
      cvResumen: z.string().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    // 1. Traer la vacante
    const { data: jobPost, error: errJob } = await context.supabase
      .from("job_posts")
      .select("*")
      .eq("id", data.jobPostId)
      .eq("user_id", context.userId)
      .single();

    if (errJob || !jobPost) throw new Error("Vacante no encontrada");

    const extracted = jobPost.extracted_json as Record<string, unknown> | null;
    if (!extracted) throw new Error("La vacante no tiene datos extraídos");

    // 2. Armar el mensaje con perfil + vacante
    const perfilContexto = `
PERFIL DEL USUARIO:
- Nombre: ${data.perfil.nombre}
- Rubro: ${data.perfil.rubro}
- Experiencia: ${data.perfil.experiencia}
- Skills: ${data.perfil.skills}
- Firma: ${data.perfil.firma}
${data.cvResumen ? `- Resumen CV: ${data.cvResumen}` : ""}

VACANTE:
- Puesto: ${extracted["role"] ?? "No especificado"}
- Empresa: ${extracted["company"] ?? "No especificada"}
- Requisitos excluyentes: ${JSON.stringify(extracted["requirementsRequired"] ?? [])}
- Requisitos deseables: ${JSON.stringify(extracted["requirementsPreferred"] ?? [])}
`;

    const provider = createAIProvider();
    const response = await provider.generate({
      system: PROMPT_APPLICATION_EMAIL_GENERATION,
      messages: [{ role: "user", content: perfilContexto }],
    });

    const parsed = JSON.parse(response.content);
    const result = EmailGeneradoSchema.parse(parsed);

    // 3. Si no cumple requisitos, NO guardamos nada
    if (!result.cumpleRequisitos) {
      return {
        ok: false,
        advertencias: result.advertencias,
        preguntas: result.preguntas,
        asunto: null,
        cuerpo: null,
      };
    }

    // 4. Guardar la application en estado pending
    const { data: appRow, error: errApp } = await context.supabase
      .from("applications")
      .insert({
        user_id: context.userId,
        job_post_id: data.jobPostId,
        resume_id: null,
        status: "pending",
        generated_subject: result.asunto,
        required_subject: (extracted["mandatorySubject"] as string) || null,
        generated_body: result.cuerpo,
        destination_email: String(extracted["destinationEmail"] ?? ""),
      })
      .select()
      .single();

    if (errApp) throw new Error(errApp.message);

    return {
      ok: true,
      applicationId: appRow.id,
      asunto: result.asunto,
      cuerpo: result.cuerpo,
      advertencias: result.advertencias,
      preguntas: result.preguntas,
      requiredSubject: (extracted["mandatorySubject"] as string) || null,
      destinationEmail: String(extracted["destinationEmail"] ?? ""),
    };
  });