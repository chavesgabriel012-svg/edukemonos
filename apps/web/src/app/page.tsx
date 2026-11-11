import {
  ArrowRight,
  BookOpenCheck,
  Building2,
  Calculator,
  ClipboardCheck,
  EyeOff,
  FileSearch,
  GraduationCap,
  Grid3x3,
  HandCoins,
  HeartHandshake,
  LifeBuoy,
  MessageCircleQuestion,
  School,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Target,
  Timer,
  UserRoundX,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Kemo } from "@/components/brand/logo";
import { SubjectIcon } from "@/components/brand/subject-icon";
import { ChatPreview, HeatmapPreview } from "@/components/landing/previews";
import { Section, SectionHeading, Tick } from "@/components/landing/section";
import { SHELL } from "@/components/site/page-shell";
import { action } from "@/components/ui/action";
import { brand, subjectColor } from "@/lib/brand";
import { site } from "@/lib/site";
import { contentStats } from "@/lib/stats";
import { RETENTION_DAYS_CHAT, TUTOR_LIMITS } from "@/lib/tutor-server";

export const metadata: Metadata = {
  title: { absolute: "Eduka: estudia a tu ritmo, de 7.º a 9.º, con un tutor que te guía" },
  description: site.description,
};

/** The published counts are read from the database at most once an hour. */
export const revalidate = 3600;

const GRADES = [
  { grade: 7, label: "Sétimo" },
  { grade: 8, label: "Octavo" },
  { grade: 9, label: "Noveno" },
] as const;

const AUDIENCES = [
  { href: "#estudiantes", icon: GraduationCap, label: "Soy estudiante" },
  { href: "#familias", icon: HeartHandshake, label: "Soy mamá, papá o persona encargada" },
  { href: "#docentes", icon: Users, label: "Soy docente" },
  { href: "#colegios", icon: Building2, label: "Dirijo un colegio" },
  { href: "#aliados", icon: HandCoins, label: "Quiero apoyar o invertir" },
] as const;

/** SPEC, anexo B. Checked again against the OECD's PISA 2025 results and the Estado de la Educación 2025 report on 2026-11-11. */
const CHALLENGE = [
  {
    figure: "30 %",
    text: "del estudiantado de 15 años alcanza al menos el nivel básico en matemáticas. En la OCDE, el 65 %.",
    source: "PISA 2025 (OCDE)",
  },
  {
    figure: "53 %",
    text: "alcanza al menos el nivel básico en lectura. En la OCDE, el 69 %.",
    source: "PISA 2025 (OCDE)",
  },
  {
    figure: "4 años",
    text: "de vacío, como mínimo, en comprensión lectora y razonamiento matemático entre los 15 y los 16 años.",
    source: "Estado de la Educación 2025",
  },
] as const;

const STEPS = [
  { icon: Target, title: "Diagnóstico", text: "10 preguntas que se adaptan a cada respuesta. Al final, un nivel de 1 a 5 y una ruta: qué tema estudiar primero." },
  { icon: BookOpenCheck, title: "Aprender", text: "Resumen, explicación paso a paso, ejemplos resueltos y glosario de cada tema, con la página del programa del MEP de donde sale." },
  { icon: ClipboardCheck, title: "Practicar", text: "Un ejercicio a la vez, cerca del nivel de cada estudiante. Al responder se explica por qué cada opción es correcta o no." },
  { icon: MessageCircleQuestion, title: "Preguntar a Kemo", text: "El tutor responde con una pregunta o una pista. Solo explica completo si las pistas no alcanzan o si se lo piden." },
] as const;

const SAFETY = [
  { icon: UserRoundX, title: "Sin cuenta y sin correo", text: "Se estudia sin registrarse. El avance queda asociado al navegador, no a una identidad." },
  { icon: EyeOff, title: "El nombre nunca llega a la IA", text: "Antes de enviar un mensaje se quitan teléfonos, correos, cédulas, direcciones, nombres y colegios que se reconozcan." },
  { icon: LifeBuoy, title: "Si hay señales de malestar", text: "Kemo deja el tema escolar, responde con calidez, anima a hablar hoy con una persona adulta de confianza y la app muestra el 911." },
  { icon: ShieldCheck, title: "El docente no lee los chats", text: "El panel muestra avance y temas consultados, nunca la conversación. Cada acceso del docente queda registrado." },
  { icon: Timer, title: "Límites y borrado", text: `Hasta ${TUTOR_LIMITS.perDay} mensajes por día. Las conversaciones se borran solas a los ${RETENTION_DAYS_CHAT} días.` },
  { icon: FileSearch, title: "Probado antes de cada cambio", text: "64 conversaciones de prueba: que no regale respuestas, no pida datos, no invente y responda bien ante el malestar." },
] as const;

const STATUS = [
  {
    label: "Hoy",
    cls: "bg-lima text-tinta",
    items: [
      "Matemáticas y Español de 7.º, 8.º y 9.º, publicados.",
      "Diagnóstico adaptativo, práctica, escritura con retroalimentación y tutor.",
      "Panel docente con sección de demostración.",
    ],
  },
  {
    label: "En curso",
    cls: "bg-[#EDBB55] text-tinta",
    items: [
      "Revisión del contenido por docentes: hoy lleva la etiqueta «Generado con IA · pendiente de revisión».",
      "Revisión legal del aviso de privacidad (Ley 8968).",
      "Búsqueda de colegios para los primeros pilotos.",
    ],
  },
  {
    label: "Después",
    cls: "bg-secondary text-tinta",
    items: [
      "Ciencias, Estudios Sociales, Inglés y Educación Cívica.",
      "Vista para coordinación con varias secciones.",
      "Primaria y Educación Diversificada.",
    ],
  },
] as const;

const number = new Intl.NumberFormat("es-CR");

function Feature({ icon: Icon, title, text }: { icon: typeof Target; title: string; text: string }) {
  return (
    <li className="space-y-2 rounded-[22px] border bg-card p-5">
      <span className="flex size-10 items-center justify-center rounded-xl bg-lima text-tinta">
        <Icon aria-hidden strokeWidth={2.5} className="size-5" />
      </span>
      <h3 className="font-heading text-xl leading-tight font-bold">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
    </li>
  );
}

function ContactAction({ label, onDark = false }: { label: string; onDark?: boolean }) {
  if (!site.contactEmail) return null;
  return (
    <a href={`mailto:${site.contactEmail}`} className={action({ variant: onDark ? "outline-on-dark" : "outline" })}>
      {label}
    </a>
  );
}

export default async function LandingPage() {
  const stats = await contentStats();
  const numbers = [
    { value: number.format(stats.units), label: "temas del programa oficial, publicados" },
    { value: number.format(stats.exercises), label: "ejercicios verificados uno por uno" },
    { value: number.format(stats.materials), label: "materiales de estudio" },
    { value: "64", label: "pruebas del tutor antes de cada cambio" },
  ];

  return (
    <>
      {/* Hero: students first (they are most visitors), with the way in right here. */}
      <section className="relative overflow-hidden bg-violeta text-white">
        <div className={`${SHELL} grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-20`}>
          <div className="space-y-6">
            <p className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full bg-white/12 px-3.5 py-1.5 font-mono text-xs tracking-wide uppercase">
              <span>Gratis</span>
              <span aria-hidden className="text-lima">·</span>
              <span>Matemáticas y Español</span>
              <span aria-hidden className="text-lima">·</span>
              <span>7.º a 9.º</span>
            </p>
            <h1 className="font-heading text-[2.75rem] leading-[0.95] font-bold tracking-tight text-balance sm:text-6xl lg:text-7xl">
              Un tutor que te guía,
              <span className="block text-lima">sin darte la respuesta.</span>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-white/85">
              Eduka es una plataforma gratuita para estudiantes de colegios públicos de Costa Rica: diagnóstico, material
              basado en los programas del MEP, ejercicios con explicación y Kemo, un tutor con inteligencia artificial
              hecho para menores de edad.
            </p>
            <div className="space-y-3">
              <p id="grado" className="font-medium">¿En qué año estás?</p>
              <ul aria-labelledby="grado" className="grid max-w-md grid-cols-3 gap-2 sm:flex sm:max-w-none sm:flex-wrap sm:gap-3">
                {GRADES.map(({ grade, label }) => (
                  <li key={grade}>
                    <Link href={`/estudiar/${grade}`}
                      className="group flex min-h-[64px] flex-col items-start justify-center gap-1 rounded-[16px] bg-lima px-4 py-3 text-tinta transition hover:-translate-y-0.5 hover:bg-[#b5e51f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:flex-row sm:items-center sm:gap-3 sm:py-2">
                      <span className="font-heading text-3xl leading-none font-bold">{grade}.º</span>
                      <span className="text-sm leading-tight font-medium">{label}<br className="hidden sm:block" /> año</span>
                      <ArrowRight aria-hidden strokeWidth={2.5} className="hidden size-4 transition group-hover:translate-x-0.5 sm:block" />
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-white/80">
                Sin cuenta ni correo.{" "}
                <Link href="/unirme" className="font-medium text-white underline underline-offset-2">¿Tu docente te dio un código?</Link>
              </p>
            </div>
          </div>
          <div className="relative flex justify-center lg:justify-end">
            <Kemo size={112} mood="normal" background={brand.lima}
              className="pointer-events-none absolute -top-16 right-10 hidden rotate-[8deg] lg:block" />
            <div className="relative w-full max-w-md"><ChatPreview /></div>
          </div>
        </div>
      </section>

      {/* Who are you? Each audience jumps to its own part. */}
      <nav aria-label="¿Quién eres?" className="border-b bg-card">
        <div className={`${SHELL} flex gap-2 overflow-x-auto py-3`}>
          {AUDIENCES.map(({ href, icon: Icon, label }) => (
            <a key={href} href={href}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border bg-background px-4 text-sm font-medium transition hover:border-violeta hover:text-violeta focus-visible:outline-2">
              <Icon aria-hidden strokeWidth={2.5} className="size-4" />
              {label}
            </a>
          ))}
        </div>
      </nav>

      {/* The problem, with sources. */}
      <Section id="reto" labelledBy="reto-t">
        <SectionHeading id="reto-t" eyebrow="El reto"
          title="Siete de cada diez estudiantes de 15 años no alcanzan el nivel básico en matemáticas."
          lead="Los resultados de 2025 en matemáticas y lectura son similares a los de 2022: el país no retrocedió, pero tampoco avanza. Con secciones numerosas, ningún docente alcanza a dar práctica y retroalimentación individual todos los días." />
        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {CHALLENGE.map((c) => (
            <li key={c.figure} className="flex flex-col gap-3 rounded-[22px] border bg-card p-6">
              <span className="font-heading text-6xl leading-none font-bold text-violeta">{c.figure}</span>
              <p className="leading-relaxed">{c.text}</p>
              <p className="mt-auto font-mono text-xs text-muted-foreground uppercase">Fuente: {c.source}</p>
            </li>
          ))}
        </ul>
        <p className="mt-8 max-w-3xl text-lg leading-relaxed">
          Eduka no reemplaza la clase. Le da a cada estudiante <strong>práctica diaria con explicación inmediata</strong>,
          alineada al programa oficial, y a cada docente <strong>datos para saber qué reforzar</strong> esta semana.
        </p>
      </Section>

      {/* How it works. */}
      <Section id="como" tone="card" labelledBy="como-t">
        <SectionHeading id="como-t" eyebrow="Cómo funciona" title="Cuatro pasos, en cualquier celular."
          lead="Todo parte de los programas de estudio oficiales del MEP. Cada tema indica de qué página sale." />
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="space-y-3 rounded-[22px] bg-background p-5">
              <span className="flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-xl bg-violeta text-white">
                  <Icon aria-hidden strokeWidth={2.5} className="size-5" />
                </span>
                <span className="font-mono text-xs text-muted-foreground">PASO {i + 1}</span>
              </span>
              <h3 className="font-heading text-2xl leading-tight font-bold">{title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">Disponible hoy:</span>
          {[{ id: "matematicas", name: "Matemáticas" }, { id: "espanol", name: "Español" }].map((s) => (
            <span key={s.id} style={{ background: subjectColor(s.id) }} className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold text-tinta">
              <SubjectIcon subject={s.id} className="size-4" />
              {s.name}
            </span>
          ))}
          <span className="text-sm text-muted-foreground">de 7.º, 8.º y 9.º.</span>
          <Link href="/como-funciona" className="text-sm font-medium underline underline-offset-2">Ver todas las preguntas</Link>
        </div>
      </Section>

      {/* What exists today, counted from the database. */}
      <Section tone="lima" className="py-10 sm:py-12">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
          {numbers.map((n) => (
            <div key={n.label} className="flex flex-col-reverse gap-1">
              <dt className="text-sm leading-snug font-medium">{n.label}</dt>
              <dd className="font-heading text-5xl leading-none font-bold sm:text-6xl">{n.value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* Students. */}
      <Section id="estudiantes" labelledBy="estudiantes-t" className="grid items-center gap-10 lg:grid-cols-2">
        <div className="space-y-6">
          <SectionHeading id="estudiantes-t" eyebrow="Para estudiantes" title="Entra, elige tu año y empieza."
            lead="No te pide correo ni contraseña. Tu avance se guarda en tu celular o computadora." />
          <ul className="space-y-3 text-lg">
            <Tick>El diagnóstico te dice por dónde empezar: no es un examen ni tiene nota.</Tick>
            <Tick>Si fallas un ejercicio, ves por qué la opción que elegiste no era.</Tick>
            <Tick>Kemo te da pistas cuando algo no te queda claro, a la hora que sea.</Tick>
            <Tick>En Español, escribes y recibes comentarios sobre tildes, puntuación y redacción.</Tick>
          </ul>
          <div className="flex flex-wrap gap-3">
            <Link href="/estudiar" className={action({ variant: "primary" })}>Elegir mi año</Link>
            <Link href="/unirme" className={action({ variant: "outline" })}>Tengo un código</Link>
          </div>
        </div>
        <div className="rounded-[28px] bg-tinta p-6 text-papel sm:p-8">
          <p className="font-mono text-xs tracking-wide text-lima uppercase">Tu ruta sugerida</p>
          <ol className="mt-4 space-y-2.5">
            {[
              { t: "Operaciones combinadas", s: "Conviene reforzar", c: "bg-[#EDBB55] text-tinta", v: 38 },
              { t: "Potencias", s: "Conviene reforzar", c: "bg-[#EDBB55] text-tinta", v: 46 },
              { t: "Números enteros", s: "Por explorar", c: "bg-white/15 text-papel", v: 0 },
              { t: "Divisibilidad", s: "Vas muy bien", c: "bg-lima text-tinta", v: 88 },
            ].map((u) => (
              <li key={u.t} className="flex items-center justify-between gap-3 rounded-[16px] bg-white/8 px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{u.t}</span>
                  <span className="mt-1.5 block h-1.5 w-28 overflow-hidden rounded-full bg-white/15">
                    <span className="block h-full rounded-full bg-lima" style={{ width: `${u.v}%` }} />
                  </span>
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${u.c}`}>{u.s}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm text-papel/70">Ejemplo. Tu lista se ordena con tus propias respuestas.</p>
        </div>
      </Section>

      {/* Families. */}
      <Section id="familias" tone="card" labelledBy="familias-t" className="grid gap-10 lg:grid-cols-2">
        <div className="space-y-6">
          <SectionHeading id="familias-t" eyebrow="Para familias" title="Una ayuda para estudiar que no hace la tarea."
            lead="Si su hijo o hija pide la respuesta, Kemo le devuelve una pregunta. La idea es que piense, no que copie." />
          <ul className="space-y-3">
            <Tick>Es gratis y funciona en el navegador del celular: no hay que instalar nada ni crear una cuenta.</Tick>
            <Tick>El contenido sigue los programas oficiales del MEP, los mismos que ve en clase.</Tick>
            <Tick>Kemo no hace tareas ni ensayos. Ayuda a planearlos y a revisarlos.</Tick>
            <Tick>Kemo es una inteligencia artificial y puede equivocarse: cada respuesta tiene un botón para reportar errores.</Tick>
          </ul>
          <div className="flex flex-wrap gap-3">
            <Link href="/ia" className={action({ variant: "primary" })}>Cómo funciona Kemo</Link>
            <Link href="/privacidad" className={action({ variant: "outline" })}>Aviso de privacidad</Link>
          </div>
        </div>
        <div className="space-y-3 rounded-[28px] bg-background p-6 sm:p-8">
          <h3 className="font-heading text-2xl font-bold">Lo que suelen preguntar las familias</h3>
          {[
            { q: "¿Con quién habla mi hijo o hija?", a: "Solo con Kemo, un programa. No hay chat con otras personas, ni perfiles, ni publicaciones." },
            { q: "¿Qué datos se guardan?", a: `Las respuestas a los ejercicios y las conversaciones con Kemo, sin los datos personales que se reconocen. Las conversaciones se borran a los ${RETENTION_DAYS_CHAT} días.` },
            { q: "¿Y si escribe que se siente mal?", a: "Kemo le anima a hablar hoy con una persona adulta de confianza y la aplicación muestra el 911. Kemo no reemplaza a una persona ni da consejo médico." },
            { q: "¿Lo ve su docente?", a: "Solo si se une a una sección con un código, y con su consentimiento. El docente ve el avance, nunca lo que le escribe a Kemo." },
          ].map((f) => (
            <details key={f.q} className="group rounded-[16px] border bg-card px-4 open:pb-4">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 font-medium [&::-webkit-details-marker]:hidden">
                {f.q}
                <span aria-hidden className="text-xl leading-none text-violeta transition group-open:rotate-45">+</span>
              </summary>
              <p className="text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>

      {/* Teachers. */}
      <Section id="docentes" labelledBy="docentes-t" className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <SectionHeading id="docentes-t" eyebrow="Para docentes" title="Sepa qué necesita su sección esta semana."
            lead="Cree una sección, dicte el código en clase y vea el avance de cada estudiante en los temas reales del programa." />
          <ul className="space-y-3">
            <Tick>Mapa de calor estudiantes × temas, con el dominio estimado.</Tick>
            <Tick>Quién podría necesitar apoyo, con la razón a la vista: una señal para conversar, no una etiqueta.</Tick>
            <Tick>Resumen con IA que propone qué hacer en clase y muestra «¿Cómo se calculó?».</Tick>
            <Tick>Errores de escritura por tipo y temas más consultados al tutor.</Tick>
            <Tick>Descarga en CSV para su propia hoja de cálculo.</Tick>
          </ul>
          <div className="flex flex-wrap gap-3">
            <Link href="/docente/demo" className={action({ variant: "primary" })}>Ver la demostración</Link>
            <Link href="/entrar?next=/docente" className={action({ variant: "outline" })}>Entrar con mi correo</Link>
          </div>
        </div>
        <HeatmapPreview />
      </Section>

      {/* School leadership. */}
      <Section id="colegios" tone="card" labelledBy="colegios-t">
        <SectionHeading id="colegios-t" eyebrow="Para direcciones y coordinaciones" title="Un piloto que cabe en cuatro semanas."
          lead="Sin instalación, sin costo y sin pedirle cuentas ni correos al estudiantado. Basta un navegador." />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Feature icon={Smartphone} title="Funciona con lo que hay" text="Celulares de gama baja, laboratorio o computadora de la casa. Se puede agregar a la pantalla de inicio." />
          <Feature icon={School} title="El programa oficial" text="Cada tema cita el programa del MEP y la página de donde sale. No es un currículo paralelo." />
          <Feature icon={Grid3x3} title="Datos para decidir" text="Cada docente ve dominio por tema, actividad semanal y a quién acompañar, con el cálculo explicado." />
          <Feature icon={ShieldCheck} title="Privacidad desde el diseño" text="Datos mínimos, consentimiento al unirse a una sección y registro de cada acceso docente." />
        </ul>
        <ol className="mt-10 grid gap-4 lg:grid-cols-4">
          {[
            { t: "Semana 0", d: "Recorra la sección de demostración con su equipo: 26 estudiantes ficticios sobre los temas reales de 7.º." },
            { t: "Semana 1", d: "Dos o tres docentes crean su sección y dictan el código. El grupo hace el diagnóstico en una lección." },
            { t: "Semanas 2 y 3", d: "Práctica en clase o en casa. El panel muestra qué temas reforzar y quién no ha tenido actividad." },
            { t: "Semana 4", d: "Revisión conjunta: actividad, dominio por tema y lo que opinan docentes y estudiantes. Usted decide si sigue." },
          ].map((s) => (
            <li key={s.t} className="rounded-[22px] bg-tinta p-5 text-papel">
              <p className="font-mono text-xs tracking-wide text-lima uppercase">{s.t}</p>
              <p className="mt-2 text-sm leading-relaxed text-papel/90">{s.d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/docente/demo" className={action({ variant: "primary" })}>Recorrer la demostración</Link>
          <ContactAction label="Proponer un piloto" />
        </div>
      </Section>

      {/* Safety: the part every adult audience asks about. */}
      <Section id="seguridad" tone="tinta" labelledBy="seguridad-t">
        <SectionHeading id="seguridad-t" onDark eyebrow="Seguridad y privacidad" title="Hecho para menores de edad."
          lead="Las reglas no dependen de que la IA «se porte bien»: lo importante se revisa en código antes y después de cada respuesta." />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SAFETY.map(({ icon: Icon, title, text }) => (
            <li key={title} className="space-y-2 rounded-[22px] bg-white/8 p-5">
              <span className="flex size-10 items-center justify-center rounded-xl bg-lima text-tinta">
                <Icon aria-hidden strokeWidth={2.5} className="size-5" />
              </span>
              <h3 className="font-heading text-xl leading-tight font-bold">{title}</h3>
              <p className="text-sm leading-relaxed text-papel/75">{text}</p>
            </li>
          ))}
        </ul>
        <p className="mt-8 max-w-3xl text-sm leading-relaxed text-papel/70">
          Kemo no es un servicio de emergencias ni de ayuda psicológica. El aviso de privacidad es un borrador pendiente de
          revisión legal conforme a la Ley 8968.{" "}
          <Link href="/ia" className="font-medium text-papel underline underline-offset-2">Más sobre Kemo y la IA</Link>
        </p>
      </Section>

      {/* Partners and investors. */}
      <Section id="aliados" labelledBy="aliados-t">
        <SectionHeading id="aliados-t" eyebrow="Para aliados e inversionistas" title="Construido para durar: costos medidos y calidad que no se negocia."
          lead="Las cifras de esta sección salen de los registros de uso de la propia plataforma, no de proyecciones." />
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          <div className="space-y-3 rounded-[22px] border bg-card p-6">
            <Sparkles aria-hidden strokeWidth={2.5} className="size-6 text-violeta" />
            <h3 className="font-heading text-2xl leading-tight font-bold">Contenido que escala</h3>
            <p className="font-heading text-5xl leading-none font-bold text-violeta">US$0,19</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              por tema: generar, revisar y verificar el material y los ejercicios de Matemáticas y Español de 7.º a 9.º
              costó US$18,56 en total. Sumar las cuatro materias que faltan se estima en US$40 a US$46.
            </p>
          </div>
          <div className="space-y-3 rounded-[22px] border bg-card p-6">
            <Calculator aria-hidden strokeWidth={2.5} className="size-6 text-violeta" />
            <h3 className="font-heading text-2xl leading-tight font-bold">Un tutor de centavos</h3>
            <p className="font-heading text-5xl leading-none font-bold text-violeta">≈ US$0,01</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              por mensaje del tutor, medido en noviembre de 2026. Con 80 mensajes al mes durante un curso lectivo, cerca
              de US$7 por estudiante al año. El gasto tiene tope diario y mensual, y límites por estudiante.
            </p>
          </div>
          <div className="space-y-3 rounded-[22px] bg-tinta p-6 text-papel">
            <ShieldCheck aria-hidden strokeWidth={2.5} className="size-6 text-lima" />
            <h3 className="font-heading text-2xl leading-tight font-bold">Primero la calidad</h3>
            <p className="font-heading text-5xl leading-none font-bold text-lima">20 ×</p>
            <p className="text-sm leading-relaxed text-papel/80">
              más barato era el modelo que evaluamos como alternativa. No lo adoptamos: falló casos de malestar y de datos
              personales. Cambiar de modelo es una variable de entorno, y solo se hace cuando pasa las pruebas.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {STATUS.map((s) => (
            <div key={s.label} className="rounded-[22px] border bg-card p-6">
              <span className={`inline-block rounded-full px-3 py-1 font-mono text-xs tracking-wide uppercase ${s.cls}`}>{s.label}</span>
              <ul className="mt-4 space-y-2.5 text-sm leading-relaxed">
                {s.items.map((i) => (
                  <li key={i} className="flex gap-2.5">
                    <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-violeta" />
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-[22px] border bg-card p-6 sm:p-8">
          <h3 className="font-heading text-2xl font-bold">Qué buscamos</h3>
          <ul className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            <Tick><strong>Colegios piloto</strong> que quieran probarlo con dos o tres secciones.</Tick>
            <Tick><strong>Docentes revisores</strong> de Matemáticas y Español para aprobar el contenido.</Tick>
            <Tick><strong>Aliados</strong> que cubran la operación del tutor y la revisión docente.</Tick>
            <Tick><strong>Asesoría legal</strong> en protección de datos de personas menores de edad.</Tick>
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/docente/demo" className={action({ variant: "primary" })}>Ver el producto funcionando</Link>
            <ContactAction label="Conversemos" />
          </div>
        </div>
      </Section>

      {/* Closing call. */}
      <section className="bg-violeta text-white">
        <div className={`${SHELL} flex flex-col items-start gap-6 py-14 sm:flex-row sm:items-center sm:justify-between sm:py-16`}>
          <div className="flex items-center gap-5">
            <Kemo size={88} mood="happy" background={brand.lima} className="hidden sm:block" />
            <div className="space-y-2">
              <h2 className="font-heading text-4xl leading-none font-bold sm:text-5xl">¿Empezamos?</h2>
              <p className="max-w-md text-white/85">Elige tu año y estudia hoy. Si eres docente, mira la sección de demostración.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/estudiar" className={action({ variant: "lima-on-dark" })}>Empezar a estudiar</Link>
            <Link href="/docente/demo" className={action({ variant: "outline-on-dark" })}>Ver la demostración</Link>
          </div>
        </div>
      </section>
    </>
  );
}
