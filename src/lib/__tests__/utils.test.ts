import { describe, expect, it } from "vitest";
import { cn } from "../utils";

describe("cn", () => {
  it("combina clases y resuelve conflictos de Tailwind (smoke test de Hito 0)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("flex", "items-center")).toBe("flex items-center");
  });
});
