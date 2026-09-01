import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";
import { requireAdmin } from "@/lib/supabase/admin-middleware";
import { getServiceClient } from "@/lib/server/supabase-service";
import { logger } from "@/lib/server/logger";
import type { AppSettingRow } from "@/lib/supabase/types";

const DIAS_USO = 14;

export interface DiaUsoIA {
  fecha: string;
  aplicacionesGeneradas: number;
  llamadasIA: number;
  costoUSD: number;
}

export interface UsuarioAdmin {
  userId: string;
  email: string;
  nombre: string | null;
  createdAt: string;
  cantidadCvs: number;
}

export interface DatosAdminDashboard {
  totalUsuarios: number;
  totalCvs: number;
  totalPostulaciones: number;
  postulacionesEnviadas: number;
  totalVacantes: number;
  gmailConectados: number;
  usoIAUltimos14Dias: DiaUsoIA[];
  usuariosRecientes: UsuarioAdmin[];
  appSettings: AppSettingRow[];
}

// Devuelve si el usuario en sesión es admin (para mostrar el link en el header,
// sin tirar 403).
export const getEsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ esAdmin: boolean }> => {
    const { data, error } = await context.supabase.rpc("has_role", {
      p_user_id: context.userId,
      p_role: "admin",
    });
    if (error || !data) return { esAdmin: false };
    return { esAdmin: true };
  });

export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth, requireAdmin])
  .handler(async (): Promise<DatosAdminDashboard> => {
    const service = getServiceClient();

    const [usuarios, cvs, postulaciones, enviadas, vacantes, gmail, usoCrudo, settings, ultimas] =
      await Promise.all([
        service.from("profiles").select("user_id", { count: "exact", head: true }),
        service.from("resumes").select("id", { count: "exact", head: true }),
        service.from("applications").select("id", { count: "exact", head: true }),
        service
          .from("applications")
          .select("id", { count: "exact", head: true })
          .eq("status", "sent"),
        service.from("job_posts").select("id", { count: "exact", head: true }),
        service
          .from("oauth_connection_status")
          .select("user_id", { count: "exact", head: true })
          .eq("connected", true),
        service
          .from("daily_usage")
          .select("usage_date, application_generations, ai_calls, cost_estimate_usd")
          .gte("usage_date", new Date(Date.now() - DIAS_USO * 86400000).toISOString().slice(0, 10)),
        service
          .from("app_settings")
          .select("key, value, updated_at")
          .order("key", { ascending: true }),
        service
          .from("profiles")
          .select("user_id, email, nombre, created_at")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

    if (settings.error) throw new Error(settings.error.message);

    const porFecha = new Map<string, DiaUsoIA>();
    for (const fila of (usoCrudo.data ?? []) as Array<{
      usage_date: string;
      application_generations: number | null;
      ai_calls: number | null;
      cost_estimate_usd: number | null;
    }>) {
      const fecha = fila.usage_date;
      const previo = porFecha.get(fecha) ?? {
        fecha,
        aplicacionesGeneradas: 0,
        llamadasIA: 0,
        costoUSD: 0,
      };
      previo.aplicacionesGeneradas += fila.application_generations ?? 0;
      previo.llamadasIA += fila.ai_calls ?? 0;
      previo.costoUSD += fila.cost_estimate_usd ?? 0;
      porFecha.set(fecha, previo);
    }

    // Conteo de CVs por usuario para los recientes (evitamos N+1 trayendo todos
    // los user_id de resumes de una vez y contando en memoria).
    const { data: resumenesClientes } = await service.from("resumes").select("user_id");
    const cvsPorUsuario = new Map<string, number>();
    for (const r of (resumenesClientes ?? []) as Array<{ user_id: string }>) {
      cvsPorUsuario.set(r.user_id, (cvsPorUsuario.get(r.user_id) ?? 0) + 1);
    }

    return {
      totalUsuarios: usuarios.count ?? 0,
      totalCvs: cvs.count ?? 0,
      totalPostulaciones: postulaciones.count ?? 0,
      postulacionesEnviadas: enviadas.count ?? 0,
      totalVacantes: vacantes.count ?? 0,
      gmailConectados: gmail.count ?? 0,
      usoIAUltimos14Dias: [...porFecha.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)),
      usuariosRecientes: (ultimas.data ?? []).map((u) => ({
        userId: u["user_id"] as string,
        email: u["email"] as string,
        nombre: u["nombre"] as string | null,
        createdAt: u["created_at"] as string,
        cantidadCvs: cvsPorUsuario.get(u["user_id"] as string) ?? 0,
      })),
      appSettings: (settings.data ?? []) as AppSettingRow[],
    };
  });

export const actualizarAppSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAdmin])
  .validator((input: unknown) =>
    z.object({ key: z.string().min(1).max(120), value: z.string().max(500) }).parse(input),
  )
  .handler(async ({ data }): Promise<AppSettingRow> => {
    const service = getServiceClient();
    const { data: fila, error } = await service
      .from("app_settings")
      .update({ value: data.value, updated_at: new Date().toISOString() })
      .eq("key", data.key)
      .select("key, value, updated_at")
      .single();

    if (error) throw new Error(error.message);

    logger.info("app_setting actualizado", { key: data.key });
    return fila as AppSettingRow;
  });
