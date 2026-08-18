import { describe, expect, it } from "vitest";
import { filaACv, hace } from "../cv.model";
import type { ResumeRow } from "../supabase/types";

const baseRow: ResumeRow = {
  id: "00000000-0000-0000-0000-000000000001",
  user_id: "00000000-0000-0000-0000-000000000000",
  title: "CV Principal",
  is_primary: true,
  source_type: "created_from_scratch",
  structured_json: {
    titular: "Desarrollador Full Stack",
    perfil: "Perfil profesional",
    experiencia: [{ id: "1", puesto: "Dev", empresa: "ACME", detalle: "Detalle" }],
  },
  extracted_text: null,
  file_path_original: null,
  version: 1,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("cv.model", () => {
  it("mapea fila de resumes a Cv", () => {
    const cv = filaACv(baseRow);
    expect(cv.id).toBe(baseRow.id);
    expect(cv.title).toBe("CV Principal");
    expect(cv.isPrimary).toBe(true);
    expect(cv.contenido.titular).toBe("Desarrollador Full Stack");
    expect(cv.contenido.experiencia).toHaveLength(1);
  });

  it("normaliza contenido inválido a valores por defecto", () => {
    const row: ResumeRow = { ...baseRow, structured_json: null };
    const cv = filaACv(row);
    expect(cv.contenido.titular).toBe("");
    expect(cv.contenido.perfil).toBe("");
    expect(cv.contenido.experiencia).toEqual([]);
  });

  it("hace() describe correctamente tiempos relativos", () => {
    const ahora = new Date("2026-01-01T12:00:00Z");
    expect(hace("2026-01-01T11:55:00Z", ahora)).toBe("hace 5 min");
    expect(hace("2026-01-01T10:00:00Z", ahora)).toBe("hace 2 h");
    expect(hace("2025-12-31T12:00:00Z", ahora)).toBe("ayer");
    expect(hace("2025-12-30T12:00:00Z", ahora)).toBe("hace 2 días");
  });
});
