// Observabilidad (Sentry + PostHog) activa SOLO cuando las variables de entorno
// correspondientes existen (VITE_SENTRY_DSN / VITE_POSTHOG_KEY). Sin env no se
// instala nada: los SDKs se importan dinámicamente, así que zero footprint en
// build y los chunks (@sentry/browser, posthog-js) solo se descargan si están
// configurados.
//
// Privacidad (prompt de producto):
//   - Sentry: nunca adjuntar CVs, cuerpos de mail, teléfonos ni tokens a eventos.
//   - PostHog: no capturar datos personales ni texto de CV/mails; si un replay
//     no puede garantizar el enmascarado en una pantalla, no habilitarlo ahí.

const sentryDsn = import.meta.env["VITE_SENTRY_DSN"] as string | undefined;
const posthogKey = import.meta.env["VITE_POSTHOG_KEY"] as string | undefined;
const posthogHost =
  (import.meta.env["VITE_POSTHOG_HOST"] as string | undefined) ?? "https://us.i.posthog.com";

let sentryReady = false;
let posthogReady = false;

export function initObservability(): void {
  if (typeof window === "undefined") return;
  void (async () => {
    if (sentryDsn && !sentryReady) {
      try {
        const Sentry = await import("@sentry/browser");
        Sentry.init({ dsn: sentryDsn });
        sentryReady = true;
      } catch (err) {
        console.error("[observability] No se pudo inicializar Sentry", err);
      }
    }
    if (posthogKey && !posthogReady) {
      try {
        const { posthog } = await import("posthog-js");
        posthog.init(posthogKey, {
          api_host: posthogHost,
          session_recording: { maskAllInputs: true },
        });
        posthogReady = true;
      } catch (err) {
        console.error("[observability] No se pudo inicializar PostHog", err);
      }
    }
  })();
}

/**
 * Reporta un error técnico a Sentry (si está configurado). Nunca pasar el objeto
 * de error crudo si puede contener texto de CV/mail — sanear antes de llamar.
 */
export function reportTechnicalError(error: unknown, context?: Record<string, string>): void {
  if (sentryReady) {
    void import("@sentry/browser").then((Sentry) =>
      Sentry.captureException(error, context ? { extra: context } : undefined),
    );
    return;
  }
  console.error("[observability]", error, context);
}

/** Nombres de eventos del funnel principal (PostHog). */
export const FUNNEL = {
  loginOk: "funnel_login_ok",
  crearCv: "funnel_cv_creado",
  extraerDatos: "funnel_extraer_ok",
  generarPostulacion: "funnel_postulacion_generada",
  copiar: "funnel_copiar",
  enviarGmail: "funnel_gmail_enviado",
  limiteDiario: "funnel_limite_diario",
} as const;

export function trackEvent(
  name: string,
  properties?: Record<string, string | number | boolean>,
): void {
  if (posthogReady) {
    void import("posthog-js").then(({ posthog }) => posthog.capture(name, properties));
    return;
  }
  if (posthogKey) console.info("[observability] event (sin SDK listo)", name, properties);
}
