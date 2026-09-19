import type { Perfil } from "@/lib/perfil.model";
import type { CvContenido, CvExperiencia } from "@/lib/supabase/types";

export interface VacanteParaCuerpo {
  role: string;
  company: string;
}

/** Fecha legible (YYYY-MM → "MM/YYYY"; texto libre se deja tal cual). */
export function fechaLegible(fecha?: string): string {
  if (!fecha) return "";
  const t = fecha.trim();
  if (/^\d{4}-\d{2}(-\d{2})?$/.test(t)) {
    const [anio, mes] = t.split("-");
    return `${mes}/${anio}`;
  }
  return t;
}

function rangoFechas(exp: CvExperiencia): string {
  const inicio = fechaLegible(exp.fechaInicio);
  const fin = exp.actualmente ? "actualidad" : fechaLegible(exp.fechaFin);
  if (!inicio && !fin) return "";
  return ` (${[inicio, fin].filter(Boolean).join(" – ")})`;
}

function construirFirma(contenido: CvContenido, perfil: Perfil | null): string {
  const nombre = contenido.titular.trim() || perfil?.nombre.trim() || "";
  const tel = contenido.contacto?.telefono?.trim() || perfil?.telefono.trim() || "";
  const email = contenido.contacto?.email?.trim() || perfil?.email.trim() || "";
  const ubicacion = contenido.contacto?.ubicacion?.trim() || perfil?.ubicacion.trim() || "";
  const datos = [tel, email, ubicacion].filter(Boolean).join(" · ");
  return [nombre, datos].filter(Boolean).join("\n");
}

/** Arma el cuerpo del email a partir de la información REAL del CV y el
 * perfil, sin inventar nada. Se usa como respaldo determinístico cuando la IA
 * no devuelve un cuerpo (fallo, JSON incompleto o cuerpo vacío). Nunca lanza y
 * siempre devuelve un texto no vacío mientras haya puesto/empresa de la vacante. */
export function generarCuerpoDesdeCv(
  contenido: CvContenido,
  perfil: Perfil | null,
  vacante: VacanteParaCuerpo,
): string {
  const lineas: string[] = [];

  lineas.push("Estimados/as, buenos días:");
  lineas.push("");
  lineas.push(
    `Me presento para postularme al puesto de ${vacante.role}${vacante.company ? ` en ${vacante.company}` : ""}.`,
  );

  const resumen = contenido.perfil.trim() || perfil?.resumen.trim();
  if (resumen) {
    lineas.push("");
    lineas.push(resumen);
  }

  const puestos = contenido.experiencia.filter((e) => e.puesto.trim());
  if (puestos.length) {
    lineas.push("");
    lineas.push("Mi experiencia incluye:");
    for (const exp of puestos.slice(0, 4)) {
      const titulo = [exp.puesto, exp.empresa].filter(Boolean).join(" — ");
      lineas.push(`• ${titulo}${rangoFechas(exp)}`);
      const detalle = exp.detalle.trim();
      if (detalle) lineas.push(`  ${detalle}`);
    }
  }

  const skills = new Set<string>();
  perfil?.skills.forEach((s) => s.trim() && skills.add(s.trim()));
  contenido.habilidades.forEach((c) => c.items.forEach((s) => s.trim() && skills.add(s.trim())));
  const skillsList = [...skills].slice(0, 8);
  if (skillsList.length) {
    lineas.push("");
    lineas.push(`Entre mis habilidades se destacan: ${skillsList.join(", ")}.`);
  }

  const disponibilidad = contenido.disponibilidad?.trim();
  lineas.push("");
  lineas.push(`Disponibilidad: ${disponibilidad || "inmediata"}.`);

  lineas.push("");
  lineas.push(
    "Quedo a disposición para coordinar una entrevista y ampliar la información. Les agradezco su tiempo.",
  );
  lineas.push("");
  lineas.push("Saludos cordiales,");
  lineas.push("");
  lineas.push(construirFirma(contenido, perfil));

  return lineas.join("\n").trim();
}
