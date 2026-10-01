# Estudio de modelos de IA para Edukemonos

> **Fecha:** 1 de octubre de 2026. Precios y términos leídos en las páginas oficiales ese día (fuentes al final).
> Los costos por estudiante usan los mismos **supuestos de uso** que [`docs/ai-costs.md`](ai-costs.md) (uso "típico": 8 días al mes, unos 80 mensajes al tutor, con caché de prompts). Son estimaciones, no mediciones.
> Recalcular: `node scripts/cost/estimate.ts`.

## 1. Resumen

1. **El tutor es más del 90 % del costo**, así que la decisión importante es qué modelo atiende el chat. Generar y verificar contenido es un gasto único y pequeño (≈ US$150 para Español y Matemáticas 7.º–9.º).
2. **Gemini (Google) queda descartado**: sus términos prohíben usar la API en apps dirigidas a menores de 18 años o que probablemente usen menores.
3. **OpenAI es la opción más barata** (`gpt-6-luna`, ≈ US$0,16 por estudiante al mes), pero para menores de 13 (parte de 7.º año) exige **retención cero de datos**, que hay que solicitar a OpenAI, y según sus términos (no pude abrir el texto original) también **permiso del padre, madre o encargado** para menores de 18.
4. **Dentro de Claude, Haiku 4.5 como tutor** baja el costo típico de US$2,25 a **≈ US$0,45 por estudiante al mes** (5 veces menos que Opus 5.5) sin cambiar de proveedor ni de reglas.
5. **Recomendación:** empezar con **Haiku 4.5 como tutor**, Sonnet 5.5 para generar contenido y Opus 5.5 solo para verificar ítems (gasto único). En la Fase 4, comparar con las evals del tutor Haiku 4.5, Sonnet 5.5 sin razonamiento y `gpt-6-luna`, y quedarse con el más barato que pase. Cambiar de modelo es solo cambiar variables de entorno.

## 2. Comparación

Costo por **estudiante activo**, uso típico, con caché. En todas las filas la generación usa Sonnet 5.5 y la verificación Opus 5.5, salvo C2. Para 1.000 estudiantes registrados se asume que 70 % están activos.

| Opción | Tutor | ¿Permitido con menores? | Estudiante / mes | Estudiante / año | 1.000 estudiantes / año |
|---|---|---|---:|---:|---:|
| A (anterior) | Claude Opus 5.5 | Sí, con salvaguardas | $2,25 | $22,52 | $15.826 |
| B | Claude Sonnet 5.5 | Sí, con salvaguardas | $1,24 | $12,44 | $8.739 |
| B0 | Claude Sonnet 5.5 sin razonamiento | Sí, con salvaguardas | $0,88 | $8,82 | $6.191 |
| **C** | **Claude Haiku 4.5** | **Sí, con salvaguardas** | **$0,45** | **$4,48** | **$3.142** |
| C2 | Claude Haiku 4.5 (también genera; Sonnet verifica) | Sí, con salvaguardas | $0,37 | $3,70 | $2.598 |
| D | OpenAI `gpt-6.1-sol` | Sí, con permiso parental y retención cero para menores de 13 | $1,09 | $10,92 | $7.673 |
| E | OpenAI `gpt-6-luna` | Sí, con permiso parental y retención cero para menores de 13 | $0,16 | $1,63 | $1.143 |
| G | Google Gemini 3.8 Flash | **No** (términos de la API) | $0,47 | $4,70 | $3.303 |

**Techo** (límites del tutor al máximo, 60 mensajes cada día lectivo): A $34/mes · C $6,52/mes · E $1,92/mes por estudiante. Bajar los límites del tutor reduce el techo en proporción.

### Precios usados (USD por millón de tokens)

| Modelo | Entrada | Entrada en caché | Salida (incluye razonamiento) |
|---|---:|---:|---:|
| Claude Opus 5.5 | 4,00 | 0,20 | 20,00 |
| Claude Sonnet 5.5 | 2,00 | 0,20 | 10,00 |
| Claude Haiku 4.5 | 1,00 | 0,10 | 5,00 |
| OpenAI gpt-6.1-sol | 2,00 | 0,10 | 10,00 |
| OpenAI gpt-6-luna | 0,10 | 0,01 | 0,50 |
| Gemini 3.8 Flash (hasta 31/12/2026; se duplica desde el 1/1/2027) | 0,75 | 0,075 | 3,75 |
| Gemini 3.5 Flash-Lite | 0,30 | 0,03 | 2,50 |

Todos ofrecen 50 % de descuento en procesamiento por lotes (útil solo para generar contenido, no para el tutor).

## 3. Condiciones de uso con menores (lo que más pesa)

| Proveedor | Qué dicen sus términos | Qué implica para Edukemonos |
|---|---|---|
| **Anthropic (Claude)** | Las organizaciones que permiten a menores interactuar con productos basados en su API deben implementar salvaguardas: verificación de edad, moderación y filtros, monitoreo y reporte, y recursos educativos; Anthropic puede proveer un *system prompt* de seguridad infantil. Cumplir la ley de protección de menores y datos aplicable. | Ya está en el SPEC (reglas 5 y 6, Fase 4). No pide permiso parental explícito ni un trámite previo. La revisión legal (Ley 8968) sigue pendiente. |
| **OpenAI** | Verificado en su guía para menores de 18: no procesar datos personales de **menores de 13** sin **retención cero de datos** en la API; salvaguardas similares a Anthropic; usar sus modelos insignia más recientes. **Sin verificar en el texto original** (la página bloquea descargas automáticas; lo vi en resúmenes de búsqueda): usuarios de 13 años o más y **permiso del padre, madre o encargado** para menores de 18. | Hay que agregar un **consentimiento parental** al unirse a una sección (hoy el consentimiento lo da el estudiante) y **solicitar retención cero** a OpenAI, porque muchos estudiantes de 7.º tienen 12 años. |
| **Google (Gemini API)** | "You must be 18 years of age or older to use the APIs. You also will not use the Services as part of a website, application, or other service … that is directed towards or is likely to be accessed by individuals under the age of 18." | **No se puede usar.** No verifiqué si los términos de Vertex AI (Google Cloud) son distintos; antes de considerarlo haría falta revisión legal. |
| Modelos abiertos (Llama, Qwen, gpt-oss…) alojados por terceros | No verificado: cada empresa que los aloja tiene sus propios términos, y la calidad en español y el comportamiento seguro con menores dependen del modelo. | Fuera del MVP. No los recomiendo sin evals y revisión de términos. |

## 4. Recomendación

**Para el MVP y la demo:**

| Uso | Modelo | Por qué |
|---|---|---|
| Tutor (`MODEL_TUTOR`) | **Claude Haiku 4.5** | 5 veces más barato que Opus 5.5; mismo proveedor, mismas reglas con menores y mismo código. No razona por defecto, así que no hay tokens de razonamiento que pagar. |
| Generación de contenido (`MODEL_BULK`) | Claude Sonnet 5.5 | Gasto único; la calidad del material importa y se revisa a mano. |
| Verificación de ítems (`MODEL_VERIFY`) | Claude Opus 5.5 | Gasto único (≈ US$65, o la mitad con lotes); un ítem con la respuesta equivocada hace más daño que lo que cuesta verificarlo bien. |

**Antes de lanzar a escala (Fase 4):** correr las evals del tutor (30 casos por materia) con Haiku 4.5, Sonnet 5.5 sin razonamiento y `gpt-6-luna`. Si Haiku 4.5 no pasa (por ejemplo, regala respuestas o falla en matemáticas), subir a Sonnet 5.5 sin razonamiento. OpenAI solo si el costo es decisivo y se resuelven el permiso parental y la retención cero.

**Palancas que aplican con cualquier modelo:**
- Activar el caché de prompts (≈ 50 % menos; está en el plan de la Fase 4).
- Ajustar los límites del tutor: 60 mensajes diarios es mucho para un estudiante; 20–30 recorta el techo en la misma proporción.
- Fijar un límite de gasto mensual en la consola del proveedor.

## 5. Lo que este estudio no sabe todavía

- **Calidad:** ningún número de este documento mide si el modelo enseña bien en español ni si cumple las reglas de seguridad. Eso lo deciden las evals de la Fase 4.
- **Tokens y razonamiento:** los modelos de OpenAI y Google cuentan tokens con su propio tokenizador y razonan en cantidades que no conozco; usé los mismos supuestos que para Claude.
- **Caché en Gemini:** el caché explícito cobra almacenamiento por hora, que no incluí (irrelevante porque Gemini queda descartado).
- **Precios futuros:** Gemini 3.8 Flash duplica su precio el 1 de enero de 2027; los demás pueden cambiar.

## Fuentes (consultadas el 1 de octubre de 2026)

- Precios de Claude: <https://www.claude.com/pricing>
- Precios de OpenAI: <https://developers.openai.com/api/docs/pricing>
- Precios de Gemini: <https://ai.google.dev/gemini-api/docs/pricing>
- Anthropic, guía para organizaciones que atienden menores: <https://support.claude.com/en/articles/9307344-responsible-use-of-anthropic-s-models-guidelines-for-organizations-serving-minors>
- Anthropic, seguridad infantil para desarrolladores: <https://support.claude.com/en/articles/15591275-child-safety-guidance-for-developers>
- OpenAI, guía para menores de 18: <https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance>
- OpenAI, términos de uso: <https://openai.com/policies/row-terms-of-use/>
- Términos adicionales de la Gemini API: <https://ai.google.dev/gemini-api/terms>
