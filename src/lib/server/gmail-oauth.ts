/**
 * Lógica server-only para OAuth de Gmail.
 *
 * - Genera URLs de autorización
 * - Intercambia codes por tokens
 * - Refresca access tokens automáticamente
 * - Revoca tokens al desconectar
 * - Guarda/lee tokens en Supabase (service_role únicamente)
 *
 * Seguridad:
 * - Los tokens NUNCA se envían al frontend.
 * - La tabla oauth_connections no tiene RLS para authenticated/anon.
 * - Solo service_role puede leer/escribir.
 * - Los tokens se encriptan con AES-256-GCM antes de guardar en DB.
 */

import { createClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// ─── Config ───
function getEnv(key: string): string | undefined {
  try {
    return process.env[key];
  } catch {
    return undefined;
  }
}

const GOOGLE_CLIENT_ID = getEnv("GOOGLE_CLIENT_ID") ?? "";
const GOOGLE_CLIENT_SECRET = getEnv("GOOGLE_CLIENT_SECRET") ?? "";
const GOOGLE_REDIRECT_URI =
  getEnv("GOOGLE_REDIRECT_URI") ?? "http://localhost:3000/auth/gmail-callback";
const OAUTH_ENCRYPTION_KEY =
  getEnv("OAUTH_ENCRYPTION_KEY") ?? getEnv("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  throw new Error("Faltan GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET");
}

// ─── Service Role Client (para tocar oauth_connections) ───
function getServiceClient() {
  const url = getEnv("VITE_SUPABASE_URL");
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ─── Encriptación AES-256-GCM ───
async function getCryptoKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(OAUTH_ENCRYPTION_KEY.slice(0, 32).padEnd(32, "0"));
  return crypto.subtle.importKey("raw", keyData, { name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]);
}

async function encrypt(text: string): Promise<string> {
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(text));
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decrypt(base64: string): Promise<string> {
  const key = await getCryptoKey();
  const combined = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

// ─── Google OAuth2 helpers ───
interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: GOOGLE_REDIRECT_URI,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google token exchange failed (${res.status}): ${err}`);
  }
  return res.json() as Promise<GoogleTokenResponse>;
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ access_token: string; expires_in: number }> {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google refresh token failed (${res.status}): ${err}`);
  }
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

export async function revokeGoogleToken(token: string): Promise<void> {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
}

// ─── Generar URL de autorización ───
export function buildGmailAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail.send",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// ─── Guardar tokens en DB ───
export async function saveGmailTokens(userId: string, tokens: GoogleTokenResponse): Promise<void> {
  const supabase = getServiceClient();
  const encryptedAccess = await encrypt(tokens.access_token);
  const encryptedRefresh = tokens.refresh_token ? await encrypt(tokens.refresh_token) : null;
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const { error } = await supabase.from("oauth_connections").upsert(
    {
      user_id: userId,
      provider: "google_gmail",
      encrypted_access_token: encryptedAccess,
      encrypted_refresh_token: encryptedRefresh,
      scopes: [tokens.scope],
      connected_at: new Date().toISOString(),
      revoked_at: null,
      expires_at: expiresAt,
    },
    { onConflict: "user_id,provider" },
  );

  if (error) throw new Error(`Error guardando tokens: ${error.message}`);

  // Actualizar flag de estado (legible por el usuario vía RLS)
  const { error: statusError } = await supabase.from("oauth_connection_status").upsert(
    {
      user_id: userId,
      provider: "google_gmail",
      connected: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" },
  );

  if (statusError) throw new Error(`Error actualizando estado: ${statusError.message}`);
}

// ─── Obtener access token válido (con auto-refresh) ───
export async function getValidAccessToken(userId: string): Promise<string> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("oauth_connections")
    .select("encrypted_access_token, encrypted_refresh_token, expires_at")
    .eq("user_id", userId)
    .eq("provider", "google_gmail")
    .single();

  if (error || !data) throw new Error("No hay conexión Gmail activa");

  const expiresAt = data.expires_at ? new Date(data.expires_at) : null;
  const now = new Date();
  const bufferMs = 60_000; // 1 minuto de margen

  // Si no expira pronto, devolver el access token actual
  if (expiresAt && expiresAt.getTime() - now.getTime() > bufferMs && data.encrypted_access_token) {
    return decrypt(data.encrypted_access_token);
  }

  // Necesita refresh
  if (!data.encrypted_refresh_token) {
    throw new Error("Token expirado y no hay refresh token disponible");
  }

  const refreshToken = await decrypt(data.encrypted_refresh_token);
  const refreshed = await refreshAccessToken(refreshToken);

  // Guardar nuevo access token
  const newEncryptedAccess = await encrypt(refreshed.access_token);
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  const { error: updateError } = await supabase
    .from("oauth_connections")
    .update({
      encrypted_access_token: newEncryptedAccess,
      expires_at: newExpiresAt,
    })
    .eq("user_id", userId)
    .eq("provider", "google_gmail");

  if (updateError) throw new Error(`Error actualizando token refrescado: ${updateError.message}`);

  return refreshed.access_token;
}

// ─── Desconectar Gmail ───
export async function disconnectGmail(userId: string): Promise<void> {
  const supabase = getServiceClient();

  // 1. Leer refresh token para revocarlo en Google
  const { data } = await supabase
    .from("oauth_connections")
    .select("encrypted_refresh_token")
    .eq("user_id", userId)
    .eq("provider", "google_gmail")
    .single();

  if (data?.encrypted_refresh_token) {
    try {
      const refreshToken = await decrypt(data.encrypted_refresh_token);
      await revokeGoogleToken(refreshToken);
    } catch {
      // Si falla la revocación, continuar igual para limpiar la DB
    }
  }

  // 2. Eliminar de oauth_connections
  await supabase
    .from("oauth_connections")
    .delete()
    .eq("user_id", userId)
    .eq("provider", "google_gmail");

  // 3. Actualizar estado
  await supabase.from("oauth_connection_status").upsert(
    {
      user_id: userId,
      provider: "google_gmail",
      connected: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" },
  );
}

// ─── Verificar estado de conexión ───
export async function isGmailConnected(
  userId: string,
): Promise<{ connected: boolean; email: string | null }> {
  const supabase = getSupabaseServerClient(); // cliente con RLS

  const { data, error } = await supabase
    .from("oauth_connection_status")
    .select("connected")
    .eq("user_id", userId)
    .eq("provider", "google_gmail")
    .maybeSingle();

  if (error) throw new Error(error.message);

  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    connected: data?.connected ?? false,
    email: profile?.email ?? null,
  };
}
