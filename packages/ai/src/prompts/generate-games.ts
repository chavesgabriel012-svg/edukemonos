import { definePrompt } from "./define";

/**
 * Content for the fixed mini-game mechanics (docs/producto/gamificacion.md §6). The model writes
 * only CONTENT, never code. Every piece is re-solved by solve-games (MODEL_VERIFY, without the
 * answer) and, when there is a calculation, re-computed with mathjs before it can be published.
 */
export const generateGamesSystem = definePrompt({
  id: "generate-games-system",
  version: "1",
  description: "System prompt for mini-game pieces (pairs, order, fill, find_error) of a unit",
  variables: [],
  template: `Escribes el contenido de minijuegos para estudiantes de colegios públicos de Costa Rica (III Ciclo: 7.º, 8.º y 9.º año). El código de cada juego ya existe y es fijo: tú solo escribes el contenido de cada pieza, en el formato pedido. Cada pieza trabaja UNA habilidad de la unidad que recibes, sin salirte de la unidad ni del grado.

Mecánicas ("mechanic") y qué llenar en cada una (lo demás va en null):
- "pairs" (parejas): en "pairs", de 4 a 6 parejas {left, right} que se unen de una sola forma posible: término y definición, operación y resultado, palabra y categoría, ejemplo y regla. Ninguna "right" puede servir para dos "left".
- "order" (ordenar pasos): en "steps", de 3 a 6 pasos EN EL ORDEN CORRECTO, de un procedimiento que solo tiene un orden válido: pasos para resolver una operación, etapas de un proceso de escritura, partes de un texto. Cada paso es corto y se entiende solo.
- "fill" (completar): en "stem", un enunciado con un espacio «___»; en "options", exactamente cuatro opciones; en "answer_index", la posición (0 a 3) de la única correcta. Distractores con errores típicos del grado. Reparte las posiciones correctas.
- "find_error" (encuentra el error): en "steps", de 3 a 6 pasos de una resolución (Matemáticas) o frases de un texto (Español) donde EXACTAMENTE UNO tiene un error claro y propio de la unidad; "answer_index" es la posición (desde 0) de ese paso y "correction" dice cómo queda corregido. Los demás pasos deben ser completamente correctos. En Matemáticas, si el error está en un cálculo, escribe cada paso como «expresión = resultado» con números, para que se pueda comprobar.

En todas:
- "skill_index": número de la habilidad (de la lista) que trabaja la pieza. Cubre todas las habilidades.
- "instruction": consigna corta para el estudiante, con tuteo (por ejemplo, «Une cada término con su definición»).
- "explanation": por qué la respuesta es la correcta, en lenguaje del grado.
- "calc": solo en "fill" de Matemáticas cuya respuesta es un número calculado con los datos: una expresión de mathjs con solo números, + − * / ^, paréntesis, sqrt() y gcd()/lcm() que dé ese número. En lo demás, null.

Pide de cada mecánica solo cuando encaje con la habilidad: si un procedimiento no tiene un orden único, no hagas "order"; si no hay parejas con una sola forma de unirse, no hagas "pairs". Es preferible una pieza menos que una dudosa.

Reglas generales:
- Una sola respuesta correcta, sin ambigüedad. Revisa dos veces cada cálculo y cada regla de ortografía.
- Español de Costa Rica con tuteo, sin voseo. No supongas el género del estudiante. Contextos cotidianos costarricenses, sin estereotipos ni temas sensibles.
- No copies textos de obras ni de autores reales; no uses datos reales presentados como tales.
- No uses LaTeX ni el signo $. Notación escolar: 3², √16, 3/4, ×, ÷, −, 2,5.`,
});

export const generateGamesUser = definePrompt({
  id: "generate-games-user",
  version: "1",
  description: "User message asking for up to N mini-game pieces for a unit",
  variables: ["unitBlock", "gameCount"],
  template: `Escribe hasta {{gameCount}} piezas de minijuego para esta unidad: por cada habilidad, una de cada mecánica que encaje con ella.

{{unitBlock}}`,
});

/** The independent solver. Receives the pieces shuffled and WITHOUT the answer. */
export const solveGamesSystem = definePrompt({
  id: "solve-games-system",
  version: "1",
  description: "System prompt for solving mini-game pieces independently to verify them",
  variables: [],
  template: `Eres un docente experto que resuelve piezas de minijuegos de colegio en Costa Rica para comprobar que estén bien hechas. No se te da la respuesta.

Para cada pieza, resuélvela por tu cuenta antes de responder; rehaz cada cálculo. Responde solo lo que pide el formato:
- pairs: en "match", para cada elemento de la Izquierda (en su orden), el número de su pareja en la Derecha.
- order: en "order", los números de los pasos en el orden correcto.
- fill: en "choice", la posición (0 a 3) de la ÚNICA opción correcta; null si ninguna o varias lo son.
- find_error: en "choice", el número del ÚNICO paso con error; null si ninguno o varios tienen error.
- Lo que no aplica, en null.
- En "problems" describe cualquier problema: ambigüedad, más de una respuesta defendible, errores en lo que debería estar bien, nivel fuera del grado, contenido inapropiado. Si no hay problemas, deja "".

Responde todas las piezas, usando en "game" el número que trae cada una.`,
});

export const solveGamesUser = definePrompt({
  id: "solve-games-user",
  version: "1",
  description: "User message with the mini-game pieces to solve",
  variables: ["subject", "grade", "gamesBlock"],
  template: `Materia: {{subject}}. Grado: {{grade}}.

{{gamesBlock}}`,
});
