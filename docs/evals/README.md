# Evaluaciones del tutor

Set: `packages/ai/evals/tutor/cases.json` (62 casos: 30 por materia del plan + 1 de género en cada una). Correr con `pnpm eval:tutor --yes`.
Una corrida parcial (`--subject`, `--ids`, `--limit`) escribe `…-parcial.md` y no pisa el reporte completo.

| Corrida | Tutor | Resultado | Notas |
|---|---|---|---|
| ronda1 | Haiku 4.5, prompt v1 | 38/60 | Primer corte. |
| ronda2 | Haiku 4.5, prompt v2–v3 | 46/60 | Método socrático y tuteo explícitos. |
| claude-haiku-4-5 | Haiku 4.5, prompt v4 | 48/60 (Mat 25, Esp 23) | Falla sobre todo en usar la calculadora (1/4) y en escritura (1/4). |
| claude-sonnet-5-5 (completa) | Sonnet 5.5, prompt v4 | 51/60 (Mat 25, Esp 26) | El reporte completo se sobrescribió por error con la corrida parcial; queda este resumen. Malestar 8/8, datos personales 6/6. Fallos: mat-01, 02, 03, 07, 30, esp-03, 13, 26, 28. |
| (parcial anterior, sobrescrita) | Sonnet 5.5 | 5/5 | Se repitieron mat-01, 02, 03, 07, 30 después de corregir el juez (veía la salida de la calculadora como si el estudiante la leyera). Corregido: ≈56/60. |
| claude-sonnet-5-5-prompt-v5 | Sonnet 5.5, prompt v5 (regla de género) | 52/62 (Mat 27, Esp 25) | Nueva regla automática: suponer el género del estudiante. Seis fallos por género («aunque no estés seguro», «tú mismo», «bienvenida»). |
| claude-sonnet-5-5 | Sonnet 5.5, prompt v6 | 53/62 (Mat 27, Esp 26) | El prompt nombra esas formas; el juez ya no ve los resultados de la calculadora. Quedan 3 fallos por género, 2 por desarrollar un tema ajeno a la unidad (esp-13, mat-14) y 4 aislados (mat-10, esp-07, esp-28, esp-30). |
| claude-sonnet-5-5-parcial | Sonnet 5.5, prompt v6 + filtro neutro | 23/23 | Casos de género, malestar, datos personales, saltarse las reglas y los que habían fallado por género, con el filtro que reescribe en código las frases con género más comunes. |

Desde la corrida de Haiku se añadió un filtro determinista en la salida (voseo → tuteo y teléfonos no verificados),
así que los errores de voseo de esas corridas ya no llegan al estudiante.

Desde el prompt v6 el filtro también reescribe en código las frases con género más comunes
(«estés seguro/a» → «tengas certeza», «tú mismo/a» → «por tu cuenta», «¡Bienvenido/a!» → «¡Te doy la bienvenida!»).
