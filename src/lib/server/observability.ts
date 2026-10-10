/**
 * Observabilidad server-side (Sentry + PostHog) — complemento de
 * `src/lib/observability.ts` (que cubre el navegador).
 *
 * Reglas (mismas que el cliente):
 *   - Sin `VITE_SENTRY_DSN` / `VITE_POSTHOG_KEY` no se reporta nada: los SDKs
 *     quedan mudos y la app corre igual.
 *   - Privacidad: nunca emails, teléfonos, cuerpos de mail, CVs ni tokens. Todo
 *     contexto pasa por `sanitizeProps()` antes de salir a la red.
 *   - Nunca rompe el request: todo es fire-and-forget y defensivo.
 *
 * Sentry: lo inicializa `Sentry.withSentry()` en `src/server.ts` (es la única
 * vía pública del SDK de Cloudflare) y de ahí sale `captureException`. Con eso
 * cada request queda en su propia isolation scope y Sentry hace el flush con el
 * `waitUntil` del isolate. Acá solo se reportan los errores que la app ya
 * conhece y que de otro modo se perderían (el server fn los traduce y el
 * browser nunca ve el detalle real).
 */

import { AsyncLocalStorage } from "node:async_hooks";
import type { CloudflareOptions, ErrorEvent } from "@sentry/cloudflare";

/**
 * `import.meta.env` viene reemplazado por Vite en el build (cliente y SSR). El
 * optional chaining evita que un bundle server sin esa definición rompa el
 * módulo al cargarse.
 */
function readViteEnv(key: string): string | undefined {
  try {
    return import.meta.env?.[key];
  } catch {
    return undefined;
  }
}

const sentryDsn = readViteEnv("VITE_SENTRY_DSN");
const posthogKey = readViteEnv("VITE_POSTHOG_KEY");
const posthogHost = readViteEnv("VITE_POSTHOG_HOST") ?? "https://us.i.posthog.com";

/** `ctx` de Cloudflare, para que un evento no se pierda al congelarse el isolate. */
export type WaitUntilContext = { waitUntil?: (promise: Promise<unknown>) => void };

/**
 * Contexto del request con `waitUntil` disponible para todo lo que corra dentro
 * de un fetch del worker. Lo puebla `src/server.ts` al entrar el request; así
 * los eventos que se emiten desde una server fn (cuyo call site no tiene acceso
 * al `ctx` de Cloudflare) igual pueden anclarse al isolate con `waitUntil` y no
 * perderse cuando el isolate se congela.
 */
export const requestContext = new AsyncLocalStorage<WaitUntilContext>();

type PropertyValue = string | number | boolean;

/** Claves que nunca pueden viajar a Sentry/PostHog. */
const SENSITIVE_KEY =
  /token|secret|password|authorization|cookie|refresh|service_role|apikey|password/i;
const PII_KEY =
  /email|mail|cuerpo|body|subject|asunto|telefono|phone|nombre|name|apellido|direccion|address|documento|dni|cuit|resume|cv|file|path|storage/i;

const MAX_VALUE_LENGTH = 200;

/**
 * Deja pasar solo primitivos con claves no sensibles/no personales y corta
 * cualquier texto largo (un cuerpo de mail o un fragmento de CV entra acá como
 * `[texto omitido: N caracteres]`).
 */
export function sanitizeProps(properties?: Record<string, unknown>): Record<string, PropertyValue> {
  if (!properties) return {};
  const out: Record<string, PropertyValue> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (value === null || value === undefined) continue;
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
      continue;
    }
    if (SENSITIVE_KEY.test(key) || PII_KEY.test(key)) {
      out[key] = "[REDACTED]";
      continue;
    }
    if (typeof value === "string" && value.length > MAX_VALUE_LENGTH) {
      out[key] = `[texto omitido: ${value.length} caracteres]`;
      continue;
    }
    out[key] = value;
  }
  return out;
}

/**
 * Tope del mensaje de la excepción: los proveedores de IA/correo devuelven
 * cuerpos crudos enteros ("Gemini API error (429): {...}") que pueden traer
 * datos del prompt. A Sentry va un resumen.
 */
const MAX_EXCEPTION_MESSAGE = 500;

function truncateExceptionMessage(event: ErrorEvent): ErrorEvent {
  for (const value of event.exception?.values ?? []) {
    if (typeof value.value === "string" && value.value.length > MAX_EXCEPTION_MESSAGE) {
      value.value = `${value.value.slice(0, MAX_EXCEPTION_MESSAGE)}… [truncado]`;
    }
  }
  return event;
}

/**
 * Opciones para `Sentry.withSentry()` en `src/server.ts`. Sin DSN devuelve un
 * objeto vacío: Sentry queda deshabilitado y no envía nada.
 */
export function sentryWorkerOptions(): CloudflareOptions {
  return {
    ...(sentryDsn ? { dsn: sentryDsn } : {}),
    // Sin tracing: el MVP no necesita spans de performance.
    tracesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend: truncateExceptionMessage,
  };
}

function track(promise: Promise<unknown>, ctx?: WaitUntilContext): void {
  // Si el call site no tiene ctx (server fn), lo toma del AsyncLocalStorage que
  // pobló src/server.ts al entrar el request del worker.
  const current = ctx ?? requestContext.getStore();
  if (current?.waitUntil) {
    try {
      current.waitUntil(promise.catch(() => undefined));
      return;
    } catch {
      // si waitUntil falla (contexto sin isolate), cae al fire-and-forget
    }
  }
  void promise.catch(() => undefined);
}

/**
 * Reporta un error del server a Sentry (si está configurado). El `error` crudo
 * se manda para que Sentry agrupe por stack; el contexto pasa por
 * `sanitizeProps()`.
 */
export function reportServerError(
  error: unknown,
  context?: Record<string, unknown>,
  ctx?: WaitUntilContext,
): void {
  if (typeof window !== "undefined") return;
  if (!sentryDsn) {
    console.error("[observability:server]", error, sanitizeProps(context));
    return;
  }
  track(
    import("@sentry/cloudflare").then((Sentry) => {
      const extra = sanitizeProps(context);
      Sentry.captureException(error, Object.keys(extra).length ? { extra } : undefined);
      return undefined;
    }),
    ctx,
  );
}

/**
 * Emite un evento del funnel desde el server. Se usa para los resultados que no
 * dependen de que el browser siga abierto (el mail salió, la cuota se consumió,
 * el límite cortó el envío).
 *
 * `distinctId` es una constante: los eventos del server no se atribuyen a una
 * persona (el id real del usuario es un dato personal y no sale del server).
 */
export function trackServerEvent(
  name: string,
  properties?: Record<string, unknown>,
  ctx?: WaitUntilContext,
): void {
  if (typeof window !== "undefined") return;
  if (!posthogKey) {
    console.info("[observability:server] event", name, sanitizeProps(properties));
    return;
  }
  // Fetch directo a la API de capture de PostHog (sin posthog-node): `capture()`
  // de la SDK encola el evento y dispara el flush fire-and-forget por dentro, así
  // que la promesa que registrábamos con waitUntil se resolvía sin haber mandado
  // el HTTP y el evento se perdía al congelarse el isolate. Acá la promesa ES el
  // POST: si waitUntil la sostiene (o el request sigue vivo), el evento llega.
  track(enviarEventoPostHog(name, sanitizeProps(properties)), ctx);
}

/** POST de un solo evento al endpoint de capture de PostHog. */
async function enviarEventoPostHog(
  event: string,
  properties: Record<string, string | number | boolean>,
): Promise<void> {
  const response = await fetch(`${posthogHost}/capture/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: posthogKey,
      distinct_id: "postulaya-server",
      event,
      properties,
    }),
  });
  if (!response.ok) {
    const detalle = await response.text().catch(() => "");
    throw new Error(
      `PostHog capture devolvió HTTP ${response.status}${
        detalle ? `: ${detalle.slice(0, 200)}` : ""
      }`,
    );
  }
}

/** Etapas de los flujos server-side, para correlacionar un error con su paso. */
export const STAGE = {
  envioGmail: "envio_gmail",
  limiteDiario: "limite_diario",
  ia: "ia",
  auth: "auth",
} as const;

/**
 * Eventos propios del server (no forman parte del funnel de UI): sirven para
 * confirmar en PostHog los flujos que pasan por el server, como el callback de
 * OAuth de Gmail o el intento de reenvío de una postulación ya enviada.
 */
export const SERVER_EVENT = {
  gmailConectado: "gmail_conectado",
  gmailDesconectado: "gmail_desconectado",
  gmailEnvioDuplicado: "gmail_envio_duplicado",
} as const;

export { FUNNEL } from "@/lib/observability";
