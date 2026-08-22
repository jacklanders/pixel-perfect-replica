import { describe, it, expect, vi } from "vitest";

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
