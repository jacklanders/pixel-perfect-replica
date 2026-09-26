// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * El módulo lee las env vars al importarse (como en el bundle real), así que
 * cada test reinicia el registry y las intercepta con vi.stubEnv.
 */
async function cargarObservability() {
  vi.resetModules();
  return await import("@/lib/server/observability");
}

const capture = vi.fn();
const posthogCapture = vi.fn();
const posthogConstructor = vi.fn();

vi.mock("posthog-node", () => ({
  PostHog: class {
    capture = posthogCapture;
    constructor(key: string, options: unknown) {
      posthogConstructor(key, options);
    }
  },
}));
vi.mock("@sentry/cloudflare", () => ({
  captureException: vi.fn(),
}));

const DSN = "https://abc123@o1.ingest.sentry.io/42";
const KEY = "phc_test_key";

describe("observability (server)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("sanitizeProps", () => {
    it("deja pasar primitivos con clave inocua", async () => {
      const { sanitizeProps } = await cargarObservability();

      expect(
        sanitizeProps({ stage: "envio_gmail", limite: 2, con_adjunto: true, ratio: 0.5 }),
      ).toEqual({ stage: "envio_gmail", limite: 2, con_adjunto: true, ratio: 0.5 });
    });

    it("redacta claves sensibles y de datos personales", async () => {
      const { sanitizeProps } = await cargarObservability();

      const limpio = sanitizeProps({
        email: "jack@example.com",
        refresh_token: "ya29.secret",
        authorization: "Bearer x",
        nombre: "Jack",
        telefono: "3415550000",
        storagePath: "resumes/abc/temp/cv.pdf",
        fileName: "Jack-CV.pdf",
        generado_cuerpo: "Estimado señor...",
        stage: "ia",
      });

      expect(limpio).toEqual({
        email: "[REDACTED]",
        refresh_token: "[REDACTED]",
        authorization: "[REDACTED]",
        nombre: "[REDACTED]",
        telefono: "[REDACTED]",
        storagePath: "[REDACTED]",
        fileName: "[REDACTED]",
        generado_cuerpo: "[REDACTED]",
        stage: "ia",
      });
    });

    it("corta los textos largos en vez de mandarlos enteros", async () => {
      const { sanitizeProps } = await cargarObservability();
      const cuerpoLargo = "a".repeat(5_000);

      const limpio = sanitizeProps({ detalle: cuerpoLargo });

      expect(limpio["detalle"]).toBe("[texto omitido: 5000 caracteres]");
      expect(String(limpio["detalle"])).not.toContain("aaaa");
    });

    it("descarta objetos, funciones, null y undefined", async () => {
      const { sanitizeProps } = await cargarObservability();

      expect(
        sanitizeProps({
          ok: true,
          error: new Error("x"),
          anidado: { a: 1 },
          lista: [1, 2],
          nada: null,
          vacio: undefined,
          fn: () => "x",
        }),
      ).toEqual({ ok: true });
    });

    it("devuelve un objeto vacío si no hay contexto", async () => {
      const { sanitizeProps } = await cargarObservability();

      expect(sanitizeProps()).toEqual({});
    });
  });

  it("redacta un resumen de CV (empieza con 'resume')", async () => {
    const { sanitizeProps } = await cargarObservability();

    expect(sanitizeProps({ resumen: "12 años de experiencia en ventas" })).toEqual({
      resumen: "[REDACTED]",
    });
  });

  describe("sentryWorkerOptions", () => {
    it("sin DSN no manda dsn (Sentry queda deshabilitado)", async () => {
      const { sentryWorkerOptions } = await cargarObservability();

      const options = sentryWorkerOptions();

      expect(options.dsn).toBeUndefined();
      expect(options.tracesSampleRate).toBe(0);
      expect(options.sendDefaultPii).toBe(false);
    });

    it("con DSN lo incluye y trunca los mensajes de excepción", async () => {
      vi.stubEnv("VITE_SENTRY_DSN", DSN);
      const { sentryWorkerOptions } = await cargarObservability();

      const options = sentryWorkerOptions();
      expect(options.dsn).toBe(DSN);

      const evento = {
        exception: { values: [{ value: "x".repeat(5_000) }] },
      };
      const devuelto = options.beforeSend?.(evento as never, {} as never);
      const valor = (devuelto as { exception: { values: Array<{ value: string }> } }).exception
        .values[0]?.value;

      expect(valor).toHaveLength(500 + "… [truncado]".length);
      expect(valor).toContain("[truncado]");
    });

    it("deja intactos los mensajes cortos", async () => {
      vi.stubEnv("VITE_SENTRY_DSN", DSN);
      const { sentryWorkerOptions } = await cargarObservability();

      const devuelto = sentryWorkerOptions().beforeSend?.(
        { exception: { values: [{ value: "Gemini API error (429): quota" }] } } as never,
        {} as never,
      );

      expect(
        (devuelto as { exception: { values: Array<{ value: string }> } }).exception.values[0]
          ?.value,
      ).toBe("Gemini API error (429): quota");
    });
  });

  describe("reportServerError", () => {
    it("sin DSN cae al console.error con el contexto saneado", async () => {
      const { reportServerError } = await cargarObservability();
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      reportServerError(new Error("boom"), { stage: "ia", email: "jack@example.com" });

      expect(spy).toHaveBeenCalled();
      const [, , contexto] = spy.mock.calls[0] ?? [];
      expect(contexto).toEqual({ stage: "ia", email: "[REDACTED]" });
      spy.mockRestore();
    });

    it("con DSN captura la excepción con el extra saneado", async () => {
      vi.stubEnv("VITE_SENTRY_DSN", DSN);
      const Sentry = await import("@sentry/cloudflare");
      const { reportServerError } = await cargarObservability();
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      const error = new Error("Gemini API error (503)");
      reportServerError(error, { stage: "ia", token: "secret" });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        extra: { stage: "ia", token: "[REDACTED]" },
      });
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it("usa el waitUntil del isolate cuando está disponible", async () => {
      vi.stubEnv("VITE_POSTHOG_KEY", KEY);
      const { trackServerEvent } = await cargarObservability();

      const promesas: Promise<unknown>[] = [];
      trackServerEvent("evento_test", {}, { waitUntil: (p) => promesas.push(p) });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(promesas).toHaveLength(1);
      expect(posthogCapture).toHaveBeenCalledWith(
        expect.objectContaining({ event: "evento_test", distinctId: "postulaya-server" }),
      );
    });
  });

  describe("trackServerEvent", () => {
    it("sin key no emite nada (solo log)", async () => {
      const { trackServerEvent } = await cargarObservability();
      const spy = vi.spyOn(console, "info").mockImplementation(() => {});

      trackServerEvent("evento_test", { stage: "ia" });

      expect(posthogCapture).not.toHaveBeenCalled();
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it("con key inicializa PostHog con flush inmediato", async () => {
      vi.stubEnv("VITE_POSTHOG_KEY", KEY);
      const { initServerObservability } = await cargarObservability();

      initServerObservability();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(posthogConstructor).toHaveBeenCalledWith(KEY, {
        host: "https://us.i.posthog.com",
        flushAt: 1,
        flushInterval: 0,
      });
    });

    it("con key emite el evento con las propiedades saneadas", async () => {
      vi.stubEnv("VITE_POSTHOG_KEY", KEY);
      const { FUNNEL, trackServerEvent } = await cargarObservability();

      trackServerEvent(FUNNEL.limiteDiario, { limite: 2, email: "jack@example.com" });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(posthogCapture).toHaveBeenCalledWith({
        distinctId: "postulaya-server",
        event: "funnel_limite_diario",
        properties: { limite: 2, email: "[REDACTED]" },
      });
    });

    it("no reenvía nada si el host custom viene mal", async () => {
      vi.stubEnv("VITE_POSTHOG_KEY", KEY);
      vi.stubEnv("VITE_POSTHOG_HOST", "https://ph.example.com");
      const { initServerObservability } = await cargarObservability();

      initServerObservability();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(posthogConstructor).toHaveBeenCalledWith(
        KEY,
        expect.objectContaining({ host: "https://ph.example.com" }),
      );
    });
  });

  it("no hace nada si corre en el navegador (guard de window)", async () => {
    vi.stubEnv("VITE_POSTHOG_KEY", KEY);
    const { trackServerEvent, reportServerError } = await cargarObservability();
    // Si este módulo se importara en el browser, manda src/lib/observability.ts.
    vi.stubGlobal("window", {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    trackServerEvent("evento_test", { stage: "ia" });
    reportServerError(new Error("boom"), { stage: "ia" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(posthogCapture).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    infoSpy.mockRestore();
    errorSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
