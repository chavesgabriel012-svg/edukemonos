/** Optional public contact address (colegios, aliados, prensa). Set NEXT_PUBLIC_CONTACT_EMAIL to show it. */
const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || null;

export const site = {
  name: "Eduka",
  tagline: "estudia a tu ritmo, de 7.º a 9.º",
  description:
    "Estudio con IA para secundaria en Costa Rica, en fase de prueba: diagnóstico, material alineado a los programas del MEP, ejercicios con explicación y Kemo, un tutor que guía sin dar la respuesta.",
  /** Mandatory legal notice (SPEC §4.3). Shown in the footer of every page. */
  independenceNotice:
    "Eduka es una iniciativa independiente. No es una plataforma oficial del Ministerio de Educación Pública.",
  curriculumCredit:
    "Los contenidos curriculares se basan en los programas de estudio oficiales del Ministerio de Educación Pública (MEP) de Costa Rica.",
  contactEmail,
} as const;
