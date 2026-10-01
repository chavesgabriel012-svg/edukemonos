# PLAN — Edukemonos (MVP #AIForImpact)

> Fuente de verdad del alcance: [`docs/SPEC.md`](docs/SPEC.md). Este plan dice **cómo** y **en qué orden**.
> Las fechas son simbólicas (orden y peso relativo, no compromisos de calendario).
> Inventario real de fuentes: [`docs/sources-inventory.md`](docs/sources-inventory.md).

## 0. Lo que encontré en las fuentes y choca con el SPEC

Revisé las 7 URLs del Anexo A, las páginas de programas del MEP y descargué los 6 programas, las 6 tablas de especificaciones y las 18 prácticas de III Ciclo. Detalle en `docs/sources-inventory.md`. Puntos que cambian supuestos del SPEC:

| # | Supuesto del SPEC | Realidad encontrada | Ajuste que propongo |
|---|---|---|---|
| 1 | Un documento por grado/materia | El MEP publica **un PDF por materia que abarca III Ciclo + Diversificada** (Matemáticas: un solo PDF de 518 págs. de 1.º a 11.º). Dentro, cada materia se organiza distinto: Matemáticas por *área → año*; Español, Ciencias e Inglés por *año*; Estudios Sociales por *nivel → temas*; Cívica por *nivel → unidad*. | La extracción trabaja por **rango de páginas por grado** declarado en un manifiesto (`scripts/ingest/sources.json`), no por documento completo. |
| 2 | Trimestre no garantizado | Confirmado. Solo **Educación Cívica** asigna cada unidad a un trimestre ("Tiempo probable: Primer trimestre"). Las demás materias no. | `trimestre` queda opcional (como dice el SPEC). En Cívica se **precarga como sugerencia** con el extracto que lo respalda; el revisor lo confirma. |
| 3 | Materia "Formación Ciudadana" | Ese nombre lo usa **Educación Abierta (DGEC)**. En la educación formal la materia es **Educación Cívica** (programa de feb. 2009, reimpresión 2014). Las tablas de "Formación Ciudadana" siguen los mismos temas del programa de Cívica (p. ej. "Construyamos comunidades seguras"). | Identificador interno `civica`; nombre visible **pendiente de tu decisión** (pregunta 2). |
| 4 | Programas vigentes y uniformes | Versiones: Matemáticas 2012 (así lo cita la tabla DGEC), Español 2017, Ciencias 2017, Estudios Sociales 2016, Inglés 2016, Cívica 2009. No encontré versiones más recientes en `mep.go.cr`. | Cada fuente guarda versión/año; la UI cita "Programa de Estudio de X (MEP, año)". |
| 5 | Fuente prioritaria: programas | Las **tablas DGEC** están por grado, con habilidades numeradas copiadas del programa (p. ej. Mat 7.º "1.1 Calcular expresiones numéricas aplicando el concepto de potencia…") y cantidad de ítems. Son mucho más limpias que los programas. | Respeto el orden del SPEC: las **unidades se extraen del programa** (con página y extracto). La tabla DGEC se usa como **control de cobertura** automático (cada habilidad de la tabla debe mapear a una habilidad extraída) y para ponderar el diagnóstico. |
| 6 | Extracto textual fiel | En Matemáticas la extracción de texto **pierde exponentes y algunos operadores** (`(5 + 7)2` en vez de `(5 + 7)²`; `×` desaparece). | Los extractos de Matemáticas se marcan "texto extraído automáticamente; ver PDF pág. N" y el revisor puede corregirlos. Nunca se usan como enunciado de ítems. |
| 7 | Prácticas reutilizables para calibrar | Las prácticas de **Inglés** son casi solo imagen (~480 caracteres/pág.). | Para Inglés, calibración manual o OCR más adelante (Inglés es prioridad 5). |
| 8 | Contenido en español | El programa de Inglés está en inglés. | Material de Inglés en inglés con instrucciones en español. |

El archivo venía como `docs/SPEC.md.md`; lo renombré a `docs/SPEC.md`, que es como lo cita el propio documento.

## 1. Decisiones técnicas tomadas (dentro de lo que el SPEC deja abierto)

- **Monorepo pnpm**: `apps/web`, `packages/ai`, `packages/curriculum`, `scripts/ingest`, `supabase/migrations`.
- **Capa de IA**: interfaz propia (`generateText`, `generateStructured`, `streamChat`, `embed`) con adaptadores Anthropic y OpenAI por `AI_PROVIDER`. Modelos solo por variables de entorno (`MODEL_BULK`, `MODEL_TUTOR`, `MODEL_VERIFY`); nada fijo en el código.
- **Pruebas de RLS sin depender de la nube**: Postgres 16 local + *shim* mínimo del esquema `auth` de Supabase (`auth.uid()`, roles `anon`/`authenticated`/`service_role`). Las mismas migraciones corren luego en Supabase real.
- **Límites de tasa** con contadores en Postgres (función `consume_quota`), no en memoria.
- **PDFs oficiales en bucket privado**; al público solo se muestran extractos cortos + enlace a la URL oficial del MEP (hasta que confirmes condiciones de reutilización).
- **Inventario reproducible**: manifiesto `scripts/ingest/sources.json` + script que lo verifica.

## 2. Fases

| Fase | Fechas (simbólicas) | Entregable | Hitos internos |
|---|---|---|---|
| **0. Cimientos** | 30 sep – 2 oct | Repo, esquema + RLS probada, capa de IA, app vacía desplegable, inventario de fuentes | 0.1 inventario + manifiesto · 0.2 monorepo + Next.js + Tailwind/shadcn + pie legal · 0.3 migraciones (esquema completo §6) · 0.4 RLS + pruebas que intentan romperla · 0.5 `packages/ai` con adaptadores y registro de uso · 0.6 CI + `.env.example` + README · 0.7 despliegue en Vercel (**requiere credenciales**) |
| **1. Currículo** | 3 – 5 oct | Pipeline de ingesta y `/revisar`. **Matemáticas 7.º de punta a punta** | 1.1 descarga idempotente a Storage (hash/fecha) · 1.2 extracción por página · 1.3 estructuración con `generateStructured` (extraer, no inventar; página + extracto) · 1.4 control de cobertura vs tabla DGEC · 1.5 `/revisar` (lado a lado, editar, aprobar/rechazar, auditoría) |
| **2. Contenido** | 6 – 8 oct | Material + banco de ítems con verificación. Español y Matemáticas 7.º–9.º | 2.1 generadores (resumen, explicación, ejemplos, glosario) · 2.2 ítems 4 opciones + explicación de distractores · 2.3 verificación con `MODEL_VERIFY` + `mathjs` · 2.4 Español: inferencial/crítica + escritura abierta · 2.5 revisión humana en `/revisar` |
| **3. Estudiante** | 8 – 10 oct | Estudio, práctica con retroalimentación, diagnóstico y dominio | 3.1 sesión anónima · 3.2 grado → materia → unidades · 3.3 pestañas Aprender/Practicar · 3.4 diagnóstico adaptativo + `docs/diagnostic.md` + pruebas · 3.5 ruta sugerida · 3.6 unirse a sección (nombre + código + consentimiento) |
| **4. Tutor** | 10 – 12 oct | Chat socrático anclado | 4.1 prompt de sistema versionado · 4.2 contexto de unidad + dominio (sin nombre) · 4.3 herramienta de cálculo · 4.4 filtro de datos personales, moderación, límites · 4.5 escritura: categorías de error → conteos · 4.6 evals (30 casos × materia publicada) |
| **5. Docente** | 12 – 14 oct | Panel docente | 5.1 secciones + código regenerable · 5.2 resumen, mapa de calor, detalle por estudiante · 5.3 resumen con IA desde agregados + "Cómo se calculó" · 5.4 CSV · 5.5 modo demostración con datos sintéticos etiquetados · 5.6 auditoría de accesos |
| **6. Cierre** | 14 – 16 oct | Resto de materias, privacidad, pulido | 6.1 materias en orden Ciencias → Estudios Sociales → Inglés → Cívica · 6.2 aviso de privacidad · 6.3 E2E Playwright · 6.4 PWA · 6.5 *stretch* coordinador |

Regla de recorte: mejor **Español + Matemáticas completas y revisadas** que 6 materias a medias; el resto figura como "próximamente".

## 3. Riesgos principales

| Riesgo | Impacto | Mitigación |
|---|---|---|
| **Sin credenciales** (Supabase, Vercel, IA) | No hay despliegue ni estructuración/generación real | Todo lo demás avanza en local (Postgres + mocks de IA). El despliegue es el último hito de la Fase 0. |
| **Capacidad de revisión humana** | El criterio de aceptación exige contenido *revisado*; el tutor solo usa unidades `published` | Pedir revisores ya (pregunta 3). `/revisar` rápido (atajos, edición en línea, lote). Priorizar unidades de Mat/Esp 7.º. |
| **Calidad de extracción de PDF** (columnas intercaladas, exponentes perdidos) | Unidades mal estructuradas | Extracción por rango de páginas, extracto obligatorio, control de cobertura contra tabla DGEC, revisión humana. |
| **Ítems con respuesta incorrecta** | Daño pedagógico y de credibilidad | Verificación independiente con `MODEL_VERIFY`; `mathjs` para cálculo; no verificado ⇒ no entra al diagnóstico. |
| **Datos de menores / Ley 8968** | Legal y reputacional | Mínimos datos, nombre nunca al modelo, consentimiento al unirse, retención configurable, revisión legal tuya antes del lanzamiento. |
| **Seguridad del tutor** | Menores en situación de riesgo | Prompt + filtro + evals de malestar; `config/help-resources.json` lo completas tú con números verificados (solo 911 por defecto). |
| **Costos de IA y abuso del acceso anónimo** | Factura y caída del servicio | Cuotas por dispositivo y sección en Postgres, topes de tokens, generación masiva fuera de línea y cacheada, panel `/admin` de costos. |
| **Condiciones de reutilización del contenido MEP** | Riesgo de derechos | PDFs en bucket privado, extractos cortos con cita y enlace; no reproducir prácticas oficiales. |
| **Alcance vs. tiempo** | Demo incompleta | Recorte por prioridad de materias; E2E solo de flujos clave. |

## 4. Preguntas bloqueantes

Ninguna bloquea la Fase 0 (excepto su último hito, el despliegue), así que **empiezo la Fase 0 ya**.

1. **Credenciales** (bloquea el despliegue y la Fase 1): proyecto Supabase (URL, `anon key`, `service_role key`), cuenta/equipo de Vercel y clave de IA. ¿Qué proveedor quieres por defecto, Anthropic u OpenAI? En esta sesión hay un conector de Vercel disponible: ¿me autorizas a crear el proyecto con él, o prefieres crearlo tú y pasarme el ID?
2. **Nombre de la materia**: en la educación formal es "Educación Cívica"; "Formación Ciudadana" es el nombre de Educación Abierta. ¿Cuál mostramos? Propongo "Educación Cívica" (es el que ven los estudiantes de colegio público).
3. **Revisores** (bloquea la publicación en la Fase 2): ¿quiénes revisan Español y Matemáticas, con qué correo y cuántas horas tienen entre el 6 y el 13 de octubre? Sin revisión, nada pasa a `published` y el tutor no tiene contenido.

Pendientes tuyos que **no bloquean** (Anexo C): registro del tutor (tuteo), revisión legal, `config/help-resources.json`, condiciones de reutilización del MEP.
