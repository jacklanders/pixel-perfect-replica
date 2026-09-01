import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FakeSupabase, rowResult, fakeResponse } from "./supabase-fake";
import * as oauth from "@/lib/server/gmail-oauth";
import { enviarEmailGmailCore } from "@/lib/server/enviar-postulacion-email";
import type { SupabaseClient } from "@supabase/supabase-js";
import { gmailState } from "./gmail-test-state";

// getServiceClient (gmail-oauth / gmail-send / adjuntos) devuelve el fake.
vi.mock("@/lib/server/supabase-service", () => ({
  getEnv: (key: string) => gmailState.env[key],
  getServiceClient: () => gmailState.client,
}));

const isoIn = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString();

const BASE_APP = {
  id: "00000000-0000-4000-8000-000000000001",
  user_id: "user-1",
  job_post_id: "00000000-0000-4000-8000-000000000002",
  resume_id: null,
  status: "pending",
  destination_email: "rrhh@empresa.com",
  generated_subject: "Postulación a Empresa",
  required_subject: "Postulación - [SUJETO EXACTO]",
  generated_body: "Cuerpo original",
  created_at: isoIn(-3600),
  updated_at: isoIn(-3600),
  sent_at: null,
  job_posts: { role: "Ejecutivo de cuentas", employer: "Naranja X", location: "CABA" },
};

type CoreArgs = Parameters<typeof enviarEmailGmailCore>[0];

const coreArgs = (client: FakeSupabase, overrides?: Partial<CoreArgs["data"]>): CoreArgs => ({
  supabase: client as unknown as SupabaseClient,
  userId: "user-1",
  email: "juan@test.com",
  data: {
    applicationId: BASE_APP.id,
    generated_body: "Cuerpo editado en pantalla",
    destination_email: "empresa@test.com",
    ...overrides,
  },
});

describe("enviarEmailGmailCore (lógica completa del handler)", () => {
  let client: FakeSupabase;
  let fetchStub: ReturnType<typeof vi.fn>;
  let rpcNames: string[];
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    client = new FakeSupabase();
    gmailState.client = client;
    rpcNames = [];

    client.handlers["app_settings"] = () => rowResult({ value: "10" });
    client.handlers["oauth_connection_status"] = () => rowResult(null);

    client.handlers["applications"] = (op) => {
      if (op.op === "update") {
        return rowResult({ ...BASE_APP, ...(op.payload as Record<string, unknown>) });
      }
      return rowResult(BASE_APP);
    };
    client.rpcHandler = async (fn) => {
      rpcNames.push(fn);
      return rowResult([{ allowed: true }]);
    };

    fetchStub = vi.fn();
    globalThis.fetch = fetchStub as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("con token vigente, envía por Gmail y marca la postulación como enviada (sent_at)", async () => {
    const accessEnc = await oauth.encrypt("access-valid");
    const refreshEnc = await oauth.encrypt("refresh-valid");
    client.handlers["oauth_connections"] = () =>
      rowResult({
        encrypted_access_token: accessEnc,
        encrypted_refresh_token: refreshEnc,
        expires_at: isoIn(60 * 60),
      });
    fetchStub.mockResolvedValue(fakeResponse(200, { id: "gmail-1" }));

    const result = await enviarEmailGmailCore(coreArgs(client));

    expect(result.status).toBe("sent");
    expect(typeof result.sent_at).toBe("string");
    expect(result.messageId).toBe("gmail-1");

    // La DB recibió el update con sent_at + los campos editados.
    const updateOp = client.calls.find((c) => c.op === "update" && c.table === "applications");
    expect(updateOp).toBeDefined();
    const payload = updateOp!.payload as {
      status: string;
      sent_at: string;
      generated_body: string;
    };
    expect(payload.status).toBe("sent");
    expect(new Date(payload.sent_at).getTime()).toBeGreaterThan(0);
    expect(payload.generated_body).toBe("Cuerpo editado en pantalla");

    // Solo una llamada a la API de Gmail.
    const gmail = fetchStub.mock.calls.filter((c) => String(c[0]).includes("gmail.googleapis.com"));
    expect(gmail).toHaveLength(1);

    // Éxito → la cuota se confirma, no se revierte.
    expect(rpcNames).toContain("increment_daily_usage");
    expect(rpcNames).not.toContain("decrement_daily_usage");
  });

  it("con adjunto temporal, adjunta, envía y borra de Storage; marca sent_at", async () => {
    const accessEnc = await oauth.encrypt("access-valid");
    client.handlers["oauth_connections"] = () =>
      rowResult({
        encrypted_access_token: accessEnc,
        encrypted_refresh_token: null,
        expires_at: isoIn(60 * 60),
      });
    client.downloadHandler = async () =>
      rowResult(new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])]));
    const removidos: string[][] = [];
    client.removeHandler = async (paths) => {
      removidos.push(paths);
      return { error: null };
    };
    fetchStub.mockResolvedValue(fakeResponse(200, { id: "gmail-adj" }));

    const result = await enviarEmailGmailCore(
      coreArgs(client, {
        resumeId: null,
        adjuntoStoragePath: "/user-1/tmp/cv-e2e.pdf",
        adjuntoFileName: "cv-e2e.pdf",
        adjuntoMimeType: "application/pdf",
      }),
    );

    expect(result.status).toBe("sent");
    expect(result.messageId).toBe("gmail-adj");
    expect(removidos).toEqual([["/user-1/tmp/cv-e2e.pdf"]]);
  });

  it("si el token está revocado (401 + refresh 400), NO marca la postulación como enviada", async () => {
    const accessEnc = await oauth.encrypt("access-viejo");
    const refreshEnc = await oauth.encrypt("refresh-muerto");
    client.handlers["oauth_connections"] = () =>
      rowResult({
        encrypted_access_token: accessEnc,
        encrypted_refresh_token: refreshEnc,
        expires_at: new Date(Date.now() - 1000).toISOString(),
      });
    fetchStub.mockImplementation(async (input: unknown) => {
      const url = String(input);
      if (url.includes("gmail.googleapis.com")) return fakeResponse(401, "Unauthorized");
      if (url.includes("oauth2.googleapis.com/token")) return fakeResponse(400, "invalid_grant");
      throw new Error(`URL inesperada: ${url}`);
    });

    await expect(enviarEmailGmailCore(coreArgs(client))).rejects.toMatchObject({
      name: "GoogleRefreshError",
      status: 400,
    });

    // No hubo update de la postulación → quedó en pending. La conexión se marcó desconectada.
    const updateOp = client.calls.find((c) => c.op === "update" && c.table === "applications");
    expect(updateOp).toBeUndefined();
    const statusOp = client.calls.find(
      (c) => c.op === "upsert" && c.table === "oauth_connection_status",
    );
    expect((statusOp!.payload as { connected: boolean }).connected).toBe(false);

    // El envío falló → la reserva de cuota se libera.
    expect(rpcNames).toContain("increment_daily_usage");
    expect(rpcNames).toContain("decrement_daily_usage");
  });

  it("bloquea el envío cuando se alcanza el límite diario (RPC false) y no llama a Gmail", async () => {
    const accessEnc = await oauth.encrypt("access-valid");
    client.handlers["oauth_connections"] = () =>
      rowResult({
        encrypted_access_token: accessEnc,
        encrypted_refresh_token: null,
        expires_at: isoIn(60 * 60),
      });
    client.rpcHandler = async () => rowResult([{ allowed: false }]);
    fetchStub.mockResolvedValue(fakeResponse(200, { id: "gmail-1" }));

    await expect(enviarEmailGmailCore(coreArgs(client))).rejects.toThrow("Límite diario alcanzado");

    const updateOp = client.calls.find((c) => c.op === "update" && c.table === "applications");
    expect(updateOp).toBeUndefined();
    expect(fetchStub).not.toHaveBeenCalled();
  });
});
