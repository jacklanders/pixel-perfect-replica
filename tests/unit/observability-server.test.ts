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

const posthogFetch = vi.fn();

/** Stub del endpoint de capture de PostHog (devuelve {"status":"Ok"} por defecto). */
function stubPosthog(status = 200, body = '{"status":"Ok"}') {
  vi.stubGlobal(
    "fetch",
    posthogFetch.mockResolvedValue({
      ok: status >= 200 && status < 400,
      status,
      text: async () => body,
    }),
  );
}

vi.mock("@sentry/cloudflare", () => ({
  captureException: vi.fn(),
}));

const DSN = "https://abc123@o1.ingest.sentry.io/42";
const KEY = "phc_test_key";

describe("observability (server)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    // Partir de "sin observabilidad" aunque .env.local tenga claves reales: los
    // tests deciden con stubEnv cuándo hay DSN/key (process.env gana a .env).
    vi.stubEnv("VITE_SENTRY_DSN", undefined);
    vi.stubEnv("VITE_POSTHOG_KEY", undefined);
    vi.stubEnv("VITE_POSTHOG_HOST", undefined);
    stubPosthog();
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

    it("emite el evento por fetch y lo ancla al waitUntil del isolate", async () => {
      vi.stubEnv("VITE_POSTHOG_KEY", KEY);
      const { trackServerEvent } = await cargarObservability();

      const promesas: Promise<unknown>[] = [];
      trackServerEvent("evento_test", {}, { waitUntil: (p) => promesas.push(p) });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(promesas).toHaveLength(1);
      expect(posthogFetch).toHaveBeenCalledWith(
        "https://us.i.posthog.com/capture/",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  describe("trackServerEvent", () => {
    it("sin key no emite nada (solo log)", async () => {
      const { trackServerEvent } = await cargarObservability();
      const spy = vi.spyOn(console, "info").mockImplementation(() => {});

      trackServerEvent("evento_test", { stage: "ia" });

      expect(posthogFetch).not.toHaveBeenCalled();
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it("con key manda el evento al endpoint de capture con las propiedades saneadas", async () => {
      vi.stubEnv("VITE_POSTHOG_KEY", KEY);
      const { FUNNEL, trackServerEvent } = await cargarObservability();

      trackServerEvent(FUNNEL.limiteDiario, { limite: 2, email: "jack@example.com" });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(posthogFetch).toHaveBeenCalledTimes(1);
      const [url, init] = posthogFetch.mock.calls[0] ?? [];
      expect(url).toBe("https://us.i.posthog.com/capture/");
      expect(init?.method).toBe("POST");
      expect(JSON.parse(init?.body as string)).toEqual({
        api_key: KEY,
        distinct_id: "postulaya-server",
        event: "funnel_limite_diario",
        properties: { limite: 2, email: "[REDACTED]" },
      });
    });

    it("manda el evento al host custom de VITE_POSTHOG_HOST", async () => {
      vi.stubEnv("VITE_POSTHOG_KEY", KEY);
      vi.stubEnv("VITE_POSTHOG_HOST", "https://ph.example.com");
      const { trackServerEvent } = await cargarObservability();

      trackServerEvent("evento_test", {});
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(posthogFetch).toHaveBeenCalledWith(
        "https://ph.example.com/capture/",
        expect.anything(),
      );
    });

    it("no rompe el request si PostHog devuelve un error", async () => {
      vi.stubEnv("VITE_POSTHOG_KEY", KEY);
      stubPosthog(500, "boom");
      const { trackServerEvent } = await cargarObservability();
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      trackServerEvent("evento_test", {});
      await new Promise((resolve) => setTimeout(resolve, 0));

      // El el caller nunca ve el error (fire-and-forget), pero el fallo queda
      // logueado como diagnóstico en el Logs tab / Sentry (sin DSN, a console).
      expect(posthogFetch).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        "[observability:server] posthog fallo",
        "evento_test",
        expect.any(Error),
      );
      errorSpy.mockRestore();
    });

    it("usa el waitUntil del AsyncLocalStorage cuando no llega ctx explícito", async () => {
      vi.stubEnv("VITE_POSTHOG_KEY", KEY);
      const { requestContext, trackServerEvent } = await cargarObservability();

      const promesas: Promise<unknown>[] = [];
      const ctx = { waitUntil: (p: Promise<unknown>) => promesas.push(p) };

      await requestContext.run(ctx, async () => {
        trackServerEvent("funnel_gmail_enviado", { limite: 2 });
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Sin el requestContext, este evento se perdería: el call site (una server
      // fn) no tiene acceso al ctx de Cloudflare y caería en fire-and-forget.
      expect(promesas).toHaveLength(1);
      expect(posthogFetch).toHaveBeenCalledWith(
        "https://us.i.posthog.com/capture/",
        expect.objectContaining({
          body: expect.stringContaining('"funnel_gmail_enviado"'),
        }),
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

    expect(posthogFetch).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    infoSpy.mockRestore();
    errorSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
