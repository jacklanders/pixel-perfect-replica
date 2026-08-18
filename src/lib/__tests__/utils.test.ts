import { describe, expect, it } from "vitest";
import { cn } from "../utils";
import { assertSupabaseConfig } from "../supabase/client";

describe("cn", () => {
  it("combina clases y resuelve conflictos de Tailwind (smoke test de Hito 0)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("flex", "items-center")).toBe("flex items-center");
  });
});

describe("Supabase config guard", () => {
  it("rechaza configuración incompleta con un error útil", () => {
    expect(() => assertSupabaseConfig("", "anon-key")).toThrow(/VITE_SUPABASE_URL/);
    expect(() => assertSupabaseConfig("https://supabase.co", "")).toThrow(/VITE_SUPABASE_ANON_KEY/);
    expect(() => assertSupabaseConfig("https://supabase.co", "anon-key")).not.toThrow();
  });
});
