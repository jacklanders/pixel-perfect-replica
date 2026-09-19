import { describe, expect, it } from "vitest";
import { generarCuerpoDesdeCv, fechaLegible } from "./cuerpo-postulacion";
import type { CvContenido } from "@/lib/supabase/types";
import type { Perfil } from "@/lib/perfil.model";

const contenidoBasico: CvContenido = {
  titular: "Julio César Velozo Fernández",
  perfil:
    "Técnico electrónico con orientación en telecomunicaciones y experiencia en atención al cliente.",
  experiencia: [
    {
      id: "1",
      puesto: "Customer Experience",
      empresa: "Apex BPO",
      detalle: "Atención telefónica y gestión de reclamos.",
      fechaInicio: "2022-08",
      fechaFin: "2024-02",
    },
    {
      id: "2",
      puesto: "Repositor y control de stock",
      empresa: "Cheek S.A.",
      detalle: "Armado de cajas y reposición.",
      fechaInicio: "2025-06",
    },
  ],
  educacion: [],
  habilidades: [{ categoria: "Técnicas", items: ["Redes FTTH", "Soporte de PC"] }],
  disponibilidad: "inmediata",
  contacto: {
    telefono: "3624-538458",
    email: "juliocesarvelozo@gmail.com",
    ubicacion: "Resistencia, Chaco",
  },
};

const perfil: Perfil = {
  nombre: "Julio César Velozo Fernández",
  telefono: "3624-538458",
  ubicacion: "Resistencia, Chaco",
  email: "juliocesarvelozo@gmail.com",
  rubroObjetivo: "Atención al cliente / Call center",
  firmaMail: "",
  resumen: "",
  skills: ["Atención al cliente", "Redes"],
};

const vacante = { role: "Representante de Atención al Cliente", company: "FiberCorp ITO" };

describe("generarCuerpoDesdeCv", () => {
  it("nunca devuelve un cuerpo vacío, incluso con un CV sin contenido", () => {
    const cuerpo = generarCuerpoDesdeCv(
      { titular: "", perfil: "", experiencia: [], educacion: [], habilidades: [] },
      null,
      { role: "Auxiliar", company: "Empresa S.A." },
    );
    expect(cuerpo.trim().length).toBeGreaterThan(0);
    expect(cuerpo).toContain("Auxiliar");
    expect(cuerpo).toContain("Empresa S.A.");
  });

  it("usa el puesto y la empresa de la vacante en el primer párrafo", () => {
    const cuerpo = generarCuerpoDesdeCv(contenidoBasico, perfil, vacante);
    expect(cuerpo).toContain("Representante de Atención al Cliente");
    expect(cuerpo).toContain("FiberCorp ITO");
  });

  it("incluye la experiencia real con puestos, empresa y fechas legibles", () => {
    const cuerpo = generarCuerpoDesdeCv(contenidoBasico, perfil, vacante);
    expect(cuerpo).toContain("Customer Experience");
    expect(cuerpo).toContain("Apex BPO");
    expect(cuerpo).toContain("08/2022"); // 2022-08 → 08/2022
    expect(cuerpo).toContain("02/2024");
    expect(cuerpo).toContain("Repositor y control de stock");
    expect(cuerpo).toContain("Cheek S.A.");
  });

  it("suma las habilidades del CV y del perfil sin duplicar", () => {
    const cuerpo = generarCuerpoDesdeCv(contenidoBasico, perfil, vacante);
    expect(cuerpo).toContain("Redes FTTH");
    expect(cuerpo).toContain("Soporte de PC");
    expect(cuerpo).toContain("Atención al cliente");
    const ocurrencias = cuerpo.split("Redes FTTH").length - 1;
    expect(ocurrencias).toBe(1);
  });

  it("incluye la disponibilidad (o inmediata por default) y la firma con contacto", () => {
    const cuerpo = generarCuerpoDesdeCv(contenidoBasico, perfil, vacante);
    expect(cuerpo).toContain("Disponibilidad: inmediata.");
    expect(cuerpo).toContain("Julio César Velozo Fernández");
    expect(cuerpo).toContain("3624-538458");
    expect(cuerpo).toContain("juliocesarvelozo@gmail.com");
    expect(cuerpo).toContain("Saludos cordiales");

    const sinCv = generarCuerpoDesdeCv(
      { titular: "", perfil: "", experiencia: [], educacion: [], habilidades: [] },
      perfil,
      vacante,
    );
    expect(sinCv).toContain("Disponibilidad: inmediata.");
    expect(sinCv).toContain("juliocesarvelozo@gmail.com");
  });
});

describe("fechaLegible", () => {
  it("convierte YYYY-MM en MM/YYYY", () => {
    expect(fechaLegible("2022-08")).toBe("08/2022");
    expect(fechaLegible("2025-06-14")).toBe("06/2025");
  });
  it("deja el texto libre tal cual", () => {
    expect(fechaLegible("jun. 2025")).toBe("jun. 2025");
    expect(fechaLegible("")).toBe("");
  });
});
