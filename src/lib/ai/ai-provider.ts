/**
 * Capa AIProvider desacoplada.
 * Soporta AI_PROVIDER=gemini (desarrollo/pruebas) y anthropic (producción).
 * Las API keys se leen de process.env en server-side únicamente.
 *
 * Modo MOCK_AI: activar con MOCK_AI=true para tests E2E sin llamadas reales a IA.
 */

export interface AIResponse {
  content: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface AIProvider {
  generate(options: {
    system: string;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    temperature?: number;
  }): Promise<AIResponse>;
}

function getEnv(key: string): string | undefined {
  try {
    return process.env[key];
  } catch {
    return undefined;
  }
}

// ─── Mock Provider para tests E2E ───
class MockAIProvider implements AIProvider {
  async generate(options: {
    system: string;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    temperature?: number;
  }): Promise<AIResponse> {
    const last = options.messages.at(-1)?.content ?? "";
    if (last.includes("aviso") || last.includes("puesto") || last.includes("trabajo")) {
      return {
        content: JSON.stringify({
          role: "Ejecutivo/a de cuentas corporativas",
          company: "Naranja X",
          location: "Corrientes (híbrido)",
          destination_email: "seleccion@naranjax.com",
          mandatory_subject: "REF-4471 ECC Corrientes",
          requirements_required: [
            "3+ años en gestión de cuentas",
            "manejo de CRM",
            "vehículo propio",
          ],
          requirements_preferred: ["experiencia en sector financiero"],
          closing_date: "2026-12-31",
          source_notes: "Aviso extraído para test E2E",
          confidence: 0.95,
        }),
        usage: { inputTokens: 120, outputTokens: 80 },
      };
    }
    return {
      content: "Respuesta mock de Jack para tests.",
      usage: { inputTokens: 10, outputTokens: 10 },
    };
  }
}

// Gemini Provider
class GeminiProvider implements AIProvider {
  private apiKey: string;
  private model = "gemini-2.0-flash";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generate(options: {
    system: string;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    temperature?: number;
  }): Promise<AIResponse> {
    const contents = options.messages.map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    }));

    const body = {
      systemInstruction: { parts: [{ text: options.system }] },
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: 4096,
      },
    };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${err}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };

    const candidate = data.candidates?.[0];
    if (!candidate || candidate.finishReason === "SAFETY") {
      throw new Error("Gemini: respuesta bloqueada por seguridad o vacía");
    }

    const text = candidate.content?.parts?.[0]?.text ?? "";

    return {
      content: text,
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      },
    };
  }
}

// Anthropic Provider
class AnthropicProvider implements AIProvider {
  private apiKey: string;
  private model = "claude-sonnet-4-20250514";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generate(options: {
    system: string;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    temperature?: number;
  }): Promise<AIResponse> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        temperature: options.temperature ?? 0.7,
        system: options.system,
        messages: options.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic API error (${res.status}): ${err}`);
    }

    const data = (await res.json()) as {
      content: Array<{ type: string; text?: string }>;
      usage: { input_tokens: number; output_tokens: number };
    };

    const text = data.content.find((c) => c.type === "text")?.text ?? "";

    return {
      content: text,
      usage: {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
      },
    };
  }
}

// ─── Factory ───
export function createAIProvider(): AIProvider {
  if (getEnv("MOCK_AI") === "true") {
    return new MockAIProvider();
  }

  const provider = getEnv("AI_PROVIDER") ?? "gemini";

  if (provider === "gemini") {
    const key = getEnv("GEMINI_API_KEY");
    if (!key) throw new Error("Falta GEMINI_API_KEY en variables de entorno");
    return new GeminiProvider(key);
  }

  if (provider === "anthropic") {
    const key = getEnv("ANTHROPIC_API_KEY");
    if (!key) throw new Error("Falta ANTHROPIC_API_KEY en variables de entorno");
    return new AnthropicProvider(key);
  }

  throw new Error(`AI_PROVIDER desconocido: ${provider}`);
}
