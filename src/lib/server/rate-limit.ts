/**
 * Rate limiting en memoria (por worker) para server functions.
 *
 * Es una capa anti-spam ligera: limita cuántas veces se ejecuta una operación
 * desde una misma clave (ej. IP) dentro de una ventana de tiempo. No es
 * distribuido (cada worker tiene su propio contador), lo cual es suficiente
 * como primera barrera antes del límite diario por usuario que vive en Postgres.
 */

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export class RateLimitExceeded extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("Demasiadas solicitudes. Intentá de nuevo en unos segundos.");
    this.name = "RateLimitExceeded";
  }
}

interface Bucket {
  count: number;
  resetAt: number;
}

// `now` es inyectable para testear el paso del tiempo sin fake timers (funciona
// tanto en vitest como en el runner nativo de bun).
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

export function checkRateLimit(
  key: string,
  opts: RateLimitOptions,
  now: number = Date.now(),
): void {
  // Limpieza perezosa: evita que el mapa crezca sin límite con IPs distintas.
  if (buckets.size > MAX_BUCKETS) {
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k);
    }
  }

  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return;
  }

  b.count += 1;
  if (b.count > opts.limit) {
    throw new RateLimitExceeded(Math.max(1, Math.ceil((b.resetAt - now) / 1000)));
  }
}

/** Devuelve la clave de rate limiting según la IP del request (proxy-aware). */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "";
  const real = request.headers.get("x-real-ip") || "";
  if (real) return real.trim();
  return "unknown";
}

export function resetRateLimiter(): void {
  buckets.clear();
}
