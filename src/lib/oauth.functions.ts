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

// ─── Generar URL de autorización Gmail ───
export const generarGmailAuthUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const state = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const url = buildGmailAuthUrl(state);
    return { url, state };
  });

// ─── Procesar callback de Gmail OAuth ───
export const procesarGmailCallback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ code: z.string().min(1) }))
  .handler(async ({ data, context }) => {
    const tokens = await exchangeCodeForTokens(data.code);
    await saveGmailTokens(context.userId, tokens);
    return { ok: true as const };
  });

// ─── Desconectar Gmail ───
export const desconectarGmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await disconnectGmail(context.userId);
    return { ok: true as const };
  });

// ─── Verificar estado de conexión Gmail ───
export const verificarEstadoGmail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return isGmailConnected(context.userId);
  });
