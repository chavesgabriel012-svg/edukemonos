# Diagnóstico y dominio

> Código: `packages/curriculum/src/learning.ts` (referencia, con pruebas) y `supabase/migrations/20261004000100_student_learning.sql` (lo que corre de verdad, dentro de la base de datos). `supabase/tests` comprueba que ambos dan los mismos números.

## Por qué este modelo

El SPEC (§9) pide algo simple, documentado y con pruebas, "estilo Elo o actualización bayesiana ligera". Usamos un **modelo logístico de un parámetro** (tipo Rasch), que es lo que hay debajo de Elo:

- Cada ítem tiene una dificultad `d` de 1 a 5 (la asigna el generador y la revisa el verificador). La ubicamos en la escala en `b(d) = (d − 3) × 0,8`: **3 es lo que se espera en el grado**, 1 repasa lo básico, 5 es un reto.
- La probabilidad de acertar es `P = σ(θ − b(d))`, con `σ(x) = 1 / (1 + e^(−x))` y `θ` la habilidad del estudiante en esa misma escala.

Ventajas para un MVP de 16 días: no hay que calibrar ítems con datos que todavía no existen (usamos la dificultad declarada), cada actualización es una cuenta de una línea, y el resultado se puede explicar ("acertaste un reto, subes más que con uno fácil").

Limitación conocida: las dificultades no están calibradas con respuestas reales. Cuando haya suficientes intentos se pueden recalibrar (por ejemplo, ajustando `b` de cada ítem con su tasa de aciertos) sin cambiar el resto.

## Dominio por habilidad

`mastery.score` es la probabilidad de resolver un ítem **del nivel del grado** (d = 3) de esa habilidad: `score = σ(θ)`.

- Sin datos: no hay fila (la interfaz dice "por explorar"). La primera respuesta parte de `θ = 0` (0,5).
- Tras cada respuesta calificada (práctica o diagnóstico) de un ítem, para cada habilidad del ítem:
  `θ' = θ + K × (acierto − P)`, con `K = max(0,3; 1,2 / (1 + 0,25 × intentos previos))`.
  `K` grande al principio (pocas respuestas mueven mucho) y luego se asienta.
- El puntaje se limita a [0,02; 0,98]: una sola respuesta nunca da certeza total.

Ejemplo (el mismo vector de las pruebas): acierta d3 → 0,646; acierta d4 → 0,755; falla d4 → 0,660; acierta d2 → 0,688; falla d5 → 0,647.

Lo calcula `submit_attempt` en la base de datos: el estudiante no puede escribir su propio dominio (RLS lo impide y hay pruebas que lo intentan).

## Prueba diagnóstica

- **Ítems:** solo de selección única, **verificados** y publicados, de la materia y el grado (`submit_attempt` rechaza cualquier otro en un diagnóstico).
- **Largo:** 10 ítems (el SPEC pide 8 a 12), o menos si se acaban los disponibles.
- **Adaptación (escalera):** empieza en dificultad 3; acierto → sube un nivel, fallo → baja uno (entre 1 y 5).
- **Cobertura:** entre los ítems más cercanos a la dificultad buscada, se elige el de la unidad menos preguntada hasta ahora (y en orden del programa), para recorrer la materia y no quedarse en un solo tema. Nunca repite un ítem.
- **Nivel estimado:** al cerrar, `finish_diagnostic` calcula `θ` por máximo a posteriori con un previo normal estándar (método de Newton). El previo evita que 10 de 10 dé un nivel infinito. Se informa en la escala de dificultad: `nivel = 3 + θ / 0,8`, entre 1 y 5, con un decimal.
- **Detalle por habilidad:** el dominio actual de cada habilidad que el diagnóstico tocó.

## Cómo se le explica al estudiante

Sin etiquetas negativas (SPEC §9):

| Nivel | Mensaje |
|---|---|
| ≥ 3,5 | "Vas muy bien: dominas lo que se espera en este grado y puedes ir por retos." |
| 2,5 – 3,5 | "Vas bien encaminado: tienes la base del grado y hay temas que puedes afianzar." |
| < 2,5 | "Conviene repasar las bases: empieza por los temas sugeridos, paso a paso." |

Habilidades con dominio ≥ 0,7 aparecen como "Vas muy bien en…"; con < 0,5, como "Conviene reforzar…".

## Ruta sugerida

Por unidad: dominio = promedio del dominio de sus habilidades que tienen datos.

1. **Reforzar** (dominio < 0,5), en el orden del programa.
2. **Por explorar** (sin datos, o entre 0,5 y 0,7), en el orden del programa.
3. **Dominadas** (≥ 0,7), al final.

El orden del programa del MEP es nuestra aproximación a los prerrequisitos (los programas presentan primero lo que se necesita después). La tabla `skill_prerequisites` existe pero está vacía; cuando se llene, la ruta puede respetarla explícitamente.
