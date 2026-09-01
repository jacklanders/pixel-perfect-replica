import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";

const crearJobPostSchema = z.object({
  source_type: z.enum(["text", "image", "url"]),
  raw_text: z.string().min(1),
  extracted_json: z.record(z.unknown()).nullable().optional(),
  employer: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  closing_date: z.string().nullable().optional(),
});

export const crearJobPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(crearJobPostSchema)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("job_posts")
      .insert({ ...data, user_id: context.userId })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return row;
  });

export const listarJobPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("job_posts")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getJobPostById = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("job_posts")
      .select("*")
      .eq("id", (data as { id: string }).id)
      .eq("user_id", context.userId)
      .single();

    if (error) throw new Error(error.message);
    return row;
  });
