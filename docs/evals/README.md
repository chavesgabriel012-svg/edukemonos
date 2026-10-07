# Evaluaciones del tutor

Set: `packages/ai/evals/tutor/cases.json` (64 casos: 30 por materia del plan + 1 de género y 1 de otra unidad de la misma materia en cada una). Correr con `pnpm eval:tutor --yes`.
Una corrida parcial (`--subject`, `--ids`, `--limit`) escribe `…-parcial.md` y no pisa el reporte completo.

| Corrida | Tutor | Resultado | Notas |
|---|---|---|---|
| ronda1 | Haiku 4.5, prompt v1 | 38/60 | Primer corte. |
| ronda2 | Haiku 4.5, prompt v2–v3 | 46/60 | Método socrático y tuteo explícitos. |
| claude-haiku-4-5 | Haiku 4.5, prompt v4 | 48/60 (Mat 25, Esp 23) | Falla sobre todo en usar la calculadora (1/4) y en escritura (1/4). |
| claude-sonnet-5-5 (completa) | Sonnet 5.5, prompt v4 | 51/60 (Mat 25, Esp 26) | El reporte completo se sobrescribió por error con la corrida parcial; queda este resumen. Malestar 8/8, datos personales 6/6. Fallos: mat-01, 02, 03, 07, 30, esp-03, 13, 26, 28. |
| (parcial anterior, sobrescrita) | Sonnet 5.5 | 5/5 | Se repitieron mat-01, 02, 03, 07, 30 después de corregir el juez (veía la salida de la calculadora como si el estudiante la leyera). Corregido: ≈56/60. |
| claude-sonnet-5-5-prompt-v5 | Sonnet 5.5, prompt v5 (regla de género) | 52/62 (Mat 27, Esp 25) | Nueva regla automática: suponer el género del estudiante. Seis fallos por género («aunque no estés seguro», «tú mismo», «bienvenida»). |
| claude-sonnet-5-5 (v6, en el historial de git) | Sonnet 5.5, prompt v6 | 53/62 (Mat 27, Esp 26) | El prompt nombra esas formas; el juez ya no ve los resultados de la calculadora. Quedan 3 fallos por género, 2 por desarrollar un tema ajeno a la unidad (esp-13, mat-14) y 4 aislados (mat-10, esp-07, esp-28, esp-30). |
| claude-sonnet-5-5 | Sonnet 5.5, prompt v8 | 58/64 (Mat 30, Esp 28) | v7: ayuda con dudas de la misma materia aunque sean de otra unidad (con el mismo método), no explica temas de otra materia o nivel, revisa todos los errores de un texto y no corrige la ortografía de mensajes casuales. v8: el tutor se presenta como Kemo. La regla de la calculadora ahora solo cuenta resultados («= 12», «da 25») que no vengan de la calculadora. Pasan los 6 casos atacados (mat-10, mat-14, esp-07, esp-13, esp-28, esp-30) y los 2 nuevos de otra unidad. De los 6 fallos, 2 eran falsos positivos de la regla de la calculadora («¿cuánto da 2 + 3 × 4?») y 1 lo causó el filtro de voseo («Sos una IA», un error de tipeo por «Soy», pasó a «Eres una IA»); los tres quedaron corregidos en código. Quedan esp-09 (lectura: da la inferencia de entrada), esp-11 («¿Listo?», ahora reescrito en código) y esp-14 (confunde la tilde de «cuál» con la diacrítica). |
| 2026-10-03 · claude-sonnet-5-5 | Sonnet 5.5, prompt v9 | **62/64** (Mat 31, Esp 31) | v9: no convierte mensajes casuales en ejercicios de ortografía; en lectura pide primero las pistas. Fallos: mat-13 (ante «¿para qué sirve esto?» dio todos los ejemplos de entrada) y esp-03 (truco de sustitución equivocado para la tilde diacrítica: cambió «tú» por «ella»). |
| 2026-10-03 · parcial | Sonnet 5.5, prompt v10 | 15/16 socráticos y de escritura; mat-09 2/2 al repetirlo | v10 corrige los dos fallos de v9 (pasan mat-13 y esp-03). El fallo de mat-09 (no terminó con pregunta) fue variación del modelo: había pasado en la corrida completa y pasó las dos veces que se repitió. |
| claude-sonnet-5-5-parcial | Sonnet 5.5, prompt v6 + filtro neutro | 23/23 | Casos de género, malestar, datos personales, saltarse las reglas y los que habían fallado por género, con el filtro que reescribe en código las frases con género más comunes. |

Desde la corrida de Haiku se añadió un filtro determinista en la salida (voseo → tuteo y teléfonos no verificados),
así que los errores de voseo de esas corridas ya no llegan al estudiante.

Desde el prompt v6 el filtro también reescribe en código las frases con género más comunes
(«estés seguro/a» → «tengas certeza», «tú mismo/a» → «por tu cuenta», «¡Bienvenido/a!» → «¡Te doy la bienvenida!»).
