import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * El módulo lee las env vars al importarse, así que cada test reinicia el
 * registry de módulos y las intercepta con vi.stubEnv.
 */
async function cargarObservability() {
  vi.resetModules();
  return await import("@/lib/observability");
}

/** Deja asentar la cadena de import() dinámico + init. */
async function flush() {
  await vi.waitFor(() => {});
  await new Promise((resolve) => setTimeout(resolve, 0));
}

const sentryInit = vi.fn();
const sentryCaptureException = vi.fn();
const posthogInit = vi.fn();
const posthogCapture = vi.fn();

vi.mock("@sentry/browser", () => ({
  init: sentryInit,
  captureException: sentryCaptureException,
}));
vi.mock("posthog-js", () => ({
  posthog: { init: posthogInit, capture: posthogCapture },
}));

const DSN = "https://abc123@o1.ingest.sentry.io/42";
const KEY = "phc_test_key";

describe("observability (cliente)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("sin variables de entorno", () => {
    it("no inicializa ningún SDK", async () => {
      const { initObservability } = await cargarObservability();

      initObservability();
      await flush();

      expect(sentryInit).not.toHaveBeenCalled();
      expect(posthogInit).not.toHaveBeenCalled();
    });

    it("trackEvent no emite nada", async () => {
      const { FUNNEL, trackEvent } = await cargarObservability();

      expect(() => trackEvent(FUNNEL.loginOk)).not.toThrow();
      await flush();

      expect(posthogCapture).not.toHaveBeenCalled();
    });

    it("reportTechnicalError cae al console.error", async () => {
      const { reportTechnicalError } = await cargarObservability();
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      reportTechnicalError(new Error("boom"), { stage: "test" });
      await flush();

      expect(sentryCaptureException).not.toHaveBeenCalled();
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe("con variables de entorno", () => {
    it("inicializa Sentry con el DSN", async () => {
      vi.stubEnv("VITE_SENTRY_DSN", DSN);
      const { initObservability } = await cargarObservability();

      initObservability();
      await flush();

      expect(sentryInit).toHaveBeenCalledWith({ dsn: DSN });
    });

    it("inicializa PostHog con la key y el host por defecto", async () => {
      vi.stubEnv("VITE_POSTHOG_KEY", KEY);
      const { initObservability } = await cargarObservability();

      initObservability();
      await flush();

      expect(posthogInit).toHaveBeenCalledWith(KEY, {
        api_host: "https://us.i.posthog.com",
        session_recording: { maskAllInputs: true },
      });
    });

    it("respeta VITE_POSTHOG_HOST", async () => {
      vi.stubEnv("VITE_POSTHOG_KEY", KEY);
      vi.stubEnv("VITE_POSTHOG_HOST", "https://ph.example.com");
      const { initObservability } = await cargarObservability();

      initObservability();
      await flush();

      expect(posthogInit).toHaveBeenCalledWith(
        KEY,
        expect.objectContaining({ api_host: "https://ph.example.com" }),
      );
    });

    it("captura el evento del funnel con sus propiedades", async () => {
      vi.stubEnv("VITE_POSTHOG_KEY", KEY);
      const { FUNNEL, initObservability, trackEvent } = await cargarObservability();

      initObservability();
      await flush();

      trackEvent(FUNNEL.copiar, { origen: "campo" });
      await flush();

      expect(posthogCapture).toHaveBeenCalledWith("funnel_copiar", { origen: "campo" });
    });

    it("reporta el error técnico a Sentry con el contexto", async () => {
      vi.stubEnv("VITE_SENTRY_DSN", DSN);
      const { initObservability, reportTechnicalError } = await cargarObservability();
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      initObservability();
      await flush();

      const error = new Error("boom");
      reportTechnicalError(error, { boundary: "root" });
      await flush();

      expect(sentryCaptureException).toHaveBeenCalledWith(error, { extra: { boundary: "root" } });
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it("no manda contexto vacío a Sentry", async () => {
      vi.stubEnv("VITE_SENTRY_DSN", DSN);
      const { initObservability, reportTechnicalError } = await cargarObservability();
      vi.spyOn(console, "error").mockImplementation(() => {});

      initObservability();
      await flush();

      reportTechnicalError(new Error("boom"));
      await flush();

      expect(sentryCaptureException).toHaveBeenCalledWith(expect.any(Error), undefined);
    });
  });

  it("solo inicializa una vez aunque se llame varias veces", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", DSN);
    vi.stubEnv("VITE_POSTHOG_KEY", KEY);
    const { initObservability } = await cargarObservability();

    initObservability();
    initObservability();
    await flush();
    await flush();

    expect(sentryInit).toHaveBeenCalledTimes(1);
    expect(posthogInit).toHaveBeenCalledTimes(1);
  });

  it("los nombres del funnel son únicos y con prefijo", async () => {
    const { FUNNEL } = await cargarObservability();
    const names = Object.values(FUNNEL);

    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name.startsWith("funnel_")).toBe(true);
  });
});
