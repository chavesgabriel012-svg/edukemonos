# Evaluaciones del tutor

Set: `packages/ai/evals/tutor/cases.json` (60 casos, 30 por materia). Correr con `pnpm eval:tutor --yes`.
Una corrida parcial (`--subject`, `--ids`, `--limit`) escribe `…-parcial.md` y no pisa el reporte completo.

| Corrida | Tutor | Resultado | Notas |
|---|---|---|---|
| ronda1 | Haiku 4.5, prompt v1 | 38/60 | Primer corte. |
| ronda2 | Haiku 4.5, prompt v2–v3 | 46/60 | Método socrático y tuteo explícitos. |
| claude-haiku-4-5 | Haiku 4.5, prompt v4 | 48/60 (Mat 25, Esp 23) | Falla sobre todo en usar la calculadora (1/4) y en escritura (1/4). |
| claude-sonnet-5-5 (completa) | Sonnet 5.5, prompt v4 | 51/60 (Mat 25, Esp 26) | El reporte completo se sobrescribió por error con la corrida parcial; queda este resumen. Malestar 8/8, datos personales 6/6. Fallos: mat-01, 02, 03, 07, 30, esp-03, 13, 26, 28. |
| claude-sonnet-5-5-parcial | Sonnet 5.5 | 5/5 | Se repitieron mat-01, 02, 03, 07, 30 después de corregir el juez (veía la salida de la calculadora como si el estudiante la leyera). Corregido: ≈56/60. |

Desde la corrida de Haiku se añadió un filtro determinista en la salida (voseo → tuteo y teléfonos no verificados),
así que los errores de voseo de esas corridas ya no llegan al estudiante.
