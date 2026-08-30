import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as oauth from "@/lib/server/gmail-oauth";
import { FakeSupabase, rowResult, fakeResponse, formBodyOf, errResult } from "./supabase-fake";

// getEnv() es el de supabase-service (mockeado): controlamos credenciales y
// modo MOCK_GMAIL sin variables reales.
const state = vi.hoisted(() => {
  return {
    env: {
      GOOGLE_CLIENT_ID: "test-client-id",
      GOOGLE_CLIENT_SECRET: "test-client-secret",
      OAUTH_ENCRYPTION_KEY: "test-enc-key-0123456789abcdef",
    } as Record<string, string | undefined>,
    client: undefined as FakeSupabase | undefined,
  };
});

vi.mock("@/lib/server/supabase-service", () => ({
  getEnv: (key: string) => state.env[key],
  getServiceClient: () => state.client,
}));

const isoIn = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString();
const isoAgo = (seconds: number) => new Date(Date.now() - seconds * 1000).toISOString();

describe("gmail-oauth", () => {
  let client: FakeSupabase;
  let fetchStub: ReturnType<typeof vi.fn<typeof fetch>>;

  beforeEach(() => {
    client = new FakeSupabase();
    state.client = client;

    fetchStub = vi.fn();
    vi.stubGlobal("fetch", fetchStub);

    // Defaults: conexión de estado y RPC responden OK.
    client.handlers["oauth_connection_status"] = () => rowResult(null);
    client.rpcHandler = async () => rowResult([{ allowed: true }]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("refreshAccessToken", () => {
    it("pide un access token nuevo con el refresh_token", async () => {
      fetchStub.mockResolvedValue(
        fakeResponse(200, { access_token: "access-nuevo", expires_in: 3600 }),
      );

      const result = await oauth.refreshAccessToken("refresh-abc");

      expect(result.access_token).toBe("access-nuevo");
      const [url, init] = fetchStub.mock.calls[0]!;
      expect(String(url)).toBe("https://oauth2.googleapis.com/token");
      const body = formBodyOf({ body: init?.body as string });
      expect(body.get("grant_type")).toBe("refresh_token");
      expect(body.get("refresh_token")).toBe("refresh-abc");
      expect(body.get("client_id")).toBe("test-client-id");
      expect(body.get("client_secret")).toBe("test-client-secret");
    });

    it("lanza GoogleRefreshError con status 400 si el token está revocado", async () => {
      fetchStub.mockResolvedValue(fakeResponse(400, "invalid_grant"));

      await expect(oauth.refreshAccessToken("refresh-muerto")).rejects.toMatchObject({
        name: "GoogleRefreshError",
        status: 400,
      });
    });
  });

  describe("getValidAccessToken", () => {
    it("devuelve el token sin refrescar si no expiró (no toca la red)", async () => {
      const accessEnc = await oauth.encrypt("access-vigente");
      client.handlers["oauth_connections"] = () =>
        rowResult({
          encrypted_access_token: accessEnc,
          encrypted_refresh_token: null,
          expires_at: isoIn(60 * 60),
        });

      const token = await oauth.getValidAccessToken("user-1");

      expect(token).toBe("access-vigente");
      expect(fetchStub).not.toHaveBeenCalled();
    });

    it("si expiró, refresca y guarda el token nuevo en la DB", async () => {
      const oldAccessEnc = await oauth.encrypt("access-viejo");
      const refreshEnc = await oauth.encrypt("refresh-vivo");
      client.handlers["oauth_connections"] = () =>
        rowResult({
          encrypted_access_token: oldAccessEnc,
          encrypted_refresh_token: refreshEnc,
          expires_at: isoAgo(60),
        });
      fetchStub.mockResolvedValue(
        fakeResponse(200, { access_token: "access-refrescado", expires_in: 3600 }),
      );

      const token = await oauth.getValidAccessToken("user-1");

      expect(token).toBe("access-refrescado");

      const updateOp = client.calls.find(
        (c) => c.op === "update" && c.table === "oauth_connections",
      );
      expect(updateOp).toBeDefined();
      const payload = updateOp!.payload as {
        encrypted_access_token: string;
        expires_at: string;
      };
      expect(payload.encrypted_access_token).not.toBe(oldAccessEnc);
      expect(await oauth.decrypt(payload.encrypted_access_token)).toBe("access-refrescado");
      expect(new Date(payload.expires_at).getTime()).toBeGreaterThan(Date.now());
    });

    it("si el refresh da 400 (revocado), marca la conexión como desconectada y lanza el error", async () => {
      const refreshEnc = await oauth.encrypt("refresh-muerto");
      const accessEnc = await oauth.encrypt("access-viejo");
      client.handlers["oauth_connections"] = () =>
        rowResult({
          encrypted_access_token: accessEnc,
          encrypted_refresh_token: refreshEnc,
          expires_at: isoAgo(60),
        });
      fetchStub.mockResolvedValue(fakeResponse(400, "invalid_grant"));

      await expect(oauth.getValidAccessToken("user-1")).rejects.toMatchObject({
        name: "GoogleRefreshError",
        status: 400,
      });

      const statusOp = client.calls.find(
        (c) => c.op === "upsert" && c.table === "oauth_connection_status",
      );
      expect(statusOp).toBeDefined();
      expect((statusOp!.payload as { connected: boolean }).connected).toBe(false);
    });

    it("sin conexión activa lanza un error claro", async () => {
      client.handlers["oauth_connections"] = () => errResult("not found");

      await expect(oauth.getValidAccessToken("user-ghost")).rejects.toThrow(
        "No hay conexión Gmail activa",
      );
    });
  });

  describe("forceRefreshAccessToken", () => {
    it("lanza error si no hay refresh token", async () => {
      client.handlers["oauth_connections"] = () => rowResult({ encrypted_refresh_token: null });

      await expect(oauth.forceRefreshAccessToken("user-1")).rejects.toThrow(
        "No hay refresh token para forzar renovación",
      );
    });
  });

  describe("markGmailDisconnected", () => {
    it("escribe connected=false en oauth_connection_status", async () => {
      await oauth.markGmailDisconnected("user-1");

      const statusOp = client.calls.find(
        (c) => c.op === "upsert" && c.table === "oauth_connection_status",
      );
      expect(statusOp).toBeDefined();
      const payload = statusOp!.payload as { connected: boolean; provider: string };
      expect(payload.connected).toBe(false);
      expect(payload.provider).toBe("google_gmail");
    });
  });
});
