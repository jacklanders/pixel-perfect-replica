import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { enviarPostulacionGmail } from "@/lib/server/gmail-send";
import { encrypt } from "@/lib/server/gmail-oauth";
import { FakeSupabase, rowResult, fakeResponse, errResult, blobFrom } from "./supabase-fake";
import { gmailState } from "./gmail-test-state";

vi.mock("@/lib/server/supabase-service", () => ({
  getEnv: (key: string) => gmailState.env[key],
  getServiceClient: () => gmailState.client,
}));

// ─── Fixtures ───
const isoIn = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString();

const RESUMEN_GENERADO = {
  id: "res-jack",
  user_id: "user-1",
  title: "CV Desarrollador",
  source_type: "created_from_scratch",
  file_path_original: null,
  structured_json: {
    contenido: {
      titular: "Desarrollador Fullstack",
      perfil: "Tengo experiencia construyendo apps.",
      experiencia: [],
    },
  },
  profiles: {
    user_id: "user-1",
    nombre: "Juan Pérez",
    email: "juan@test.com",
    ubicacion: "CABA",
    telefono: "11-5555",
    skills: ["TypeScript"],
  },
};

const RESUMEN_SUBIDO = {
  id: "res-pdf",
  user_id: "user-1",
  title: "CV Adjunto Original",
  source_type: "uploaded_pdf",
  file_path_original: "/user-1/mi-cv.pdf",
  structured_json: null,
  profiles: null,
};

describe("enviarPostulacionGmail", () => {
  let client: FakeSupabase;
  let fetchStub: ReturnType<typeof vi.fn>;
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    client = new FakeSupabase();
    gmailState.client = client;

    // Límite por defecto (10MB).
    client.handlers["app_settings"] = () => rowResult({ value: "10" });
    client.handlers["oauth_connection_status"] = () => rowResult(null);

    // Token vigente (no expira, no toca la red).
    const accessEnc = await encrypt("access-valid");
    const refreshEnc = await encrypt("refresh-valid");
    client.handlers["oauth_connections"] = () =>
      rowResult({
        encrypted_access_token: accessEnc,
        encrypted_refresh_token: refreshEnc,
        expires_at: isoIn(60 * 60),
      });

    fetchStub = vi.fn();
    globalThis.fetch = fetchStub as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const gmailCalls = () => {
    const indices: number[] = [];
    fetchStub.mock.calls.forEach((call, i) => {
      if (String(call[0]).includes("gmail.googleapis.com")) indices.push(i);
    });
    return indices;
  };

  const bearerOf = (callIndex: number): string => {
    const init = fetchStub.mock.calls[callIndex]![1]!;
    return (init.headers as { Authorization: string }).Authorization as string;
  };

  it("envía un CV generado por Jack (creado desde cero) y devuelve el messageId de Gmail", async () => {
    client.handlers["resumes"] = () => rowResult(RESUMEN_GENERADO);
    fetchStub.mockResolvedValue(fakeResponse(200, { id: "m1" }));

    const result = await enviarPostulacionGmail({
      userId: "user-1",
      fromEmail: "juan@test.com",
      toEmail: "rrhh@empresa.com",
      subject: "Postulación",
      body: "Hola, me postulo.",
      resumeId: "res-jack",
      includeCopy: true,
      adjunto: null,
    });

    expect(result.messageId).toBe("m1");

    // Una sola llamada a la API de Gmail con el bearer vigente.
    const gmail = gmailCalls();
    expect(gmail).toHaveLength(1);
    expect(bearerOf(gmail[0]!)).toBe("Bearer access-valid");
  });

  it("envía un CV subido como archivo (uploaded_pdf) descargándolo de Storage", async () => {
    client.handlers["resumes"] = () => rowResult(RESUMEN_SUBIDO);
    client.downloadHandler = async (path) => {
      expect(path).toBe("/user-1/mi-cv.pdf");
      return rowResult(blobFrom(new TextEncoder().encode("%PDF-1.4 mock")));
    };
    fetchStub.mockResolvedValue(fakeResponse(200, { id: "m2" }));

    const result = await enviarPostulacionGmail({
      userId: "user-1",
      fromEmail: "juan@test.com",
      toEmail: "rrhh@empresa.com",
      subject: "Postulación",
      body: "Hola",
      resumeId: "res-pdf",
      includeCopy: false,
      adjunto: null,
    });

    expect(result.messageId).toBe("m2");
    expect(gmailCalls()).toHaveLength(1);
  });

  it("si la API devuelve 401, fuerza refresh del token y reintenta una vez", async () => {
    client.handlers["resumes"] = () => rowResult(RESUMEN_GENERADO);

    const gmailStatuses = [401, 200];
    fetchStub.mockImplementation(async (input: unknown) => {
      const url = String(input);
      if (url.includes("gmail.googleapis.com")) {
        const status = gmailStatuses.shift() ?? 200;
        return fakeResponse(status, status === 200 ? { id: "m-retry" } : "Unauthorized");
      }
      if (url.includes("oauth2.googleapis.com/token")) {
        return fakeResponse(200, { access_token: "access-refreshed", expires_in: 3600 });
      }
      throw new Error(`URL inesperada: ${url}`);
    });

    const result = await enviarPostulacionGmail({
      userId: "user-1",
      fromEmail: "juan@test.com",
      toEmail: "rrhh@empresa.com",
      subject: "Postulación",
      body: "Hola",
      resumeId: "res-jack",
      includeCopy: false,
      adjunto: null,
    });

    expect(result.messageId).toBe("m-retry");

    const gmail = gmailCalls();
    expect(gmail).toHaveLength(2);
    expect(bearerOf(gmail[0]!)).toBe("Bearer access-valid");
    expect(bearerOf(gmail[1]!)).toBe("Bearer access-refreshed");

    // El token nuevo quedó guardado en la DB.
    const updateOp = client.calls.find((c) => c.op === "update" && c.table === "oauth_connections");
    expect(updateOp).toBeDefined();
  });

  it("reintenta con backoff ante un error transitorio (503) sin tocar el token", async () => {
    client.handlers["resumes"] = () => rowResult(RESUMEN_GENERADO);

    const gmailStatuses = [503, 200];
    fetchStub.mockImplementation(async (input: unknown) => {
      const url = String(input);
      if (url.includes("gmail.googleapis.com")) {
        const status = gmailStatuses.shift() ?? 200;
        return fakeResponse(status, status === 200 ? { id: "m-503" } : "Service Unavailable");
      }
      throw new Error(`URL inesperada: ${url}`);
    });

    const result = await enviarPostulacionGmail({
      userId: "user-1",
      fromEmail: "juan@test.com",
      toEmail: "rrhh@empresa.com",
      subject: "Postulación",
      body: "Hola",
      resumeId: "res-jack",
      includeCopy: false,
      adjunto: null,
    });

    expect(result.messageId).toBe("m-503");

    // Se reintentó con el mismo token vigente (no se forzó refresh).
    const gmail = gmailCalls();
    expect(gmail).toHaveLength(2);
    expect(bearerOf(gmail[0]!)).toBe("Bearer access-valid");
    expect(bearerOf(gmail[1]!)).toBe("Bearer access-valid");
    const updateOp = client.calls.find((c) => c.op === "update" && c.table === "oauth_connections");
    expect(updateOp).toBeUndefined();
  });

  it("valida los inputs y falla con mensaje claro sin tocar la red ni la DB", async () => {
    client.handlers["resumes"] = () => rowResult(RESUMEN_GENERADO);
    const gmail = vi.fn();
    fetchStub.mockImplementation(gmail);

    await expect(
      enviarPostulacionGmail({
        userId: "user-1",
        fromEmail: "juan@test.com",
        toEmail: "  ",
        subject: "Postulación",
        body: "Hola",
        resumeId: null,
        includeCopy: false,
        adjunto: null,
      }),
    ).rejects.toThrow("El email del destinatario no puede estar vacío");

    // No se llamó a Gmail ni se tocó Storage.
    expect(gmail).not.toHaveBeenCalled();
    expect(client.calls).toHaveLength(0);
  });

  it("si el retry falla porque el token está revocado, no se envía y se marca desconectado", async () => {
    client.handlers["resumes"] = () => rowResult(RESUMEN_GENERADO);

    fetchStub.mockImplementation(async (input: unknown) => {
      const url = String(input);
      if (url.includes("gmail.googleapis.com")) return fakeResponse(401, "Unauthorized");
      if (url.includes("oauth2.googleapis.com/token")) return fakeResponse(400, "invalid_grant");
      throw new Error(`URL inesperada: ${url}`);
    });

    await expect(
      enviarPostulacionGmail({
        userId: "user-1",
        fromEmail: "juan@test.com",
        toEmail: "rrhh@empresa.com",
        subject: "Postulación",
        body: "Hola",
        resumeId: "res-jack",
        includeCopy: false,
        adjunto: null,
      }),
    ).rejects.toMatchObject({ name: "GoogleRefreshError", status: 400 });

    // No hubo llamada exitosa a la API y la conexión quedó marcada como desconectada.
    expect(gmailCalls()).toHaveLength(1);
    const statusOp = client.calls.find(
      (c) => c.op === "upsert" && c.table === "oauth_connection_status",
    );
    expect((statusOp!.payload as { connected: boolean }).connected).toBe(false);
  });

  it("adjunta un archivo temporal y lo borra de Storage tras el envío exitoso", async () => {
    client.downloadHandler = async (path) => {
      expect(path).toBe("/user-1/tmp/adjunto-e2e.pdf");
      return rowResult(blobFrom(new TextEncoder().encode("%PDF-1.4 temp")));
    };
    const removidos: string[][] = [];
    client.removeHandler = async (paths) => {
      removidos.push(paths);
      return { error: null };
    };
    fetchStub.mockResolvedValue(fakeResponse(200, { id: "m-adj" }));

    const result = await enviarPostulacionGmail({
      userId: "user-1",
      fromEmail: "juan@test.com",
      toEmail: "rrhh@empresa.com",
      subject: "Postulación",
      body: "Hola",
      resumeId: null,
      includeCopy: false,
      adjunto: {
        storagePath: "/user-1/tmp/adjunto-e2e.pdf",
        fileName: "adjunto-e2e.pdf",
        mimeType: "application/pdf",
      },
    });

    expect(result.messageId).toBe("m-adj");
    expect(removidos).toEqual([["/user-1/tmp/adjunto-e2e.pdf"]]);
  });

  it("si el archivo adjunto no se puede leer de Storage, falla con mensaje claro", async () => {
    client.downloadHandler = async () => errResult("object not found");
    fetchStub.mockResolvedValue(fakeResponse(200, { id: "x" }));

    await expect(
      enviarPostulacionGmail({
        userId: "user-1",
        fromEmail: "juan@test.com",
        toEmail: "rrhh@empresa.com",
        subject: "Postulación",
        body: "Hola",
        resumeId: null,
        includeCopy: false,
        adjunto: {
          storagePath: "/user-1/tmp/extraviado.pdf",
          fileName: "extraviado.pdf",
          mimeType: "application/pdf",
        },
      }),
    ).rejects.toThrow("No se pudo leer el archivo adjuntado");
  });
});
