# Costos de IA de Edukemonos (estimación)

> **Fecha:** 1 de octubre de 2026 · **Estado:** estimación con **supuestos**, todavía sin datos reales de uso.
> Montos en dólares estadounidenses (USD), con punto decimal. Los colones usan un tipo de cambio **supuesto** de ₡500/USD (verificar el del BCCR).
> Cálculo reproducible: `node scripts/cost/estimate.ts` (desde la raíz del repo; ver [cómo volver a correrlo](#cómo-volver-a-correr-el-cálculo)).

## 1. Resumen

1. **Escenario recomendado** (tutor y verificación con Claude Opus 5.5, generación con Claude Sonnet 5.5) y **uso típico supuesto** (8 días al mes, unos 80 mensajes al tutor): **≈ US$2.25 por estudiante activo al mes**, **≈ US$22.50 por año lectivo** (≈ ₡1,100/mes, ≈ ₡11,000/año).
2. Eso supone activar el **caché de prompts**, que el código todavía no usa. Sin caché, el mismo uso cuesta **el doble**: ≈ US$4.44/mes, ≈ US$44/año.
3. **Techo por estudiante** (60 mensajes cada día lectivo, el máximo que permiten los límites configurados): ≈ **US$34/mes, US$339/año**; hasta ≈ US$56/mes si el modelo razona más de lo supuesto.
4. Una **sección de 35** (70% activos, uso típico) cuesta ≈ **US$55/mes (US$554/año)**; **1,000 estudiantes ≈ US$15,800/año**, **10,000 ≈ US$158,000/año**.
5. Generar **una sola vez** el contenido de Español y Matemáticas 7.º–9.º cuesta ≈ **US$150** (≈ US$107 con la Batch API). El tutor es más del 90% del gasto recurrente. **Todas las cifras de uso son supuestos**: se reemplazan con datos reales en la Fase 4.

**Palabras clave para leer este documento**

- **Token:** pedacito de texto con el que se cobra (en español, unos 3 a 4 caracteres). Se paga por tokens que **entran** (lo que le mandamos al modelo) y tokens que **salen** (lo que escribe).
- **Thinking (razonamiento):** texto interno que el modelo escribe antes de responder. No lo ve el estudiante, pero **se cobra como salida**. En Opus 5.5 no se puede apagar; se controla con el "esfuerzo" (`effort`).
- **Caché de prompts:** si mandamos el mismo inicio de conversación (instrucciones + contenido de la unidad) varias veces en menos de 5 minutos, Anthropic lo cobra a una fracción del precio.

## 2. Precios usados

**Fuente:** precios de lista de Anthropic tomados de la tabla de modelos de la *skill* `claude-api`, guardada el **25 de septiembre de 2026**. **Verifíquelos en <https://claude.com/pricing> antes de decidir.** USD por millón de tokens.

| Modelo | Entrada | Salida (incluye thinking) | Lectura de caché | Escritura de caché (5 min) | Escritura de caché (1 h) | Batch API | Mínimo para cachear |
|---|---:|---:|---:|---:|---:|---:|---:|
| Claude Opus 5.5 (`claude-opus-5-5`) | $4.00 | $20.00 | $0.20 (0.05× entrada) | $5.00 (1.25×) | $8.00 (2×) | 50% menos | 512 tokens |
| Claude Sonnet 5.5 (`claude-sonnet-5-5`) | $2.00 | $10.00 | $0.20 | $2.50 | $4.00 | 50% menos | 512 tokens |
| Claude Haiku 4.5 (`claude-haiku-4-5`) | $1.00 | $5.00 | ~$0.10 (~0.1×) | $1.25 | $2.00 | 50% menos | 4,096 tokens |

Hechos de comportamiento que afectan el costo (misma fuente):

- **Opus 5.5:** el thinking **no se puede desactivar**; el esfuerzo por defecto es `medium`. Bajar el esfuerzo (`low`) es la forma de pensar menos.
- **Sonnet 5.5:** thinking adaptativo con esfuerzo por defecto `high`; se puede apagar con `thinking: {type: "between_tools"}` (esfuerzo `high` o menor).
- **Haiku 4.5:** no razona salvo que se active. Solo cachea prefijos de **4,096 tokens o más**.
- El **tokenizador** de Opus 5.5 y Sonnet 5.5 cuenta entre **1.0 y 1.35 veces** más tokens que los modelos anteriores (como Haiku 4.5) para el mismo texto.
- **Batch API:** 50% menos en todo (también caché), con respuesta en hasta 24 h. Sirve para la generación fuera de línea, no para el tutor.

## 3. Supuestos

**Nada de esta tabla es un dato medido** (salvo donde dice "medido" o "del código"). Cada valor es un parámetro con nombre en `PARAMS` dentro de `scripts/cost/estimate.ts`.

### 3.1 Generales y del tutor

| Supuesto | Valor | Justificación |
|---|---|---|
| Caracteres por token (español) | 3.5 | Heurística común para español; no hay clave de API para contar con `count_tokens`. |
| Factor del tokenizador nuevo (Opus 5.5 / Sonnet 5.5) | 1.15 (rango 1.0–1.35) | La documentación da 1.0–1.35× frente a tokenizadores anteriores; se toma un punto medio-bajo. Haiku 4.5 = 1.0. |
| Año lectivo | 200 días lectivos ≈ 10 meses de 20 días | Calendario aproximado del MEP. No se cuenta uso en vacaciones. |
| Prompt de sistema del tutor | 6,000 caracteres (≈ 1,970 tokens) | Método socrático, escalera de pistas, seguridad, registro (SPEC §10). Aún no está escrito. |
| Definición de la herramienta de cálculo | 150 tokens | Esquema pequeño (una expresión). |
| Contexto de la unidad | 15,000 caracteres (≈ 4,900 tokens) | Resultados de aprendizaje + resumen + explicación + ejemplos + glosario publicados (SPEC §8, §10). |
| Dominio del estudiante por habilidad | 600 caracteres | Lista corta de habilidades con valor 0–1; nunca el nombre. |
| Mensaje del estudiante | 200 caracteres (≈ 66 tokens) | Estudiantes de 12–15 años escriben mensajes cortos desde el celular. |
| Respuesta visible del tutor | 700 caracteres (≈ 230 tokens) | "Respuestas cortas, un paso a la vez" (SPEC §10). |
| **Thinking por turno del tutor** | **bajo 150 / típico 400 / alto 1,200 tokens** | Desconocido hasta medir. Con Opus 5.5 en `medium` y respuestas cortas se espera poco, pero varía mucho. |
| Turnos con ronda de calculadora | 15% | Sobre todo Matemáticas; cada ronda es una petición extra. |
| Tokens de la llamada / resultado de la calculadora | 60 / 30 | Expresión y número cortos. |
| Thinking extra tras la calculadora | 30% del thinking del turno | Supuesto. |
| Historial que se reenvía | Solo el texto visible | **Del código:** el adaptador manda los turnos anteriores como texto, sin bloques de thinking. |
| **Pausas de más de 5 minutos entre mensajes** (el caché expira) | **15% de los turnos** | Supuesto. Un estudiante que se va a resolver en el cuaderno puede tardar más. |
| Prefijo ya en caché por otro estudiante de la misma unidad | 0% | Conservador. Con muchos estudiantes en la misma unidad sube (ver palancas). |
| Caché del tutor | Escenario "con caché" = punto de caché al final de sistema + unidad, más caché automático del historial | **Del código:** hoy el adaptador **no** usa caché; la columna "sin caché" es el estado actual. |
| Tipo de cambio | ₡500 por USD | Solo para mostrar colones; verificar BCCR. |

### 3.2 Perfiles de uso por estudiante activo

| Perfil | Días activos/mes | Sesiones por día | Mensajes por sesión | Mensajes/mes | Práctica extra/mes | Retroalimentación de escritura/mes | Resúmenes docentes/mes (por sección) | % de la sección activo |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Ligero | 4 | 1 | 6 | 24 | 1 | 0 | 2 | 50% |
| Típico | 8 | 1 | 10 | 80 | 2 | 2 | 4 (semanal) | 70% |
| Intenso | 16 | 1.5 | 15 | 360 | 6 | 4 | 8 | 85% |
| Tope | 20 (todos) | 2 | 30 | 1,200 | 20 | 20 | 20 | 100% |

- El perfil **Tope** usa los límites configurados (`TUTOR_MAX_MESSAGES_PER_SESSION=30`, `TUTOR_MAX_MESSAGES_PER_DAY=60`) todos los días lectivos. Práctica extra, escritura y resumen docente **no tienen límite configurado todavía**; para el tope se supone 1 por día lectivo.
- Ligero, Típico e Intenso son supuestos sin respaldo de datos. El SPEC no dice cuánto usarán el tutor los estudiantes.

### 3.3 Otras llamadas recurrentes

| Llamada | Modelo | Supuesto |
|---|---|---|
| Retroalimentación de escritura (Español) | `MODEL_TUTOR` | Entrada: instrucciones 4,000 + rúbrica 2,500 + texto del estudiante 1,500 caracteres (≈ 250 palabras). Salida: 1,500 caracteres + 120 tokens de conteos + thinking 300 / 800 / 2,000. Sin caché (llamada ocasional). |
| Práctica extra a pedido | `MODEL_BULK` | Instrucciones 8,000 caracteres + contexto de la unidad + 800 de habilidad. Salida: 5 ítems × 400 tokens + thinking 800 / 2,000 / 5,000. Sin verificación (el SPEC la marca "no revisada"; activable con `verifyEachItem`). |
| Resumen para el docente | `MODEL_TUTOR` (el SPEC no fija el modelo) | Instrucciones 5,000 caracteres + 3,000 tokens de métricas agregadas. Salida: 2,500 caracteres + thinking 400 / 1,000 / 3,000. Una vez por semana por sección (típico). |
| Tamaño de sección | | 35 estudiantes. |

### 3.4 Generación única de contenido (Español + Matemáticas, 7.º–9.º)

| Supuesto | Valor | Justificación |
|---|---|---|
| Páginas de programa | Matemáticas III Ciclo 110 págs. × 3,400 caracteres; Español 7–9 92 págs. × 1,950 caracteres | **Medido** con `pdftotext`. |
| Páginas por llamada de estructuración | 8 | Supuesto. |
| Instrucciones + esquema por llamada | 8,000 caracteres + 1,500 tokens | "Extraer, no inventar", página y extracto (SPEC §7). |
| Salida de estructuración | 30% de los tokens de las páginas + thinking 1,000 / 3,000 / 8,000 por llamada | El JSON incluye extractos textuales. |
| Repeticiones de estructuración | 1.5× | Ajustes del prompt y reintentos. |
| Unidades | 6 por grado y materia → **36 unidades** | Supuesto; depende de cómo quede la estructuración. |
| Material por unidad | Entrada 7,500 tokens; salida 5,000 + thinking 1,000 / 3,000 / 8,000; 1.5× por regeneraciones tras revisión | Resumen, explicación, ejemplos, glosario (SPEC §8). |
| Ítems por unidad | 40 verificados; 20% descartados → 50 generados (1,800 en total) | Supuesto. |
| Generación de ítems | 10 ítems por llamada; entrada 9,500 tokens; 400 tokens por ítem + thinking 1,000 / 3,000 / 8,000 por llamada | Enunciado, 4 opciones y explicación de cada distractor. |
| Verificación independiente (`MODEL_VERIFY`) | Por ítem: entrada 2,100 tokens; salida 400 + thinking 400 / 1,000 / 3,000 | Resuelve el ítem por su cuenta (SPEC §8). |
| Evals del tutor | 30 casos × 2 materias × 4 turnos × 10 corridas, más un juez con `MODEL_VERIFY` (3,000 entrada, 300 salida) | SPEC §14 pide 30 casos por materia; las 10 corridas son un supuesto. |

## 4. Resultados

Las tablas salen tal cual de `scripts/cost/estimate.ts` con el thinking **típico**.

Mezclas de modelos (generación siempre con Sonnet 5.5 y verificación siempre con Opus 5.5; solo cambia el tutor):

- **A (recomendado):** tutor Opus 5.5.
- **B:** tutor Sonnet 5.5 con thinking adaptativo.
- **B sin thinking:** tutor Sonnet 5.5 con `between_tools`. Es una variante extra de B, solo informativa.
- **C:** tutor Haiku 4.5.

### 4.1 Por estudiante activo

| Mezcla · uso | Mensajes/mes | Mes con caché | Mes sin caché | Año con caché | Año sin caché |
|---|---:|---:|---:|---:|---:|
| **A · Ligero** | 24 | $0.71 | $1.27 | $7.07 | $12.67 |
| **A · Típico** | 80 | **$2.25** | $4.44 | **$22.52** | $44.44 |
| **A · Intenso** | 360 | $9.68 | $20.86 | $96.82 | $209 |
| **A · Tope** | 1,200 | **$33.92** | $82.04 | **$339** | $820 |
| B · Ligero | 24 | $0.40 | $0.66 | $3.98 | $6.61 |
| B · Típico | 80 | $1.24 | $2.28 | $12.44 | $22.78 |
| B · Intenso | 360 | $5.32 | $10.60 | $53.22 | $106 |
| B · Tope | 1,200 | $18.85 | $41.58 | $189 | $416 |
| B sin thinking · Típico | 80 | $0.88 | $1.92 | $8.82 | $19.18 |
| B sin thinking · Tope | 1,200 | $13.50 | $36.26 | $135 | $363 |
| C · Ligero | 24 | $0.16 | $0.28 | $1.60 | $2.75 |
| C · Típico | 80 | $0.45 | $0.90 | $4.48 | $8.99 |
| C · Intenso | 360 | $1.82 | $4.12 | $18.17 | $41.21 |
| C · Tope | 1,200 | $6.52 | $16.43 | $65.16 | $164 |

En A · Típico, el mes se reparte así: tutor $2.06, práctica extra $0.11 y retroalimentación de escritura $0.08. Cada mensaje al tutor cuesta ≈ 3 centavos.

**Sensibilidad al thinking** (A, con caché, por estudiante activo al mes):

| Uso | Bajo (150/turno) | Típico (400/turno) | Alto (1,200/turno) |
|---|---:|---:|---:|
| Típico | $1.77 | $2.25 | $3.75 |
| Tope | $26.98 | $33.92 | $55.78 |

### 4.2 Por sección de 35 estudiantes (con caché)

| Mezcla · uso | % activo | Estudiantes/mes | Resumen docente/mes | Sección/mes | Sección/año |
|---|---:|---:|---:|---:|---:|
| A · Ligero | 50% | $12.37 | $0.11 | $12.48 | $125 |
| **A · Típico** | 70% | $55.17 | $0.22 | **$55.39** | **$554** |
| A · Intenso | 85% | $288 | $0.44 | $288 | $2,885 |
| **A · Tope** | 100% | $1,187 | $1.10 | **$1,188** | **$11,881** |
| B · Típico | 70% | $30.48 | $0.11 | $30.59 | $306 |
| C · Típico | 70% | $10.97 | $0.03 | $11.00 | $110 |

Un "Resumen para el docente" cuesta ≈ 5.5 centavos con Opus 5.5. Es insignificante frente al uso de los estudiantes.

### 4.3 A escala (estudiantes registrados, con caché)

Solo genera costo la fracción activa de cada perfil (50%, 70%, 85% o 100%).

| Mezcla · uso | 1,000 / mes | 1,000 / año | 10,000 / mes | 10,000 / año |
|---|---:|---:|---:|---:|
| A · Ligero | $357 | $3,566 | $3,566 | $35,659 |
| **A · Típico** | **$1,583** | **$15,826** | **$15,826** | **$158,261** |
| A · Intenso | $8,242 | $82,423 | $82,423 | $824,229 |
| A · Tope | $33,946 | $339,465 | $339,465 | $3,394,649 |
| B · Típico | $874 | $8,739 | $8,739 | $87,391 |
| C · Típico | $314 | $3,142 | $3,142 | $31,422 |

El perfil **Tope** para todos los estudiantes no es un pronóstico. Es la **exposición máxima** que permiten los límites actuales, y sirve para dimensionar topes de gasto. Ojo: los límites son **por dispositivo** (SPEC §15) y el acceso es anónimo, así que una misma persona con varios dispositivos puede superarlos.

### 4.4 Generación única de contenido (escenario A)

| Tarea | Modelo | Estándar | Con Batch API |
|---|---|---:|---:|
| Estructuración curricular (programas → unidades) | Sonnet 5.5 | $2.86 | $1.43 |
| Material de estudio (36 unidades) | Sonnet 5.5 | $5.13 | $2.56 |
| Banco de ítems (1,800 generados → 1,440 verificados) | Sonnet 5.5 | $16.02 | $8.01 |
| Verificación independiente de cada ítem | Opus 5.5 | $65.52 | $32.76 |
| Evals del tutor (60 casos × 10 corridas, con juez) | Opus 5.5 | $62.44 | n/a (interactivo) |
| **Total** | | **≈ $152** | **≈ $107** |

Con thinking bajo el total baja a ≈ $107 y con thinking alto sube a ≈ $294. Agregar más materias o más ítems escala de forma casi lineal. La verificación con Opus es la parte más cara de la generación.

## 5. Palancas que bajan el costo

Efecto estimado sobre **A · Típico** (US$2.25 por estudiante activo al mes) salvo donde dice "Tope".

| Palanca | Antes | Después | Cambio | Comentario |
|---|---:|---:|---:|---|
| **Activar el caché de prompts** (hoy no está) | $4.44 | $2.25 | **−49%** | La palanca más grande y no cambia la calidad. Requiere poner instrucciones y contenido de la unidad **idénticos y al inicio**, y los datos del estudiante después. |
| Muchos estudiantes en la misma unidad (prefijo ya en caché el 80% de las veces) | $2.25 | $1.74 | −23% | Aparece sola a escala si el prefijo es idéntico byte a byte. |
| Caché de 1 hora en vez de 5 minutos | $2.25 | $2.16 | −4% | Poco efecto con estos supuestos; cuesta 2× escribir. |
| (Riesgo) Más pausas largas entre mensajes (40% en vez de 15%) | $2.25 | $2.99 | +33% | Cuánto tardan en responder los estudiantes es un supuesto clave. |
| **Esfuerzo `low`** (menos thinking) | $2.25 | $1.77 | −21% | Hay que validar la calidad pedagógica con las evals. |
| (Riesgo) Thinking alto | $2.25 | $3.75 | +66% | La incertidumbre más grande por turno. |
| Enviar solo la parte relevante de la unidad (contexto a la mitad) | $2.25 | $1.97 | −12% | Podría empeorar el anclaje; medir. |
| Respuestas visibles 30% más cortas | $2.25 | $2.10 | −7% | Ya es parte del diseño socrático. |
| **Límites del tutor** 20 por sesión y 40 por día (en vez de 30 y 60) | $33.92 (Tope) | $22.50 | −34% | Baja el techo; no cambia el uso típico. |
| Mismos 60 por día pero sesiones de 15 mensajes | $33.92 (Tope) | $32.53 | −4% | Las conversaciones cortas reenvían menos historial. |
| **Modelo del tutor:** Sonnet 5.5 (B) | $2.25 | $1.24 | −45% | Ver nota abajo. |
| Modelo del tutor: Sonnet 5.5 sin thinking | $2.25 | $0.88 | −61% | Ver nota abajo. |
| Modelo del tutor: Haiku 4.5 (C) | $2.25 | $0.45 | −80% | Ver nota abajo. |
| **Batch API** para la generación fuera de línea | $89.53 | $44.76 | −50% | Solo para la generación única (sin evals); tarda hasta 24 h. |

**Sobre el modelo del tutor:** esta estimación **no recomienda bajar de modelo para ahorrar**. Calidad contra costo es **decisión del fundador**, y se debe validar con las evals del tutor de la Fase 4 (30 casos por materia que verifican que no regale respuestas, no se salga del currículo, no pida datos personales y responda bien ante malestar). Lo que sí es independiente de la calidad: **caché, límites y Batch API**.

**Respaldo contra sorpresas:** además de los límites por dispositivo, conviene un **tope de gasto mensual** en la consola de Anthropic (límite del *workspace*) y un presupuesto por sección en `consume_quota`.

## 6. Qué medir en la Fase 4 para cambiar supuestos por datos

La tabla `ai_usage` ya guarda tokens de entrada y salida por llamada, con su propósito, actor y sección. Para que alcance hay que hacer dos ajustes (fuera del alcance de este documento):

1. **Separar los tokens de caché.** Hoy `usageOf` en `packages/ai/src/providers/anthropic.ts` suma en `input_tokens` los tokens leídos y escritos en caché, y `estimateCostUsd` los cobra todos a precio completo. Con caché activo, el panel `/admin` **sobreestimaría** el costo y no mostraría si el caché funciona. Hay que guardar por separado `cache_read_input_tokens` y `cache_creation_input_tokens`, y agregar sus precios a `AI_PRICES_JSON`.
2. **Activar el caché en el adaptador:** un punto de caché al final del sistema y del contexto de la unidad, más el caché automático para el historial. Después hay que verificar que en el segundo turno `cache_read_input_tokens > 0`.

Qué medir y qué supuesto reemplaza:

| Medida (desde `ai_usage` y eventos) | Reemplaza el supuesto |
|---|---|
| Mensajes por sesión, sesiones por día y días activos por mes, por estudiante (distribución, no solo promedio) | Perfiles Ligero / Típico / Intenso |
| % de estudiantes de una sección que usan el tutor cada mes | % activo |
| Tokens de entrada por turno (primer turno y crecimiento por turno) | Prompt de sistema, contexto de la unidad, mensaje, historial |
| Tokens de salida por turno, menos el texto visible | **Thinking por turno** (Anthropic lo incluye en `output_tokens`) |
| Lectura de caché / entrada total del tutor | Tasa de aciertos de caché, pausas de más de 5 minutos, prefijo compartido |
| Tiempo entre mensajes (marca de tiempo de cada turno) | Pausas de más de 5 minutos (15%) |
| Llamadas a la calculadora por turno | Turnos con calculadora (15%) |
| Llamadas y tokens de práctica extra, escritura y resumen docente | Frecuencias de las llamadas ocasionales |
| Ítems descartados por la verificación y regeneraciones de material | 20% descartados, 1.5× regeneraciones |
| Conteo exacto con `count_tokens` del prompt real y de una unidad publicada | 3.5 caracteres por token y factor del tokenizador |
| Barrido de esfuerzo (`low` / `medium`) con las evals: calidad contra costo por conversación | Elección de esfuerzo y modelo |

Con un par de semanas de datos piloto, se cambian los valores en `PARAMS` y se vuelve a correr el script. Conviene también contrastar el total con la **API de uso y costos** de Anthropic, que es la fuente de la factura real.

## Cómo volver a correr el cálculo

Desde la raíz del repositorio:

```bash
node scripts/cost/estimate.ts                 # Node 22.18 o superior (el repo usa 22.x/24.x)
# alternativas:
npx tsx scripts/cost/estimate.ts              # necesita descargar tsx de npm
pnpm --filter @edukemonos/ingest exec tsx ../../scripts/cost/estimate.ts
```

Todos los supuestos están arriba del archivo, en el objeto `PARAMS`. Cambie un valor y vuelva a correrlo. La salida son tablas en Markdown: precios, tamaño de un turno, costo por estudiante, desglose, sensibilidad al thinking, sección, escala, generación única, palancas y cifras clave.
