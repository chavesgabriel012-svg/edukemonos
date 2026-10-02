# Presupuesto: agregar Ciencias, Estudios Sociales, Inglés y Educación Cívica (7.º a 9.º)

Estimación del 2 de octubre de 2026, con el gasto real registrado en `ai_usage` al generar Matemáticas y Español.
Solo incluye el costo de la API de IA; los programas del MEP ya están registrados y verificados en
`scripts/ingest/sources.json`.

## Lo que costó Matemáticas y Español

| Paso | Llamadas | Costo |
|---|---|---|
| Estructura del programa (unidades por grado) | 15 | $0,87 |
| Material (resumen, explicación, ejemplos, glosario) | 124 | $5,85 |
| Verificación del material | 124 | $2,45 |
| Ejercicios | 97 | $8,18 |
| Verificación de ejercicios | 99 | $1,21 |
| **Total del contenido** | | **$18,56** |

Resultado: 96 unidades (6 combinaciones de materia y grado), 383 materiales y 803 ejercicios publicados.
Eso da **unos $0,19 por unidad** y unos $3,10 por materia y grado. Las evaluaciones del tutor costaron $6,10 aparte.

## Estimación para las cuatro materias

| Materia | Unidades estimadas (7.º–9.º) | Base | Contenido |
|---|---|---|---|
| Ciencias | ~42 | ~18 páginas de contenido por grado, como Matemáticas | ~$8 |
| Estudios Sociales | ~42 | ~23 páginas por grado, organizado por temas | ~$8 |
| Inglés | 18–36 | 6 unidades por año, cada una con varios escenarios | $4–7 |
| Educación Cívica | 12–24 | Unidades por trimestre | $3–5 |
| **Subtotal** | **~115–145** | | **$23–28** |

| Otros costos | |
|---|---|
| Estructura de los 4 programas (12 grados) | ~$2 |
| Reintentos y ajustes de prompts para materias nuevas (+30 %) | ~$8 |
| Evaluaciones del tutor: 30 casos por materia (120 casos, ~$2 por corrida, ~4 rondas) | ~$8 |
| **Total estimado** | **~$40–46** (rango prudente: $35–55) |

## Cómo conviene hacerlo

- **Una materia por día.** El límite diario de $15 lo comparten la generación y el tutor de los estudiantes.
  Cada materia cuesta entre $8 y $14 contando sus evaluaciones, así que en unos 4 días quedan las cuatro sin
  dejar a los estudiantes sin tutor. Si se quiere en menos días, hay que subir el límite diario mientras tanto.
- **Límite mensual.** En octubre ya van unos $25. Para agregar las cuatro materias hay que subir
  `AI_BUDGET_MONTHLY_USD` a unos $90 y tener ese saldo en la cuenta de Anthropic.
- **Orden sugerido:** Ciencias y Estudios Sociales primero (más parecidas a lo que ya funciona), luego
  Educación Cívica y por último Inglés.

## Trabajo previo, sin costo de IA

- Mapear las páginas de 9.º en Ciencias y Estudios Sociales, y las de todos los grados en Inglés y Cívica
  (hoy están marcadas como pendientes).
- **Inglés:** el material y los ejercicios van en inglés con explicaciones en español; hay que adaptar los prompts
  de generación, la retroalimentación de escritura (sus categorías de error son otras) y el tutor.
- **Estudios Sociales y Cívica:** más cuidado con fechas, datos y temas sensibles; el tutor debe mantener
  neutralidad política y no inventar datos (ya lo evalúa la categoría «honestidad»).
- **Ciencias:** el tutor ya tiene la calculadora activada para esta materia.

## Lo que no cambia

El costo de operar el tutor depende de cuántos estudiantes lo usan, no de cuántas materias hay: alrededor de
$0,01 por mensaje con Sonnet 5.5 y la caché de instrucciones.
