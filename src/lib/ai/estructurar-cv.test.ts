import { describe, expect, it } from "vitest";
import { estructurarCvPorHeuristica } from "@/lib/ai/estructurar-cv";

describe("estructurarCvPorHeuristica", () => {
  it("estructura un CV con perfil y experiencias", () => {
    const texto = `Julio Velozo
Desarrollador Full Stack

Perfil profesional
Ingeniero con 6 años de experiencia en aplicaciones web y pagos.

Experiencia laboral
Líder de equipo en Fintech SRL
2023 - Hoy
- Lideré el equipo de 5 desarrolladores.
- Redujimos latencia 40%.

Desarrollador backend en Banco X
2020 - 2023
- Migré el core de pagos a Node.js.

Educación
Ingeniería en Sistemas — UTN`;

    const cv = estructurarCvPorHeuristica(texto);

    expect(cv.titular).toBe("Julio Velozo");
    expect(cv.perfil).toContain("Ingeniero con 6 años");
    expect(cv.experiencia).toHaveLength(2);
    expect(cv.experiencia[0]!.puesto).toBe("Líder de equipo");
    expect(cv.experiencia[0]!.empresa).toBe("Fintech SRL");
    expect(cv.experiencia[0]!.detalle).toContain("Lideré el equipo");
    expect(cv.experiencia[1]!.puesto).toBe("Desarrollador backend");
    expect(cv.experiencia[1]!.empresa).toBe("Banco X");
  });

  it("respeta además del header en inglés la forma 'puesto en empresa'", () => {
    const cv = estructurarCvPorHeuristica(
      `Ana Pérez\n\nExperience\nAccount Manager en Naranja X\n- Gestión de la cartera.\n\nEducation\nUTN`,
    );
    expect(cv.titular).toBe("Ana Pérez");
    expect(cv.experiencia[0]!.puesto).toBe("Account Manager");
    expect(cv.experiencia[0]!.empresa).toBe("Naranja X");
    expect(cv.perfil).toBe("");
  });

  it("devuelve contenido vacío para texto vacío", () => {
    const cv = estructurarCvPorHeuristica("");
    expect(cv).toEqual({ titular: "", perfil: "", experiencia: [] });
  });

  it("acota detalle y perfil a los límites del schema", () => {
    const largo = "x".repeat(3000);
    const cv = estructurarCvPorHeuristica(`Titulo\n\nPerfil\n${largo}`);
    expect(cv.perfil.length).toBeLessThanOrEqual(3000);
  });
});
