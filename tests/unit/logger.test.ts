import { describe, it, expect } from "vitest";
import {
  redactForLog,
  formatJsonLog,
  formatPrettyLog,
  shouldLog,
  createLogger,
  type ServerLogger,
} from "@/lib/server/logger";

describe("logger (estructurado)", () => {
  it("shouldLog filtra niveles por umbral", () => {
    expect(shouldLog("error", "info")).toBe(true);
    expect(shouldLog("debug", "info")).toBe(false);
    expect(shouldLog("warn", "warn")).toBe(true);
  });

  it("redactForLog oculta claves sensibles de forma recursiva", () => {
    const out = redactForLog({
      userId: "u-1",
      tokens: { access_token: "abc", refresh_token: "def" },
      meta: { apiKey: "k", ok: true },
      list: [{ password: "x" }, "safe"],
    });
    expect(out).toEqual({
      userId: "u-1",
      tokens: { access_token: "[REDACTED]", refresh_token: "[REDACTED]" },
      meta: { apiKey: "[REDACTED]", ok: true },
      list: [{ password: "[REDACTED]" }, "safe"],
    });
  });

  it("formatJsonLog emite JSON con redacción", () => {
    const line = formatJsonLog("info", "hola", { access_token: "s3cret", ok: true });
    const record = JSON.parse(line) as Record<string, unknown>;
    expect(record.level).toBe("info");
    expect(record.msg).toBe("hola");
    expect(record.ok).toBe(true);
    expect(record.access_token).toBe("[REDACTED]");
  });

  it("formatPrettyLog es legible y redacta", () => {
    const line = formatPrettyLog("warn", "cuidado", { refresh_token: "x" });
    expect(line).toContain("WARN");
    expect(line).toContain("cuidado");
    expect(line).not.toContain('"refresh_token":"x"');
    expect(line).toContain("[REDACTED]");
  });

  it("createLogger con destination captura líneas y child hereda bindings", () => {
    const lines: string[] = [];
    const log: ServerLogger = createLogger({ json: true, destination: (l) => lines.push(l) });

    log.child({ userId: "u-1" }).info("envio", { ok: true });
    log.info("sin-binding");

    expect(lines).toHaveLength(2);
    const first = JSON.parse(lines[0]) as Record<string, unknown>;
    expect(first.userId).toBe("u-1");
    expect(first.ok).toBe(true);
    const second = JSON.parse(lines[1]) as Record<string, unknown>;
    expect(second.userId).toBeUndefined();
  });

  it("no filtra logs por debajo del nivel configurado", () => {
    const lines: string[] = [];
    const log = createLogger({ json: true, level: "error", destination: (l) => lines.push(l) });
    log.info("no deberia salir");
    log.error("deberia salir");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]).msg).toBe("deberia salir");
  });
});
