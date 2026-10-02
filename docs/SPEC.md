# Prompt para Claude Code — Eduka, antes Edukemonos (MVP para #AIForImpact)

> **Cómo usar este archivo**
> 1. Crea el repo vacío y guarda este archivo como `docs/SPEC.md`.
> 2. Abre Claude Code en la raíz del repo y pega solo el bloque "Instrucción inicial".
> 3. Claude Code leerá el resto desde `docs/SPEC.md`. Si prefieres, pega el archivo completo.

---

## Instrucción inicial (pegar en Claude Code)

Eres mi ingeniero principal en **Edukemonos**, una plataforma educativa abierta con IA para estudiantes del sistema público de Costa Rica. Lee completo `docs/SPEC.md` antes de escribir código. Luego:

1. Crea `PLAN.md` con el plan por fases (usa las fases de la sección 16), los riesgos principales y, como máximo, 5 preguntas bloqueantes. Si no hay preguntas bloqueantes, empieza la Fase 0 sin esperar.
2. Trabaja en hitos pequeños con commits frecuentes. Al terminar cada fase, dame un resumen de máximo 8 líneas: qué funciona, qué falta, qué decidiste y qué necesitas de mí.
3. Si algo de este documento contradice la realidad que encuentres (por ejemplo, la estructura de los programas del MEP), dímelo y propón un ajuste en vez de improvisar en silencio.
4. Nunca inventes contenido curricular, datos ni cifras. Todo debe salir de las fuentes oficiales o estar marcado como generado por IA y pendiente de revisión.

---

## 1. Contexto y objetivo

Costa Rica atraviesa una crisis de aprendizajes. Datos verificados (ver Anexo B): en PISA 2025 solo el 30 % de los estudiantes alcanzó el nivel básico en matemáticas y el 53 % en lectura; el Estado de la Educación 2025 reporta que en secundaria apenas una cuarta parte tiene la capacidad de lectura esperada.

**Edukemonos** ofrece, de forma abierta y gratuita:
- Material de estudio por materia y grado alineado a los programas oficiales del MEP (resúmenes, explicaciones, ejemplos, prácticas).
- Una prueba diagnóstica para ubicar el nivel del estudiante.
- Un tutor de IA (chat) que enseña como un tutor, no que da respuestas.
- Un panel para docentes, coordinadores y administrativos con datos por estudiante y por sección sobre qué materias y temas cuestan más, interpretados con IA.

El producto compite en el reto #AIForImpact de NAUFest (Junior Achievement + HP). **Fecha límite: 16 de octubre de 2026.** Hoy es 30 de septiembre de 2026. Se necesita una demo pública funcional, no un prototipo de diapositivas.

## 2. Decisiones ya tomadas (no reabrir)

| Tema | Decisión |
|---|---|
| Stack | Next.js (App Router, TypeScript), Tailwind + shadcn/ui, Supabase (Postgres, Auth, RLS, Storage), despliegue en Vercel |
| Proveedor de IA | **Intercambiable**: capa de abstracción con adaptadores para Anthropic y OpenAI, elegidos por variable de entorno |
| Acceso estudiante | **Abierto**: se puede estudiar sin registro. Para unirse a una sección, el docente comparte un código y el estudiante entra con su nombre y ese código |
| Acceso docente | Cuenta propia. El docente crea secciones desde su panel y cada sección genera un código |
| Alcance del MVP | **Solo III Ciclo** (7.º, 8.º y 9.º) con las 6 materias: Español, Estudios Sociales, Matemáticas, Inglés, Ciencias y Formación Ciudadana |
| Idioma | Interfaz y contenido en español de Costa Rica. Código, identificadores y commits en inglés |
| Datos del estudiante | Mínimos: nombre (para que el docente lo reconozca), sección y trimestre. El nombre **nunca** se envía al modelo de IA |

La arquitectura debe quedar **dirigida por datos** para sumar después I y II Ciclo y Educación Diversificada sin reescribir (ciclo, grado y materia son datos, no código).

## 3. Alcance

**Dentro del MVP**
- Pipeline de ingesta del currículo oficial → mapa curricular revisable.
- Material de estudio y banco de prácticas generados con IA, con flujo de revisión humana.
- Prueba diagnóstica adaptativa por materia y cálculo de dominio por habilidad.
- Tutor de IA socrático anclado al currículo.
- Panel docente con métricas, mapa de calor, alertas y resumen interpretado con IA.
- Modo demostración con datos sintéticos claramente marcados.

**Fuera del MVP (dejar ganchos, no construir)**
- I y II Ciclo, Educación Diversificada, Bachillerato por Madurez, admisión a universidades.
- Rol de coordinador institucional con vista multi-sección (marcar como *stretch* en la Fase 6).
- App móvil nativa. Modo sin conexión completo (sí PWA instalable básica).

## 4. Reglas innegociables

1. **Honestidad de datos.** No inventar cifras, fuentes ni contenido curricular. Cada unidad del mapa curricular guarda documento fuente, página y un extracto textual.
2. **Anclaje al currículo.** El tutor y los generadores usan solo unidades con estado `published`. Si algo no está en el currículo cargado, el tutor lo dice en vez de improvisar.
3. **No es una plataforma oficial del MEP.** Mostrar en el pie de toda página: "Eduka es una iniciativa independiente. No es una plataforma oficial del Ministerio de Educación Pública." Citar al MEP como fuente del currículo.
4. **Transparencia sobre la IA.** Todo material muestra su estado: "Generado con IA · pendiente de revisión" o "Generado con IA · revisado por docente". Botón "Reportar un error" en cada material, práctica y respuesta del tutor.
5. **Datos de menores.** Recoger lo mínimo, no enviar nombres al modelo, aviso de privacidad visible y consentimiento básico al unirse a una sección, retención configurable. La política final debe revisarla alguien con formación legal (referencia: Ley 8968 de protección de datos personales).
6. **Seguridad infantil.** El tutor no pide datos personales, no da consejo médico ni legal, y ante señales de malestar serio o riesgo responde con cuidado y orienta a un adulto de confianza o al docente. Los recursos de ayuda van en un archivo de configuración que completaré yo con números verificados (el 911 sí puede ir como emergencia).
7. **Respeto a las fuentes.** Descargar documentos públicos con ritmo prudente y respetando `robots.txt`. Si algo está bloqueado, crea `docs/sources-manual.md` con las URLs para que yo las descargue a mano. Única fuente curricular: los programas de estudio oficiales publicados en `www.mep.go.cr` (las tablas y prácticas de Educación Abierta de la DGEC quedan excluidas; decisión del fundador, 1 oct 2026).

## 5. Arquitectura

```
/apps/web                 Next.js (estudiante, docente, revisión)
/packages/ai              Capa de IA intercambiable (providers, prompts, evals)
/packages/curriculum      Tipos y utilidades del mapa curricular
/scripts/ingest           Descarga, extracción y estructuración de PDFs
/supabase/migrations      Esquema, RLS, funciones
/docs                     SPEC.md, PLAN.md, privacy.md, sources-inventory.md
```

**Capa de IA** (`packages/ai`)
- Interfaz común: `generateText`, `generateStructured` (con esquema JSON y validación con zod), `streamChat` con herramientas, y `embed` (opcional).
- Adaptadores para Anthropic y OpenAI. Variables: `AI_PROVIDER`, `MODEL_BULK` (generación masiva, barato), `MODEL_TUTOR` (chat), `MODEL_VERIFY` (verificación). **Usa los identificadores de modelo vigentes según la documentación oficial al momento de construir; no los dejes escritos en el código.**
- Registro de uso (tokens, costo estimado, latencia) en la tabla `ai_usage`.
- Todos los prompts viven en archivos versionados, no incrustados en componentes.

**Recuperación de información (RAG)**
- Primero filtro estructurado por ciclo, grado, materia y unidad; después búsqueda de texto completo de Postgres (configuración `spanish`). Los embeddings (pgvector) quedan detrás de una bandera opcional. Razón: más simple, más barato y más auditable en 16 días.

**Estudiantes sin registro**
- Usar inicio de sesión anónimo de Supabase para persistir el progreso por dispositivo. Al unirse a una sección con código y nombre, ese usuario anónimo queda vinculado a la sección.

## 6. Modelo de datos (esquema inicial; ajusta con criterio)

- `profiles` (id, rol: `docente | revisor | admin`, nombre).
- `sections` (id, docente_id, nombre, grado, institución_texto, trimestre_actual, código único, activa).
- `section_members` (section_id, student_id, display_name, consentimiento_at, joined_at).
- `students` (id = usuario anónimo, grado_declarado).
- `curriculum_sources` (documento, url, hash, fecha de descarga, tipo: `programa`).
- `curriculum_units` (ciclo, grado, materia, título, trimestre nullable, resultados de aprendizaje[], contenidos[], habilidades[], source_id, página, extracto, estado: `draft | reviewed | published`).
- `skills` (id, materia, nombre, descripción, prerrequisitos[]).
- `materials` (unit_id, tipo: resumen/explicación/ejemplos/glosario, contenido, versión, estado, revisor_id, revisado_at, modelo y prompt usados).
- `items` (unit_id, skill_ids[], tipo, enunciado, opciones[4], respuesta_correcta, explicación, dificultad 1–5, verificado bool, estado, origen).
- `attempts` (student_id, item_id, respuesta, correcta, tiempo, pistas_usadas, sesión).
- `diagnostics` (student_id, materia, estado, nivel_estimado, detalle por habilidad).
- `mastery` (student_id, skill_id, puntaje 0–1, intentos, actualizado_at).
- `tutor_sessions` / `tutor_messages` (unit_id nullable, rol, contenido, banderas de seguridad).
- `writing_feedback` (student_id, categoría de error, conteo, fecha). Guardar conteos y categorías, no el texto completo salvo retención configurable.
- `reports` (tipo, objeto, comentario, estado) para "Reportar un error".
- `ai_usage`, `events` (analítica mínima).

**RLS obligatoria y probada:**
- Un estudiante solo ve lo suyo.
- Un docente solo ve secciones propias y sus miembros.
- Contenido `published` es lectura pública; escritura solo `revisor/admin`.
- Escribir pruebas automáticas que intenten romper cada política.

## 7. Pipeline curricular (el corazón del producto)

**Objetivo:** convertir los documentos oficiales en un mapa curricular estructurado y revisable.

1. **Inventario.** Abre cada enlace del Anexo A, recorre las páginas y genera `docs/sources-inventory.md` con: URL, tipo de documento, ciclo, grado, materia, tamaño y si fue descargable. Aclárame qué encontraste de verdad antes de asumir estructura.
2. **Descarga** a Storage con hash y fecha. Es idempotente.
3. **Extracción de texto** de PDF. Si un PDF es escaneado, marcarlo para OCR o revisión manual y avisarme.
4. **Estructuración con IA** (`generateStructured`): por documento y grado, extraer unidades con título, resultados de aprendizaje, contenidos y habilidades. Reglas: **extraer, no inventar**; incluir página y extracto textual; si no hay información, dejar el campo vacío.
5. **Estado `draft`.** Nada llega a estudiantes hasta que un revisor lo pasa a `published`.
6. **Trimestre.** No asumir que los documentos vienen por trimestre. Es una etiqueta opcional que un docente o revisor asigna a cada unidad.
7. **Vista de revisión** (`/revisar`): lista de unidades por materia y grado con extracto fuente al lado, edición, aprobar y rechazar, y registro de quién revisó.

Fuente única: los programas de estudio oficiales del MEP para la educación formal (actualizado el 1 oct 2026; antes incluía tablas y prácticas de Educación Abierta de la DGEC).

## 8. Material de estudio y banco de prácticas

Para cada unidad `published`, generar en lote (offline, con `MODEL_BULK`) un paquete:
- Resumen, explicación paso a paso, ejemplos resueltos, glosario.
- Banco de ítems por habilidad y dificultad. **Formato por defecto: selección única con enunciado y cuatro opciones, una sola correcta**. En Español, agregar ítems de respuesta abierta (escritura).
- Cada ítem lleva habilidad, dificultad, respuesta correcta y explicación del *por qué* de cada distractor.

**Control de calidad automático antes de publicar un ítem:**
- Pasada de verificación con `MODEL_VERIFY`: resuelve el ítem de forma independiente y compara. Si no coincide, se descarta o va a revisión.
- Matemáticas y Ciencias con cálculo: verificar con herramienta de cálculo exacto (por ejemplo `mathjs`), no con el criterio del modelo.
- Marcar `verificado = true` solo si pasa. Ítems no verificados no se muestran en el diagnóstico.

**Español, comprensión lectora:** incluir deliberadamente lectura **inferencial y crítica** (no solo localizar información). El Estado de la Educación señala que el currículo actual se concentra en localizar y extraer información; esa es una brecha que Edukemonos puede cubrir.

Los estados de revisión (`generado` / `revisado`) deben verse en la interfaz. Generar más práctica "a pedido" está permitido y se marca como no revisada.

## 9. Prueba diagnóstica y dominio

- Se ofrece **al iniciar sesión en cada materia** (opcional pero destacada), tanto para quien solo quiere estudiar como para quien necesita recuperar.
- Adaptativa y corta (8 a 12 ítems por materia): empieza en la dificultad del grado declarado; acierta → sube; falla → baja. Usa solo ítems `verificado`.
- Resultado: nivel estimado por materia y dominio por habilidad (0–1), explicado en lenguaje amable ("Vas muy bien en… Conviene reforzar…"). Evitar etiquetas negativas.
- **Ruta de estudio sugerida**: las unidades recomendadas, ordenadas por prerrequisitos y brecha.
- Algoritmo simple, documentado y con pruebas unitarias (estilo Elo o actualización bayesiana ligera; decide tú y justifícalo en `docs/diagnostic.md`).
- Gancho para el futuro: habilidades con `prerrequisitos` que apunten a grados anteriores; si no hay contenido publicado, mostrar "contenido pendiente" y no inventarlo.

## 10. Tutor de IA

**Anclaje:** en cada turno el tutor recibe el contexto de la unidad (resultados de aprendizaje, material publicado) y, si existe, el dominio estimado del estudiante por habilidad. Nunca recibe el nombre del estudiante.

**Comportamiento (especificar en el prompt de sistema versionado):**
- Habla como tutor costarricense cercano. Español neutro con tuteo e imperativos ("Lee", "Intenta"); sin voseo marcado. **Configurable; pendiente confirmar el registro con docentes.**
- Adapta vocabulario y longitud al grado. Respuestas cortas, un paso a la vez.
- **Método socrático con escalera de pistas:** primero pregunta qué entiende el estudiante, luego pista 1, pista 2, pista 3 y, solo si sigue atascado o lo pide, explicación completa. Termina con una pregunta de comprobación.
- No resuelve directamente ítems de práctica o diagnóstico en curso; guía.
- Matemáticas: muestra los pasos y usa una **herramienta de cálculo** para cualquier operación, para no equivocarse.
- Español: en comprensión lectora entrena el recorrido localizar → inferir → valorar. En escritura da retroalimentación y clasifica errores (ortografía: tildes, b/v, c/s/z, h, g/j, mayúsculas; puntuación; concordancia; cohesión) y guarda solo conteos.
- Si algo está fuera del currículo cargado o no está seguro: lo dice y sugiere preguntar al docente. No inventa citas ni fuentes.
- Fuera de tema escolar: redirige con amabilidad.
- Seguridad: ver regla 6.

**Controles técnicos:** límite de mensajes por sesión y por día, máximo de tokens, filtro de entrada para datos personales, moderación básica y respuesta en *streaming*. Cada respuesta tiene "Reportar un error".

## 11. Panel docente

**Acceso y secciones**
- Docente crea secciones (grado, nombre, trimestre actual) y obtiene un código fácil de dictar, regenerable y desactivable. Ve la lista de estudiantes unidos.

**Vistas**
- **Resumen de la sección:** participación (activos en los últimos 7 días), materias y temas con menor dominio, estudiantes que podrían necesitar apoyo (bajo dominio y baja actividad).
- **Mapa de calor** estudiantes × unidades o habilidades.
- **Detalle por estudiante:** línea de tiempo, nivel estimado por materia, intentos y errores por tipo, temas consultados al tutor (solo el tema, no el chat completo).
- **Español:** resumen de categorías de error de escritura por estudiante y por sección.
- **Exportar a CSV.**
- *Stretch:* vista de coordinador/administrativo con varias secciones.

**Interpretación con IA ("Resumen para el docente")**
- Se genera **a partir de métricas agregadas**, nunca del chat crudo, y se cachea con límite de uso.
- Redacción respetuosa y accionable ("conviene reforzar la inferencia de textos"), nunca etiquetas como "no sabe escribir".
- Cada hallazgo muestra "Cómo se calculó" con los números que lo respaldan.

## 12. Roles, privacidad y retención

- Roles: `docente`, `revisor`, `admin` (yo). Los docentes pueden aportar revisión de contenido solicitando rol de revisor.
- Aviso de privacidad en español claro, enlazado en el registro y en el pie.
- Retención configurable (`RETENTION_DAYS_CHAT`, propuesta inicial: 30 días para transcripciones; métricas agregadas durante el curso lectivo). **Decisión pendiente de revisión legal.**
- Un docente puede eliminar a un estudiante de su sección y sus datos asociados.
- Registro de auditoría de accesos del panel docente.

## 13. Experiencia de usuario

- **Mobile-first**, ligera, instalable como PWA. Pensada para conexiones débiles y celulares modestos.
- Accesibilidad WCAG AA: contraste, tamaño de texto ajustable, opción de fuente legible, navegación por teclado.
- Flujo del estudiante: elegir grado → materia → (diagnóstico opcional) → lista de unidades con su dominio → unidad con pestañas **Aprender / Practicar / Preguntar a Kemo**.
- Visual amable y escolar, sin estridencias. Nombre: **Eduka** (antes Edukemonos); identidad en [`docs/brand.md`](brand.md).

## 14. Calidad y pruebas

- Pruebas unitarias: algoritmo diagnóstico, cálculo de dominio, verificación de ítems.
- Pruebas de RLS que intenten acceder a datos ajenos.
- E2E (Playwright) de los flujos clave: estudiante anónimo estudia, se une a sección, hace diagnóstico, chatea; docente crea sección y ve datos.
- **Evals del tutor:** 30 casos por materia (golden set) que verifiquen que no regala la respuesta, no sale del currículo, no pide datos personales y responde bien ante malestar. Correrlas con un comando y guardar el reporte.
- CI básico (lint, tipos, pruebas) y `README` con instalación, variables de entorno y cómo ingestar y publicar contenido. `.env.example` completo; nunca subir secretos.

## 15. Costos y límites

- Generación masiva fuera de línea con el modelo barato; cachear todo lo reutilizable.
- Tutor con límites de uso por dispositivo y por sección; panel de costos en `/admin` leyendo `ai_usage`.
- Limitar la tasa de peticiones (usar contadores en Supabase o un servicio de límites; no depender de memoria del servidor, que en serverless no es fiable).

## 16. Plan por fases y fechas (objetivo: demo estable el 14 de octubre, colchón hasta el 16)

| Fase | Fechas | Entregable |
|---|---|---|
| 0. Cimientos | 30 sep – 2 oct | Repo, Supabase, esquema y RLS, capa de IA, despliegue vacío en Vercel, **inventario de fuentes** (`sources-inventory.md`) |
| 1. Currículo | 3 – 5 oct | Pipeline de ingesta y vista `/revisar`. **Matemáticas 7.º de punta a punta** como prueba del flujo |
| 2. Contenido | 6 – 8 oct | Generación de material e ítems con verificación. Español y Matemáticas de 7.º, 8.º y 9.º publicados |
| 3. Estudiante | 8 – 10 oct | Interfaz de estudio, práctica con retroalimentación, diagnóstico y dominio |
| 4. Tutor | 10 – 12 oct | Chat socrático anclado al currículo, herramienta de cálculo, límites y seguridad, evals |
| 5. Docente | 12 – 14 oct | Secciones con código, panel, mapa de calor, resumen con IA, modo demostración |
| 6. Cierre | 14 – 16 oct | Resto de materias hasta donde alcance, aviso de privacidad, pulido, README, *stretch* de coordinador |

**Prioridad de materias:** Español → Matemáticas → Ciencias → Estudios Sociales → Inglés → Formación Ciudadana. Si el tiempo aprieta, es mejor 2 materias completas y revisadas que 6 a medias, y las demás figuran como "próximamente".

## 17. Criterios de aceptación (definición de "listo" para el concurso)

- [ ] URL pública funcionando en celular y computadora.
- [ ] Un estudiante sin registro puede estudiar una unidad, practicar y consultar al tutor.
- [ ] Un estudiante puede unirse a una sección con nombre y código.
- [ ] El diagnóstico funciona y recomienda una ruta.
- [ ] Un docente crea una sección, comparte el código y ve el panel con datos reales o de demostración.
- [ ] El resumen con IA del panel explica cómo se calculó cada hallazgo.
- [ ] Español y Matemáticas de 7.º, 8.º y 9.º con contenido **revisado** y publicado.
- [ ] Todo contenido muestra su estado de revisión y permite reportar errores.
- [ ] Pruebas de RLS y evals del tutor pasan.
- [ ] Modo demostración con datos sintéticos etiquetados; sin datos reales de menores.
- [ ] Aviso de privacidad y leyenda de "iniciativa independiente, no oficial del MEP".
- [ ] README y `docs/` completos.

## 18. Anexo A — Fuentes del MEP

**Listados oficiales de programas de estudio (corregidos por el fundador el 1 de octubre de 2026):**
- I Ciclo: https://www.mep.go.cr/programas-estudio?texto-programas-academicos=&academico=8080
- II Ciclo: https://www.mep.go.cr/programas-estudio?texto-programas-academicos=&academico=8081
- III Ciclo: https://www.mep.go.cr/programas-estudio?texto-programas-academicos=&academico=8082
- Educación Diversificada: https://www.mep.go.cr/programas-estudio?texto-programas-academicos=&academico=8083

Solo se usan los programas de estudio de estos listados. Las tablas de especificaciones y prácticas de Educación Abierta (`dgec.mep.go.cr`) quedaron fuera por decisión del fundador (1 oct 2026), para evitar confusiones y reducir las fuentes que usan los agentes. Inventario real en `docs/sources-inventory.md`.

## 19. Anexo B — Datos verificados para la página de inicio y el pitch

Usa solo estos datos, citando fuente y año. Verifica de nuevo antes de publicar.

- **PISA 2025, matemáticas:** el 30 % del estudiantado costarricense alcanzó al menos el nivel básico, frente al 65 % promedio de la OCDE.
- **PISA 2025, lectura:** el 53 % alcanzó al menos el nivel 2, frente al 69 % de la OCDE. En ciencias, el 56 %.
- **Estancamiento:** los resultados de 2025 en matemáticas y lectura son similares a los de 2022 (387 y 416 puntos; en 2022 el 28 % alcanzó el nivel 2 en matemáticas). **No afirmar que empeoraron.**
- **Estado de la Educación 2025:** en secundaria apenas una cuarta parte tiene la capacidad de lectura que debería, y los estudiantes de 15 a 16 años tienen un vacío de al menos cuatro años en comprensión lectora y razonamiento matemático.
- **PISA 2025 (infraestructura):** el 68 % del estudiantado asiste a centros cuyas direcciones consideran que la falta de materiales afecta la enseñanza.
- **Política oficial:** el MEP reconoce una crisis de aprendizajes y equidad en su Política Institucional de la Calidad Educativa 2026-2036, que incluye entre sus ejes la recuperación de aprendizajes en Matemáticas, Lectura y Ciencias y el uso de inteligencia artificial en educación.
- **No usar** la frase "estado de emergencia educativo" salvo que se aporte una fuente oficial; no pudo confirmarse.

## 20. Anexo C — Decisiones y tareas que son mías (el fundador)

- Confirmar con docentes el registro del tutor (tuteo vs. otro).
- Revisión legal del aviso de privacidad, el consentimiento y la retención de datos.
- Conseguir revisores (docentes) para el contenido de al menos Español y Matemáticas.
- Completar `config/help-resources.json` con números de ayuda verificados.
- Aportar las claves de API y las cuentas de Supabase y Vercel.
- Confirmar las condiciones de reutilización del contenido del MEP.
