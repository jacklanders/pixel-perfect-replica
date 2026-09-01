import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit,
  getClientIp,
  resetRateLimiter,
  RateLimitExceeded,
} from "@/lib/server/rate-limit";

const opts = { limit: 2, windowMs: 60_000 };

describe("rate-limit", () => {
  beforeEach(() => resetRateLimiter());

  it("permite hasta `limit` llamadas en la ventana", () => {
    checkRateLimit("ip-a", opts, 0);
    checkRateLimit("ip-a", opts, 1);
    expect(() => checkRateLimit("ip-a", opts, 2)).toThrow(RateLimitExceeded);
  });

  it("claves distintas no se afectan entre sí", () => {
    checkRateLimit("ip-a", opts, 0);
    checkRateLimit("ip-a", opts, 1);
    expect(() => checkRateLimit("ip-b", opts, 2)).not.toThrow();
  });

  it("reinicia el contador cuando expira la ventana", () => {
    checkRateLimit("ip-a", opts, 0);
    checkRateLimit("ip-a", opts, 1);
    expect(() => checkRateLimit("ip-a", opts, 2)).toThrow(RateLimitExceeded);
    // Pasó la ventana (60s) → vuelve a permitir.
    checkRateLimit("ip-a", opts, 60_001);
    expect(() => checkRateLimit("ip-a", opts, 60_002)).not.toThrow();
  });

  it("informa retryAfterSeconds en segundos", () => {
    checkRateLimit("ip-a", opts, 0);
    checkRateLimit("ip-a", opts, 1000);
    try {
      checkRateLimit("ip-a", opts, 2000);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitExceeded);
      expect((err as RateLimitExceeded).retryAfterSeconds).toBe(58);
    }
  });

  describe("getClientIp", () => {
    it("usa x-forwarded-for (primer valor del proxy)", () => {
      const req = new Request("http://localhost", {
        headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" },
      });
      expect(getClientIp(req)).toBe("1.2.3.4");
    });

    it("cae a x-real-ip si no hay forwarded", () => {
      const req = new Request("http://localhost", {
        headers: { "x-real-ip": "5.6.7.8" },
      });
      expect(getClientIp(req)).toBe("5.6.7.8");
    });

    it("devuelve 'unknown' si no hay headers de IP", () => {
      expect(getClientIp(new Request("http://localhost"))).toBe("unknown");
    });
  });
});
