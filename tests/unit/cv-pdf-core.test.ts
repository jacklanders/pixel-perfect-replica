import { describe, it, expect } from "vitest";
import { generarPdf, sanitizarTextoPdf } from "@/lib/cv-pdf-core";

describe("sanitizarTextoPdf (encoding WinAnsi de las fuentes estándar)", () => {
  it("conserva acentos y caracteres Latin-1", () => {
    expect(sanitizarTextoPdf("María José Álvarez — Programadora Full-Stack")).toBe(
      "María José Álvarez — Programadora Full-Stack",
    );
    expect(sanitizarTextoPdf("¿Sumás? ¡Contratá ya!")).toBe("¿Sumás? ¡Contratá ya!");
  });

  it("reemplaza emojis y caracteres no-WinAnsi sin romper", () => {
    expect(sanitizarTextoPdf("Dev 👾 con 5 años")).toBe("Dev ? con 5 años");
    expect(sanitizarTextoPdf("Привет мир")).toBe("?????? ???");
    expect(sanitizarTextoPdf("日本語")).toBe("???");
  });

  it("conserva comillas tipográficas, guiones y puntos suspensivos (WinAnsi los soporta)", () => {
    expect(sanitizarTextoPdf("“Comillas” y ‘otras’")).toBe("“Comillas” y ‘otras’");
    expect(sanitizarTextoPdf("a – b — c")).toBe("a – b — c");
    expect(sanitizarTextoPdf("seguir…")).toBe("seguir…");
  });
});

describe("generarPdf (CVs con caracteres no-WinAnsi)", () => {
  const contenido = {
    titular: "Desarrollador Full-Stack",
    perfil: "Experiencia en React y Node. Manejo de equipos 😃. Palabra en cirílico: Привет.",
    experiencia: [
      {
        id: "exp-1",
        puesto: "Senior Dev 👾",
        empresa: "Naranja X",
        detalle: "Lideré el equipo móvil «cómodo» con – guiones – y… puntos.",
        fechaInicio: "2020",
      },
    ],
    educacion: [],
    habilidades: [
      {
        categoria: "Habilidades técnicas 💻",
        items: ["TypeScript", "Node.js", "React"],
      },
    ],
  };
  const cv = { contenido } as Parameters<typeof generarPdf>[0]["cv"];

  it("genera el PDF con la plantilla clásica sin lanzar error", async () => {
    const bytes = await generarPdf({
      cv,
      perfil: null,
      nombre: "Juan Pérez 🙂",
      plantilla: "clasica",
    });
    expect(bytes.length).toBeGreaterThan(500);
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("%PDF");
  });

  it("genera el PDF con la plantilla moderna sin lanzar error", async () => {
    const bytes = await generarPdf({
      cv,
      perfil: null,
      nombre: "Juan Pérez",
      plantilla: "moderna",
    });
    expect(bytes.length).toBeGreaterThan(500);
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("%PDF");
  });
});
