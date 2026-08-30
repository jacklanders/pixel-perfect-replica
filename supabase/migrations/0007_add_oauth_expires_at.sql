-- 0007_add_oauth_expires_at.sql
-- Agrega columnas faltantes para el manejo completo de tokens de Gmail OAuth.
-- encrypted_access_token: guarda el access token encriptado (para auto-refresh)
-- expires_at: timestamp de expiración del access token

alter table public.oauth_connections
  add column if not exists encrypted_access_token text,
  add column if not exists expires_at timestamptz;