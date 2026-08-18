import { describe, expect, it } from "vitest";
import { PERFIL_VACIO, completitudPerfil, firmaSugerida, type Perfil } from "../perfil.model";

describe("perfil.model", () => {
  it("calcula progreso 0% para perfil vacío", () => {
    expect(completitudPerfil(PERFIL_VACIO)).toBe(0);
  });

  it("calcula progreso 100% para perfil completo", () => {
    const perfil: Perfil = {
      ...PERFIL_VACIO,
      email: "juan@ejemplo.com",
      nombre: "Juan Pérez",
      rubroObjetivo: "Desarrollador Full Stack",
      resumen: "Más de 5 años de experiencia en desarrollo web.",
      skills: ["React", "Node.js", "TypeScript"],
      telefono: "+54 9 11 1234 5678",
      ubicacion: "Buenos Aires, Argentina",
      firmaMail: "Saludos, Juan",
    };
    expect(completitudPerfil(perfil)).toBe(100);
  });

  it("firma sugerida incluye datos básicos del perfil", () => {
    const perfil: Perfil = {
      ...PERFIL_VACIO,
      nombre: "Juan Pérez",
      rubroObjetivo: "Desarrollador Full Stack",
      telefono: "+54 9 11 1234 5678",
    };
    const firma = firmaSugerida(perfil);
    expect(firma).toContain("Juan Pérez");
    expect(firma).toContain("Desarrollador Full Stack");
    expect(firma).toContain("+54 9 11 1234 5678");
  });

  it("firma sugerida devuelve cadena vacía cuando faltan todos los datos", () => {
    expect(firmaSugerida(PERFIL_VACIO)).toBe("");
  });
});
