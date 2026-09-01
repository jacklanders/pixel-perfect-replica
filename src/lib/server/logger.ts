/**
 * Logger estructurado server-only (zero-deps).
 *
 * Emite líneas JSON (parseables por log aggregators) en producción y un formato
 * legible en desarrollo, con niveles, bindings de contexto y redacción de
 * valores sensibles (tokens, secrets, passwords, cookies...). No depende de
 * transports externos, por lo que funciona igual en bun, nitro y vitest.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function env(key: string): string | undefined {
  try {
    return process.env[key];
  } catch {
    return undefined;
  }
}

const SENSITIVE_KEY = /token|secret|password|authorization|cookie|refresh|service_role|apikey/i;

/** Reemplaza valores sensibles (de forma recursiva) para no volcarlos al log. */
export function redactForLog<T>(value: T, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") {
    if (value instanceof Blob || value instanceof ArrayBuffer) return `[${value.constructor.name}]`;
    return value;
  }
  if (depth > 8) return "[max-depth]";

  if (Array.isArray(value)) return value.map((v) => redactForLog(v, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    // Una clave sensible con valor hoja (primitivo) se redacta entera. Si su
    // valor es un objeto, se profundiza para redactar solo las hojas sensibles
    // internas y conservar la estructura (p.ej. tokens: { access_token }).
    const isSensitiveKey = SENSITIVE_KEY.test(k);
    if (isSensitiveKey && (v === null || typeof v !== "object")) {
      out[k] = "[REDACTED]";
    } else {
      out[k] = redactForLog(v, depth + 1);
    }
  }
  return out;
}

export function formatJsonLog(
  level: LogLevel,
  msg: string,
  bindings: Record<string, unknown> = {},
): string {
  const record = {
    level,
    time: new Date().toISOString(),
    msg,
    ...(redactForLog({ ...bindings }) as Record<string, unknown>),
  };
  return JSON.stringify(record);
}

export function formatPrettyLog(
  level: LogLevel,
  msg: string,
  bindings: Record<string, unknown> = {},
): string {
  const stamp = new Date().toISOString().slice(11, 19);
  const cleaned = redactForLog({ ...bindings }) as Record<string, unknown>;
  const extra = Object.keys(cleaned).length ? ` ${JSON.stringify(cleaned)}` : "";
  return `[${stamp}] ${level.toUpperCase().padEnd(5)} ${msg}${extra}`;
}

export function shouldLog(level: LogLevel, levelThreshold: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[levelThreshold];
}

export interface ServerLogger {
  debug(msg: string, bindings?: Record<string, unknown>): void;
  info(msg: string, bindings?: Record<string, unknown>): void;
  warn(msg: string, bindings?: Record<string, unknown>): void;
  error(msg: string, bindings?: Record<string, unknown>): void;
  child(prefixBindings: Record<string, unknown>): ServerLogger;
}

export interface LoggerOptions {
  level?: LogLevel;
  /** true → salida JSON (producción); false → pretty (dev). Default: NODE_ENV. */
  json?: boolean;
  /** Destino de salida (default: process.stdout). Testeable. */
  destination?: (line: string) => void;
}

export function createLogger(options: LoggerOptions = {}): ServerLogger {
  const isProd = env("NODE_ENV") === "production";
  const json = options.json ?? isProd;
  const threshold: LogLevel = options.level ?? (isProd ? "info" : "debug");
  const write = options.destination ?? ((line: string) => process.stdout.write(`${line}\n`));

  // makeLogger crea un logger con sus propios bindings heredados, para que child()
  // no mute el estado del logger padre.
  function makeLogger(inherited: Record<string, unknown>): ServerLogger {
    const emit = (level: LogLevel, msg: string, bindings: Record<string, unknown>): void => {
      if (!shouldLog(level, threshold)) return;
      const merged = { ...inherited, ...bindings };
      write(json ? formatJsonLog(level, msg, merged) : formatPrettyLog(level, msg, merged));
    };

    return {
      debug: (m, b = {}) => emit("debug", m, b),
      info: (m, b = {}) => emit("info", m, b),
      warn: (m, b = {}) => emit("warn", m, b),
      error: (m, b = {}) => emit("error", m, b),
      child: (prefixBindings) => makeLogger({ ...inherited, ...prefixBindings }),
    };
  }

  return makeLogger({});
}

/** Singleton por defecto que usa el resto del server. */
export const logger: ServerLogger = createLogger();
