import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase/auth-middleware";
import {
  buildGmailAuthUrl,
  saveGmailTokens,
  disconnectGmail,
  isGmailConnected,
  exchangeCodeForTokens,
} from "@/lib/server/gmail-oauth";
import { getServiceClient } from "@/lib/server/supabase-service";

// ─── Generar URL de autorización Gmail ───
export const generarGmailAuthUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ origin: z.string().max(2000).optional() }).optional())
  .handler(async ({ data, context }) => {
    const random = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // El state viaja intacto de ida y vuelta en el redirect de Google. Si el
    // origen es una ruta interna válida, lo embebemos ("<random>|<origin>"):
    // así el callback puede volver a la postulación aunque sessionStorage no
    // sobreviva al vuelo (ej. abrir con 127.0.0.1 y Google volver a localhost,
    // que son orígenes distintos). El check CSRF del state sigue siendo exacto.
    const origin = data?.origin;
    const safeOrigin =
      origin && origin.startsWith("/") && !origin.startsWith("//") ? origin : undefined;
    const state = safeOrigin ? `${random}|${safeOrigin}` : random;

    const url = buildGmailAuthUrl(state);
    return { url, state };
  });

// ─── Procesar callback de Gmail OAuth ───
// La tabla oauth_connections es service_role-only (RLS de 0001_init.sql).
// oauth_connection_status NO existe en el Supabase real: "conectado" se deriva
// de la fila en oauth_connections. Escribir con el cliente anon del usuario
// falla siempre en silencio; acá se usa el service client (el middleware solo
// garantiza que haya un usuario autenticado).
export const procesarGmailCallback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ code: z.string().min(1) }))
  .handler(async ({ data, context }) => {
    const tokens = await exchangeCodeForTokens(data.code);
    await saveGmailTokens(context.userId, tokens, getServiceClient());
    return { ok: true as const };
  });

// ─── Desconectar Gmail ───
export const desconectarGmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await disconnectGmail(context.userId, getServiceClient());
    return { ok: true as const };
  });

// ─── Verificar estado de conexión Gmail ───
export const verificarEstadoGmail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return isGmailConnected(context.userId, getServiceClient());
  });
