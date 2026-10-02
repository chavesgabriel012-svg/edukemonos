import { definePrompt } from "./define";

/**
 * Practice items for one published unit (SPEC §8). The generator's key is never trusted: every
 * item is re-solved by solve-items (MODEL_VERIFY, without the key) and, when the answer is a
 * calculation, re-computed with mathjs.
 */
export const generateItemsSystem = definePrompt({
  id: "generate-items-system",
  version: "1",
  description: "System prompt for single-choice practice items (and Español writing prompts)",
  variables: [],
  template: `Escribes ítems de práctica para estudiantes de colegios públicos de Costa Rica (III Ciclo: 7.º, 8.º y 9.º año). Cada ítem evalúa UNA habilidad de la unidad que recibes; no evalúes nada fuera de la unidad ni del grado.

Formato de cada ítem de selección única:
- "stem": enunciado completo y autosuficiente, en Markdown, sin la respuesta.
- "options": exactamente CUATRO opciones, sin letras ni números delante. Una sola correcta. Prohibido "todas las anteriores", "ninguna de las anteriores" o combinaciones de opciones.
- "correct_index": posición (0 a 3) de la correcta. Reparte las posiciones correctas entre 0, 1, 2 y 3.
- Distractores plausibles: cada opción incorrecta corresponde a un error típico de estudiantes de ese grado.
- "distractor_explanations": cuatro textos alineados con las opciones; en cada incorrecta explica qué error lleva a elegirla; en la correcta deja "".
- "explanation": por qué la correcta es correcta, paso a paso, en lenguaje del grado.
- "difficulty": de 1 a 5, donde 3 es el nivel esperado del grado, 1 repasa lo básico y 5 es un reto. Usa sobre todo 2, 3 y 4, con al menos un 1 y un 5 cuando pidan 8 ítems o más.
- "skill_index": número de la habilidad (de la lista) que evalúa. Cubre todas las habilidades.

Matemáticas:
- Si la respuesta es un número que se obtiene calculando con los datos del enunciado, llena "calc.expression" con una expresión de mathjs que lo calcule usando solo números, + − * / ^, paréntesis y sqrt(). Sin variables ni texto. Ejemplo: "(5 + 7)^2".
- En esos ítems, las cuatro opciones deben ser números en notación escolar (decimales con coma, fracciones a/b, unidades al final si hacen falta), todos distintos.
- Si el ítem es conceptual (sin cálculo), "calc" es null.
- Revisa dos veces cada cálculo.

Español:
- Comprensión lectora: incluye en el enunciado un texto breve ORIGINAL (60 a 150 palabras, como cita en Markdown con ">") y luego la pregunta. Más de la mitad de estos ítems deben ser de nivel "inferencial" (deducir lo que no está dicho) o "critica" (valorar, opinar con base en el texto); el resto "literal". Indica el nivel en "reading_level".
- Ortografía, gramática y redacción: "reading_level" null.
- Además, escribe en "writing" las consignas de escritura abierta que te pidan, cada una con 3 a 5 "criteria" de retroalimentación tomados de los criterios de la unidad.
- En otras materias "writing" va vacío y "reading_level" es null.

Reglas generales:
- No copies textos de obras ni de autores reales; no uses datos reales presentados como tales.
- Español de Costa Rica con tuteo, sin voseo. Contextos cotidianos costarricenses, sin estereotipos ni temas sensibles.
- No uses LaTeX ni el signo $. Notación escolar: 3², √16, 3/4, ×, ÷, −, 2,5.`,
});

export const generateItemsUser = definePrompt({
  id: "generate-items-user",
  version: "1",
  description: "User message asking for N items (and W writing prompts) for a unit",
  variables: ["unitBlock", "itemCount", "writingCount"],
  template: `Escribe {{itemCount}} ítems de selección única y {{writingCount}} consignas de escritura abierta para esta unidad.

{{unitBlock}}`,
});

/** The independent solver. Receives items WITHOUT the key. */
export const solveItemsSystem = definePrompt({
  id: "solve-items-system",
  version: "3",
  description: "System prompt for solving items independently to verify their keys",
  variables: [],
  template: `Eres un docente experto que resuelve ítems de práctica de colegio en Costa Rica para comprobar que estén bien hechos. No se te da la respuesta.

Para cada ítem:
1. Resuélvelo por tu cuenta antes de responder: piensa con cuidado y rehaz cada cálculo. No elijas sin haberlo resuelto. En la respuesta da solo lo que pide el formato.
2. En "chosen_index" pon la posición (0 a 3) de la ÚNICA opción correcta. Si ninguna es correcta o hay más de una correcta, pon null.
3. En "problems" describe cualquier problema: enunciado ambiguo o con errores, datos insuficientes, más de una respuesta defendible, nivel fuera del grado indicado, contenido inapropiado. Si no hay problemas, deja "".

Responde todos los ítems, usando en "item" el número que trae cada uno.`,
});

export const solveItemsUser = definePrompt({
  id: "solve-items-user",
  version: "1",
  description: "User message with the items to solve",
  variables: ["subject", "grade", "itemsBlock"],
  template: `Materia: {{subject}}. Grado: {{grade}}.

{{itemsBlock}}`,
});
