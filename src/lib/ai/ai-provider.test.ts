import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock de fetch para no llamar a APIs reales
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe("AIProvider", () => {
  it("debe fallar si falta GEMINI_API_KEY", async () => {
    const originalProvider = process.env["AI_PROVIDER"];
    const originalKey = process.env["GEMINI_API_KEY"];

    process.env["AI_PROVIDER"] = "gemini";
    delete process.env["GEMINI_API_KEY"];

    const { createAIProvider } = await import("@/lib/ai/ai-provider");
    expect(() => createAIProvider()).toThrow("Falta GEMINI_API_KEY");

    process.env["AI_PROVIDER"] = originalProvider;
    process.env["GEMINI_API_KEY"] = originalKey;
  });

  it("debe fallar si falta ANTHROPIC_API_KEY", async () => {
    const originalProvider = process.env["AI_PROVIDER"];
    const originalKey = process.env["ANTHROPIC_API_KEY"];

    process.env["AI_PROVIDER"] = "anthropic";
    delete process.env["ANTHROPIC_API_KEY"];

    const { createAIProvider } = await import("@/lib/ai/ai-provider");
    expect(() => createAIProvider()).toThrow("Falta ANTHROPIC_API_KEY");

    process.env["AI_PROVIDER"] = originalProvider;
    process.env["ANTHROPIC_API_KEY"] = originalKey;
  });

  it("GeminiProvider debe parsear respuesta correctamente", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '{"mejorado":{"titular":"Dev","perfil":"Experto","experiencia":[]},"cambios":[],"preguntas":[]}',
                },
              ],
            },
            finishReason: "STOP",
          },
        ],
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50 },
      }),
    });

    const { createAIProvider } = await import("@/lib/ai/ai-provider");
    process.env["AI_PROVIDER"] = "gemini";
    process.env["GEMINI_API_KEY"] = "fake-key";

    const provider = createAIProvider();
    const res = await provider.generate({
      system: "Sos Jack",
      messages: [{ role: "user", content: "Mejorá mi CV" }],
    });

    expect(res.content).toContain("mejorado");
    expect(res.usage?.inputTokens).toBe(100);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("debe lanzar error si Gemini bloquea por seguridad", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ finishReason: "SAFETY" }],
      }),
    });

    const { createAIProvider } = await import("@/lib/ai/ai-provider");
    process.env["AI_PROVIDER"] = "gemini";
    process.env["GEMINI_API_KEY"] = "fake-key";

    const provider = createAIProvider();
    await expect(
      provider.generate({ system: "Sos Jack", messages: [{ role: "user", content: "test" }] }),
    ).rejects.toThrow("bloqueada por seguridad");
  });
});

describe("fetchConReintentos", () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it("no reintenta si la primera respuesta es ok", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    const { fetchConReintentos } = await import("@/lib/ai/ai-provider");
    const res = await fetchConReintentos("https://x", { method: "POST" });

    expect(res.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("no reintenta errores definitivos (400/404)", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404, text: async () => "nope" });

    const { fetchConReintentos } = await import("@/lib/ai/ai-provider");
    const res = await fetchConReintentos("https://x", { method: "POST" }, { retrasos: [0, 0] });

    expect(res.status).toBe(404);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("reintenta 429/503 transitorios y devuelve la respuesta de éxito", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 429, text: async () => "overloaded" })
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => "unavailable" })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) });

    const { fetchConReintentos } = await import("@/lib/ai/ai-provider");
    const res = await fetchConReintentos("https://x", { method: "POST" }, { retrasos: [0, 0] });

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("devuelve el último error transitorio si se agotan los reintentos", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429, text: async () => "still busy" });

    const { fetchConReintentos } = await import("@/lib/ai/ai-provider");
    const res = await fetchConReintentos("https://x", { method: "POST" }, { retrasos: [0, 0] });

    expect(res.status).toBe(429);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("reintenta si fetch lanza un error de red y re-lanza al agotarse", async () => {
    mockFetch
      .mockRejectedValueOnce(new TypeError("network down"))
      .mockRejectedValueOnce(new TypeError("network down"))
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) });

    const { fetchConReintentos } = await import("@/lib/ai/ai-provider");
    const res = await fetchConReintentos("https://x", { method: "POST" }, { retrasos: [0, 0] });

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("re-lanza el error de red si todos los intentos fallan", async () => {
    mockFetch.mockRejectedValue(new TypeError("network down"));

    const { fetchConReintentos } = await import("@/lib/ai/ai-provider");
    await expect(
      fetchConReintentos("https://x", { method: "POST" }, { retrasos: [0, 0] }),
    ).rejects.toThrow("network down");
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
