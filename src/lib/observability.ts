// Placeholders de observabilidad para Hito 0. A propósito NO instalan @sentry/react
// ni posthog-js todavía (evitar peso/superficie sin uso real); solo dejan el punto
// de integración único y la regla de privacidad documentada en el prompt de producto:
//   - Sentry: nunca adjuntar CVs, cuerpos de mail, teléfonos ni tokens a los eventos.
//   - PostHog: enmascarar/excluir datos personales y texto de CV/mails; si un replay
//     no puede garantizar el enmascarado en una pantalla, no habilitarlo ahí.
//
// Cuando se agreguen los SDK reales (Hito 0 tardío / Hito 5), reemplazar los cuerpos
// de estas funciones sin cambiar la firma, para no tener que tocar cada call site.

const sentryDsn = import.meta.env["VITE_SENTRY_DSN"] as string | undefined;
const posthogKey = import.meta.env["VITE_POSTHOG_KEY"] as string | undefined;

export function initObservability(): void {
  if (sentryDsn) {
    // TODO(Hito 5): Sentry.init({ dsn: sentryDsn, environment, beforeSend: sanitizeEvent })
    console.info("[observability] Sentry configurado pero SDK aún no instalado (placeholder).");
  }
  if (posthogKey) {
    // TODO(Hito 5): posthog.init(posthogKey, { api_host, session_recording: { maskAllInputs: true } })
    console.info("[observability] PostHog configurado pero SDK aún no instalado (placeholder).");
  }
}

/**
 * Reporta un error técnico. Nunca pasar el objeto de error crudo si puede contener
 * texto de CV/mail — sanear antes de llamar a esta función si el caller maneja esos
 * datos (ver `src/lib/lovable-error-reporting.ts` para el wrapper ya existente de
 * errores de runtime de Lovable, que sigue activo en paralelo).
 */
export function reportTechnicalError(error: unknown, context?: Record<string, string>): void {
  console.error("[observability]", error, context);
  // TODO(Hito 5): Sentry.captureException(error, { extra: context })
}

export function trackEvent(name: string, properties?: Record<string, string | number | boolean>): void {
  if (!posthogKey) return;
  // TODO(Hito 5): posthog.capture(name, properties)
  console.info("[observability] event", name, properties);
}
