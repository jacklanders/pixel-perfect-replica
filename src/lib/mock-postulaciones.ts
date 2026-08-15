import { useSyncExternalStore } from "react";

export type EstadoPostulacion = "enviada" | "descartada" | "pendiente";

export type Postulacion = {
  id: string;
  puesto: string;
  empresa: string;
  ubicacion: string;
  mailContacto: string;
  fuente: string;
  vence: string;
  vencido: boolean;
  requisitos: { texto: string; cumple: boolean | null }[];
  asuntoGenerico: string;
  asuntoObligatorio?: string;
  cuerpo: string;
  cvAdjunto: string;
  estado: EstadoPostulacion;
  motivo?: string;
  actualizado: string;
};

export const usuario = {
  nombre: "María Paz Duarte",
  mail: "mariapaz@gmail.com",
  rubro: "Ejecutiva de cuentas | Atención al cliente",
  telefono: "+54 9 379 000 0000",
  ubicacion: "Corrientes, Argentina",
};

export const firmaMail = `${usuario.nombre}
${usuario.rubro}
${usuario.telefono} · ${usuario.mail}
${usuario.ubicacion}`;

export const cvsDisponibles = [
  "CV general — Product Manager",
  "CV adaptado — Fintech Sr. PM",
  "CV en inglés — Remote PM",
] as const satisfies readonly string[];

export const LIMITE_DIARIO = 2;

const cuerpoBase = (puesto: string, empresa: string, extra: string) =>
  `Hola, buen día:

Me contacto por la búsqueda de ${puesto} en ${empresa}. Trabajo hace seis años en atención al cliente y gestión de cuentas corporativas, actualmente con una cartera de 120 cuentas, donde reduje el tiempo de resolución de reclamos de 48 a 26 horas.

${extra}

Adjunto mi CV y quedo a disposición para una entrevista.

Saludos cordiales,
${firmaMail}`;

let postulaciones: Postulacion[] = [
  {
    id: "1",
    puesto: "Ejecutiva de cuentas corporativas",
    empresa: "Naranja X",
    ubicacion: "Corrientes (híbrido)",
    mailContacto: "seleccion@naranjax.com",
    fuente: "Texto pegado",
    vence: "22/08/2026",
    vencido: false,
    requisitos: [
      { texto: "3+ años en gestión de cuentas", cumple: true },
      { texto: "Manejo de CRM", cumple: true },
      { texto: "Vehículo propio", cumple: false },
    ],
    asuntoGenerico: "Postulación — Ejecutiva de cuentas corporativas | María Paz Duarte",
    asuntoObligatorio: "REF-4471 ECC Corrientes",
    cuerpo: cuerpoBase(
      "Ejecutiva de cuentas corporativas",
      "Naranja X",
      "Aclaro que actualmente no cuento con vehículo propio, aunque tengo disponibilidad plena para viajes dentro de la provincia y experiencia coordinando visitas con transporte de la empresa.",
    ),
    cvAdjunto: cvsDisponibles[0],
    estado: "enviada",
    actualizado: "hace 2 horas",
  },
  {
    id: "2",
    puesto: "Líder de equipo de soporte",
    empresa: "Mercado Pago",
    ubicacion: "Remoto LatAm",
    mailContacto: "talento@mercadopago.com",
    fuente: "Imagen del aviso",
    vence: "15/08/2026",
    vencido: false,
    requisitos: [
      { texto: "Experiencia liderando equipos de 5+ personas", cumple: null },
      { texto: "Inglés intermedio", cumple: true },
    ],
    asuntoGenerico: "Postulación — Líder de equipo de soporte | María Paz Duarte",
    cuerpo: cuerpoBase(
      "Líder de equipo de soporte",
      "Mercado Pago",
      "Coordiné de manera informal a un grupo de tres asesores durante la última migración de CRM, definiendo prioridades y capacitación.",
    ),
    cvAdjunto: cvsDisponibles[1],
    estado: "pendiente",
    actualizado: "ayer",
  },
  {
    id: "3",
    puesto: "Analista de comercio exterior",
    empresa: "Grupo Insur",
    ubicacion: "Buenos Aires (presencial)",
    mailContacto: "rrhh@grupoinsur.com",
    fuente: "Texto pegado",
    vence: "01/08/2026",
    vencido: true,
    requisitos: [
      { texto: "Título en Comercio Exterior", cumple: false },
      { texto: "Residencia en CABA", cumple: false },
    ],
    asuntoGenerico: "Postulación — Analista de comercio exterior | María Paz Duarte",
    cuerpo: cuerpoBase("Analista de comercio exterior", "Grupo Insur", ""),
    cvAdjunto: cvsDisponibles[0],
    estado: "descartada",
    motivo: "No cumple requisitos excluyentes: título específico y residencia en CABA.",
    actualizado: "hace 5 días",
  },
];

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function usePostulaciones() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => postulaciones,
    () => postulaciones,
  );
}

export function getPostulacion(id: string) {
  return postulaciones.find((p) => p.id === id);
}

export function actualizarPostulacion(id: string, patch: Partial<Postulacion>) {
  postulaciones = postulaciones.map((p) =>
    p.id === id ? { ...p, ...patch, actualizado: "recién" } : p,
  );
  emit();
}

export function crearPostulacion(data: {
  puesto: string;
  empresa: string;
  ubicacion: string;
  mailContacto: string;
  fuente: string;
}) {
  const id = String(Date.now());
  const nueva: Postulacion = {
    id,
    ...data,
    vence: "30/08/2026",
    vencido: false,
    requisitos: [
      { texto: "Experiencia en atención al cliente", cumple: true },
      { texto: "Disponibilidad para mudarse", cumple: null },
    ],
    asuntoGenerico: `Postulación — ${data.puesto} | ${usuario.nombre}`,
    cuerpo: cuerpoBase(data.puesto, data.empresa, ""),
    cvAdjunto: cvsDisponibles[0],
    estado: "pendiente",
    actualizado: "recién",
  };
  postulaciones = [nueva, ...postulaciones];
  emit();
  return id;
}

export const estadoLabel: Record<EstadoPostulacion, string> = {
  enviada: "Enviada",
  descartada: "Descartada",
  pendiente: "Pendiente",
};

export function mailsEnviadosHoy() {
  return postulaciones.filter((p) => p.estado === "enviada").length;
}
