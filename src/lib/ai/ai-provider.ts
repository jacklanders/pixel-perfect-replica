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

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AIImage {
  mimeType: string;
  data: string; // base64 sin header data:...
}

export interface GenerateOptions {
  system: string;
  messages: AIMessage[];
  temperature?: number;
  images?: AIImage[];
}

export interface AIProvider {
  generate(options: GenerateOptions): Promise<AIResponse>;
}

function getEnv(key: string): string | undefined {
  try {
    return process.env[key];
  } catch {
    return undefined;
  }
}

function stripBase64Header(base64: string): string {
  return base64.replace(/^data:[^;,]+;base64,/, "");
}

// ─── Mock Provider para tests E2E ───
class MockAIProvider implements AIProvider {
  async generate(options: GenerateOptions): Promise<AIResponse> {
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

// Gemini Provider (multimodal)
class GeminiProvider implements AIProvider {
  private apiKey: string;
  private model = "gemini-3.6-flash";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generate(options: GenerateOptions): Promise<AIResponse> {
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

    // Texto del último mensaje de usuario
    let lastUserMsg: AIMessage | undefined;
    for (let i = options.messages.length - 1; i >= 0; i--) {
      if (options.messages[i]!.role === "user") {
        lastUserMsg = options.messages[i];
        break;
      }
    }

    // Texto de la instrucción + imágenes en la misma entrada de usuario
    if (lastUserMsg?.content) {
      parts.push({ text: lastUserMsg.content });
    }
    for (const img of options.images ?? []) {
      parts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: stripBase64Header(img.data),
        },
      });
    }

    // Mensajes previos (sin imágenes, Gemini no soporta historial multimodal fácil)
    const history = options.messages
      .filter((m) => m !== lastUserMsg)
      .map((m) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      }));

    const body = {
      systemInstruction: { parts: [{ text: options.system }] },
      contents: [...history, { role: "user", parts }],
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

  async generate(options: GenerateOptions): Promise<AIResponse> {
    const messages = options.messages.map((m) => {
      if (m.role === "user" && options.images && options.images.length > 0) {
        // Solo el último mensaje de usuario lleva imágenes
        const content: Array<
          | { type: "text"; text: string }
          | {
              type: "image";
              source: { type: "base64"; media_type: string; data: string };
            }
        > = [{ type: "text", text: m.content }];
        for (const img of options.images) {
          content.push({
            type: "image",
            source: {
              type: "base64",
              media_type: img.mimeType,
              data: stripBase64Header(img.data),
            },
          });
        }
        return { role: m.role, content };
      }
      return { role: m.role, content: m.content };
    });

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
        messages,
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
