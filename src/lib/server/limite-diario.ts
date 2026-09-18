/**
 * Resuelve el límite diario EFECTIVO de postulaciones para un usuario,
 * en un solo lugar compartido por la UI (getUsoDiario) y el corte real del
 * envío (enviarEmailGmailCore).
 *
 * La resolución real vive en la RPC SQL `obtener_limite_diario_efectivo`
 * (security definer, migración 0015) con 3 niveles de precedencia:
 *   1. Override por usuario → user_application_limits
 *   2. Default por rol      → app_settings
 *   3. Fallback por código  → 2 (user) / 10 (admin)
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface LimiteDiarioEfectivo {
  limite: number;
  rol: "user" | "admin";
  /** true si el número viene de un override por usuario (no del default). */
  override: boolean;
}

interface FilaLimiteDiario {
  limite: number;
  rol: string;
  override: boolean;
}

export async function obtenerLimiteDiarioEfectivo(argv: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<LimiteDiarioEfectivo> {
  const { supabase, userId } = argv;

  const { data, error } = await supabase.rpc("obtener_limite_diario_efectivo", {
    p_user_id: userId,
  });

  if (error) throw new Error(error.message);

  const fila = (data as FilaLimiteDiario[] | null)?.[0];
  if (!fila || typeof fila.limite !== "number" || !Number.isInteger(fila.limite)) {
    throw new Error("No se pudo determinar el límite diario");
  }

  return {
    limite: fila.limite,
    rol: fila.rol === "admin" ? "admin" : "user",
    override: fila.override === true,
  };
}
