/**
 * Lógica server-only para OAuth de Gmail.
 */

import { getServiceClient, getEnv } from "./supabase-service";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// ─── Config ───
const GOOGLE_CLIENT_ID = getEnv("GOOGLE_CLIENT_ID") ?? "";
const GOOGLE_CLIENT_SECRET = getEnv("GOOGLE_CLIENT_SECRET") ?? "";
const GOOGLE_REDIRECT_URI =
  getEnv("GOOGLE_REDIRECT_URI") ?? "http://localhost:3000/auth/gmail-callback";
const OAUTH_ENCRYPTION_KEY =
  getEnv("OAUTH_ENCRYPTION_KEY") ?? getEnv("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  throw new Error("Faltan GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET");
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

export async function encrypt(text: string): Promise<string> {
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(text));
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decrypt(base64: string): Promise<string> {
  const key = await getCryptoKey();
  const combined = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

// ─── Google OAuth2 helpers ───
export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

// En modo E2E (MOCK_GMAIL=true) devolvemos tokens falsos sin tocar el OAuth de Google.
// La DB (oauth_connections/oauth_connection_status) sigue escribiéndose de verdad.
export async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  if (getEnv("MOCK_GMAIL") === "true") {
    return {
      access_token: "mock-access-token",
      refresh_token: "mock-refresh-token",
      expires_in: 3600,
      token_type: "Bearer",
      scope: "https://www.googleapis.com/auth/gmail.send",
    };
  }

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

export class GoogleRefreshError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "GoogleRefreshError";
    this.status = status;
  }
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
    throw new GoogleRefreshError(res.status, `Google refresh token failed (${res.status}): ${err}`);
  }
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

// ─── Marcar conexión como desconectada (refresh token revocado/expirado) ───
export async function markGmailDisconnected(userId: string): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase.from("oauth_connection_status").upsert(
    {
      user_id: userId,
      provider: "google_gmail",
      connected: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" },
  );
  if (error) throw new Error(`Error marcando desconexión: ${error.message}`);
}

// ─── Refresh + persistencia del nuevo access_token/expires_at ───
// Si Google responde invalid_grant (400, token revocado/expirado), marca la
// conexión como desconectada para forzar reautenticación.
async function refreshAndStoreTokens(userId: string, refreshToken: string): Promise<string> {
  const supabase = getServiceClient();

  let refreshed: { access_token: string; expires_in: number };
  try {
    refreshed = await refreshAccessToken(refreshToken);
  } catch (err) {
    if (err instanceof GoogleRefreshError && err.status === 400) {
      await markGmailDisconnected(userId).catch(() => {});
    }
    throw err;
  }

  const newEncryptedAccess = await encrypt(refreshed.access_token);
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  const { error } = await supabase
    .from("oauth_connections")
    .update({
      encrypted_access_token: newEncryptedAccess,
      expires_at: newExpiresAt,
    })
    .eq("user_id", userId)
    .eq("provider", "google_gmail");

  if (error) throw new Error(`Error actualizando token refrescado: ${error.message}`);

  return refreshed.access_token;
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
  const bufferMs = 60_000;

  if (expiresAt && expiresAt.getTime() - now.getTime() > bufferMs && data.encrypted_access_token) {
    return decrypt(data.encrypted_access_token);
  }

  if (!data.encrypted_refresh_token) {
    throw new Error("Token expirado y no hay refresh token disponible");
  }

  const refreshToken = await decrypt(data.encrypted_refresh_token);
  return refreshAndStoreTokens(userId, refreshToken);
}

// ─── Forzar refresh (para retry tras 401 de Gmail API) ───
export async function forceRefreshAccessToken(userId: string): Promise<string> {
  const supabase = getServiceClient();

  const { data } = await supabase
    .from("oauth_connections")
    .select("encrypted_refresh_token")
    .eq("user_id", userId)
    .eq("provider", "google_gmail")
    .single();

  if (!data?.encrypted_refresh_token) {
    throw new Error("No hay refresh token para forzar renovación");
  }

  const refreshToken = await decrypt(data.encrypted_refresh_token);
  return refreshAndStoreTokens(userId, refreshToken);
}

// ─── Desconectar Gmail ───
export async function disconnectGmail(userId: string): Promise<void> {
  const supabase = getServiceClient();

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
      // continuar igual
    }
  }

  await supabase
    .from("oauth_connections")
    .delete()
    .eq("user_id", userId)
    .eq("provider", "google_gmail");

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
  const supabase = getSupabaseServerClient();

  // En modo E2E (MOCK_GMAIL=true) simulamos la conexión activa.
  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("user_id", userId)
    .maybeSingle();

  if (getEnv("MOCK_GMAIL") === "true") {
    return { connected: true, email: profile?.email ?? null };
  }

  const { data, error } = await supabase
    .from("oauth_connection_status")
    .select("connected")
    .eq("user_id", userId)
    .eq("provider", "google_gmail")
    .maybeSingle();

  if (error) throw new Error(error.message);

  return {
    connected: data?.connected ?? false,
    email: profile?.email ?? null,
  };
}
