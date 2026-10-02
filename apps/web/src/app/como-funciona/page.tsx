import type { Metadata } from "next";
import Link from "next/link";
import { Kemo } from "@/components/brand/logo";
import { Faq, type FaqItem } from "@/components/site/faq";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "¿Cómo funciona?",
  description: "Qué es Eduka, cómo empezar, cómo funciona el diagnóstico, de dónde sale el contenido y qué ve tu docente.",
};

const ITEMS: FaqItem[] = [
  {
    id: "que-es",
    q: "¿Qué es Eduka?",
    a: (
      <>
        <p>
          Una plataforma gratuita para estudiar los temas de sétimo, octavo y noveno año de los colegios públicos de Costa
          Rica. Tiene material basado en los programas oficiales del MEP, ejercicios con explicación, una prueba
          diagnóstica y un tutor con inteligencia artificial, Kemo.
        </p>
        <p>
          Por ahora hay <strong>Matemáticas y Español</strong>. Ciencias, Estudios Sociales, Inglés y Educación Cívica
          vienen después.
        </p>
        <p>Eduka es una iniciativa independiente: no es una plataforma oficial del Ministerio de Educación Pública.</p>
      </>
    ),
  },
  {
    id: "cuenta",
    q: "¿Necesito crear una cuenta?",
    a: (
      <>
        <p>
          No. Entras y estudias. Tu avance se guarda en este navegador, sin pedirte correo ni contraseña.
        </p>
        <p>
          Si borras los datos del navegador o cambias de celular o computadora, empiezas de cero. Por eso conviene usar
          siempre el mismo dispositivo.
        </p>
      </>
    ),
  },
  {
    id: "empezar",
    q: "¿Cómo empiezo?",
    a: (
      <ul>
        <li>Elige tu año y la materia.</li>
        <li>Si quieres, haz el diagnóstico: te sugiere por dónde empezar.</li>
        <li>Entra a un tema y estudia en tres pestañas: <strong>Aprender</strong>, <strong>Practicar</strong> y <strong>Preguntar a Kemo</strong>.</li>
      </ul>
    ),
  },
  {
    id: "diagnostico",
    q: "¿Qué es el diagnóstico?",
    a: (
      <>
        <p>
          Son unas 10 preguntas de selección única que se adaptan a ti: si aciertas, la siguiente es un poco más difícil;
          si no, un poco más fácil. Al final te da un nivel de 1 a 5 (el 3 es lo esperado en el grado) y ordena los temas
          para que empieces por los que más te conviene reforzar.
        </p>
        <p>No es un examen y no tiene nota. Es una estimación con pocas preguntas: practicar la va afinando.</p>
      </>
    ),
  },
  {
    id: "tema",
    q: "¿Qué encuentro en cada tema?",
    a: (
      <ul>
        <li><strong>Aprender:</strong> un resumen, una explicación paso a paso, ejemplos resueltos y un glosario.</li>
        <li>
          <strong>Practicar:</strong> ejercicios uno por uno. Al responder ves si acertaste y por qué; si fallaste, también
          por qué la opción que elegiste no era. En Español hay tareas de escritura con retroalimentación.
        </li>
        <li><strong>Preguntar a Kemo:</strong> el tutor te guía con preguntas y pistas cuando algo no te queda claro.</li>
      </ul>
    ),
  },
  {
    id: "dominio",
    q: "¿Cómo sabe Eduka cuánto domino un tema?",
    a: (
      <>
        <p>
          Cada respuesta actualiza una estimación de cuánto dominas cada habilidad del tema. Acertar un ejercicio difícil
          sube más que acertar uno fácil, y fallar uno fácil baja más que fallar uno difícil.
        </p>
        <p>
          Con eso cada tema aparece como <strong>Vas muy bien</strong>, <strong>Conviene reforzar</strong> o{" "}
          <strong>Por explorar</strong>, y la lista de temas se ordena para que sepas qué estudiar primero.
        </p>
      </>
    ),
  },
  {
    id: "contenido",
    q: "¿De dónde sale el contenido?",
    a: (
      <>
        <p>
          De los programas de estudio oficiales del MEP. A partir de ellos, una inteligencia artificial redacta el
          material y los ejercicios, y cada tema indica de qué página del programa sale.
        </p>
        <p>
          Antes de publicarse, cada ejercicio pasa por una revisión automática: otra IA lo revisa por separado y, en
          Matemáticas, la respuesta se comprueba con una calculadora exacta. Solo se publican los que pasan.
        </p>
        <p>
          Lo que todavía no revisó una persona lleva la etiqueta <strong>Generado con IA · pendiente de revisión</strong>.
          Si ves un error, toca <strong>Reportar un error</strong>: lo revisamos.
        </p>
      </>
    ),
  },
  {
    id: "seccion",
    q: "¿Qué pasa si me uno a la sección de mi docente?",
    a: (
      <>
        <p>
          Tu docente te da un código. Al unirte escribes tu nombre para que te reconozca, y tu docente podrá ver tu avance:
          ejercicios, diagnóstico, temas consultados y cuántas veces usaste a Kemo.
        </p>
        <p>
          <strong>No ve lo que le escribes a Kemo.</strong> Tu nombre nunca se envía a la inteligencia artificial.
        </p>
        <p>
          <Link href="/unirme" className="font-medium underline underline-offset-2">Únete a tu sección</Link>
        </p>
      </>
    ),
  },
  {
    id: "costo",
    q: "¿Cuánto cuesta?",
    a: <p>Nada. Eduka es gratis para estudiantes y docentes.</p>,
  },
];

export default function HowItWorksPage() {
  return (
    <article className="space-y-8">
      <header className="flex items-center gap-5 rounded-[28px] bg-violeta p-6 text-white sm:p-8">
        <Kemo size={72} background={brand.lima} className="hidden sm:block" />
        <div className="space-y-2">
          <h1 className="font-heading text-4xl leading-none font-bold sm:text-5xl">¿Cómo funciona Eduka?</h1>
          <p className="text-white/85">Todo lo que necesitas saber para estudiar, en preguntas cortas.</p>
        </div>
      </header>
      <Faq items={ITEMS} />
      <p className="text-sm text-muted-foreground">
        ¿Quieres saber más sobre el tutor y los datos?{" "}
        <Link href="/ia" className="font-medium underline underline-offset-2">Kemo y la IA</Link> ·{" "}
        <Link href="/privacidad" className="font-medium underline underline-offset-2">Aviso de privacidad</Link>
      </p>
    </article>
  );
}
