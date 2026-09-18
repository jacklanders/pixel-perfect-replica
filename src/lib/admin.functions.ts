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
  rol: "user" | "admin";
  limiteDiario: number;
  limiteOverride: boolean;
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

const establecerLimiteDiarioSchema = z.object({
  userId: z.string().uuid(),
  // null elimina el override y vuelve al default del rol (app_settings).
  dailyLimit: z.number().int().min(1).max(1000).nullable(),
  motivo: z.string().max(200).optional(),
});

// Upsert/delete del override por usuario (admin-only). El default del rol no
// toca: si no hay fila en user_application_limits, el resolver usar el de
// app_settings → código.
export const establecerLimiteDiarioUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAdmin])
  .validator(establecerLimiteDiarioSchema)
  .handler(async ({ data, context }) => {
    const service = getServiceClient();

    if (data.dailyLimit === null) {
      const { error } = await service
        .from("user_application_limits")
        .delete()
        .eq("user_id", data.userId);
      if (error) throw new Error(error.message);
      logger.info("limite diario: override eliminado", {
        userId: data.userId,
        by: context.userId,
      });
      return { userId: data.userId, dailyLimit: null, override: false };
    }

    const { data: fila, error } = await service
      .from("user_application_limits")
      .upsert(
        {
          user_id: data.userId,
          daily_limit: data.dailyLimit,
          updated_by: context.userId,
          updated_at: new Date().toISOString(),
          motivo: data.motivo ?? null,
        },
        { onConflict: "user_id" },
      )
      .select()
      .single();

    if (error) throw new Error(error.message);
    logger.info("limite diario: override actualizado", {
      userId: data.userId,
      dailyLimit: data.dailyLimit,
      by: context.userId,
    });
    return {
      userId: data.userId,
      dailyLimit: data.dailyLimit,
      override: true,
    };
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
        // oauth_connection_status no existe en el Supabase real: "conectado" =
        // fila en oauth_connections (una por usuario+provider).
        service
          .from("oauth_connections")
          .select("user_id", { count: "exact", head: true })
          .eq("provider", "google_gmail"),
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

    // Límite diario efectivo de cada reciente, resuelto con la MISMA rpc que usa
    // el corte del envío (obtener_limite_diario_efectivo, 0015): override por
    // usuario > default por rol (app_settings) > fallback por código.
    const recientes = (ultimas.data ?? []) as Array<{
      user_id: string;
      email: string;
      nombre: string | null;
      created_at: string;
    }>;
    const estadosLimite = await Promise.all(
      recientes.map(async (u) => {
        const { data, error } = await service.rpc("obtener_limite_diario_efectivo", {
          p_user_id: u.user_id,
        });
        if (error) throw new Error(error.message);
        const fila = (
          data as Array<{ limite: number; rol: string; override: boolean }> | null
        )?.[0];
        return [
          u.user_id,
          {
            limite: Number.isInteger(fila?.limite) ? (fila?.limite as number) : 2,
            rol: (fila?.rol === "admin" ? "admin" : "user") as "user" | "admin",
            override: fila?.override === true,
          },
        ] as const;
      }),
    );
    const limitePorUsuario = new Map(estadosLimite);

    return {
      totalUsuarios: usuarios.count ?? 0,
      totalCvs: cvs.count ?? 0,
      totalPostulaciones: postulaciones.count ?? 0,
      postulacionesEnviadas: enviadas.count ?? 0,
      totalVacantes: vacantes.count ?? 0,
      gmailConectados: gmail.count ?? 0,
      usoIAUltimos14Dias: [...porFecha.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)),
      usuariosRecientes: recientes.map((u) => {
        const estado = limitePorUsuario.get(u.user_id) ?? {
          limite: 2,
          rol: "user" as const,
          override: false,
        };
        return {
          userId: u.user_id,
          email: u.email,
          nombre: u.nombre,
          createdAt: u.created_at,
          cantidadCvs: cvsPorUsuario.get(u.user_id) ?? 0,
          rol: estado.rol,
          limiteDiario: estado.limite,
          limiteOverride: estado.override,
        };
      }),
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
