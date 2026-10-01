# Inventario de fuentes oficiales (III Ciclo)

Verificado el **1 de octubre de 2026**. Descargas con agente identificado, una petición cada 2–3 s, respetando `robots.txt` (ninguna ruta usada está bloqueada en `www.mep.go.cr` ni en `dgec.mep.go.cr`). Todas las URLs respondieron **HTTP 200** y todos los PDF tienen **texto extraíble** (no hace falta OCR), salvo la observación sobre las prácticas de Inglés.

Versión legible por máquina: [`scripts/ingest/sources.json`](../scripts/ingest/sources.json) (incluye rangos de páginas por grado). Como no hubo bloqueos, **no fue necesario crear `docs/sources-manual.md`**.

## 1. Qué contiene realmente cada enlace del Anexo A

| URL | Qué es en realidad | ¿Útil para el MVP? |
|---|---|---|
| `mep.go.cr/programas-estudio` | Buscador de programas con filtro por nivel (Preescolar, I Ciclo, II Ciclo, III Ciclo, Diversificada, Técnica, Talleres). La primera página muestra programas mezclados (religión, lenguas indígenas, psicología). | Sí, es la puerta a los programas. |
| `mep.go.cr/programas-estudio-iii-ciclo` (enlazada desde la anterior, no estaba en el Anexo A) | Listado de III Ciclo, 3 páginas. **Aquí están los 6 programas que necesitamos.** | **Sí, fuente principal.** |
| `mep.go.cr/programas-estudio?…academico=8083` | Listado de Educación Diversificada (3 páginas). Repite varios programas compartidos con III Ciclo. | Solo como referencia. |
| `mep.go.cr/tercer-ciclo-educacion-diversificada` | Página informativa sobre la oferta (liceos rurales, colegios científicos). **No contiene programas.** | No. |
| `dgec.mep.go.cr/iii-ciclo/` | Educación Abierta III Ciclo (EGBA): **tablas de especificaciones 02-2026**, **prácticas 2026** por grado y materia, calendarios e instructivos. Confirma: "A partir del año 2026, los ítems de selección única… enunciado seguido de cuatro opciones de respuesta, de las cuales solo una es correcta". | Sí: tablas (cobertura, ponderación) y prácticas (estilo/dificultad). |
| `dgec.mep.go.cr/i-y-ii-ciclo/` | Equivalente para I y II Ciclo. | Fuera del MVP. |
| `dgec.mep.go.cr/educacion-diversificada-a-distancia/` | Equivalente para Diversificada a distancia. | Fuera del MVP. |
| `mep.go.cr/pruebas-bachillerato/edad` | Bachillerato por Madurez. | Fuera del MVP. |

## 2. Programas de estudio (educación formal)

| Materia | Archivo | Versión | Págs. | Tamaño | Alcance del PDF | Organización interna | Trimestre |
|---|---|---|---|---|---|---|---|
| Matemáticas | [`matematica.pdf`](https://www.mep.go.cr/sites/default/files/media/matematica.pdf) | 2012 | 518 | 8,9 MB | **1.º a 11.º** | III Ciclo en págs. 273–382 → área (Números, Geometría, Relaciones y Álgebra, Estadística y Probabilidad) → tabla "Conocimientos / Habilidades específicas / Indicaciones puntuales" por año | No |
| Español | [`espanol3ciclo_diversificada.pdf`](https://www.mep.go.cr/sites/default/files/media/espanol3ciclo_diversificada.pdf) | 2017 | 217 | 11,7 MB | 7.º a 11.º | Por año (7.º págs. 41–69, 8.º 70–100, 9.º 101–132): criterios transversales + eje temático + criterios de evaluación por periodo (I, II, III…). Anexos de tipos de texto y escritura | No (menciones sueltas) |
| Ciencias | [`ciencias3ciclo.pdf`](https://www.mep.go.cr/sites/default/files/media/ciencias3ciclo.pdf) | 2017 | 121 | 10,0 MB | 7.º a 9.º | Por año (7.º desde pág. 42, 8.º 60, 9.º 78) | No |
| Estudios Sociales | [`esociales3ciclo_diversificada.pdf`](https://www.mep.go.cr/sites/default/files/media/esociales3ciclo_diversificada.pdf) | 2016 | 213 | 2,5 MB | 7.º a 11.º | Por nivel (7.º desde pág. 69, 8.º 95, 9.º 118) → temas | No |
| Inglés | [`ingles3ciclo_diversificada.pdf`](https://www.mep.go.cr/sites/default/files/media/ingles3ciclo_diversificada.pdf) | 2016 | 359 | 3,3 MB | 7.º a 11.º | En inglés. Por año → 6 unidades → escenarios; niveles MCER (A1/A2/B1) | No |
| Educación Cívica (≈ "Formación Ciudadana") | [`civica3ciclo_diversificada.pdf`](https://www.mep.go.cr/sites/default/files/media/civica3ciclo_diversificada.pdf) | Feb. 2009, reimpr. 2014 | 221 | 3,0 MB | 7.º a 11.º | Por nivel → unidades con título, objetivos y contenidos | **Sí**: "Tiempo probable: Primer/Segundo/Tercer trimestre" |

Notas:
- No encontré en `mep.go.cr` versiones más recientes de estos programas. No verifiqué otras fuentes (p. ej. sitio de Desarrollo Curricular).
- En Matemáticas, `pdftotext` **pierde exponentes y algunos operadores** (ej.: aparece `(5 + 7)2` donde el PDF muestra `(5 + 7)²`). Los extractos de esta materia deben revisarse contra el PDF.
- Hay además un programa de **Inglés para liceos bilingües** (`ingles-espanol-3ciclo.pdf`), fuera del MVP.

## 3. Tablas de especificaciones DGEC (Educación Abierta, convocatoria 02-2026)

| Materia | Archivo | Págs. | Tamaño | Estructura |
|---|---|---|---|---|
| Matemáticas | `2026/06/MATEMATICAS-TABLA-ESPECIFICACIONES-III-CICLO-02-2026.pdf` | 19 | 1,2 MB | Por nivel → área (con nº de ítems) → conocimientos + habilidades numeradas (1.1, 1.2…) **copiadas del programa 2012** + ítems por grupo |
| Español | `2026/03/TABLAS-DE-ESPECIFICACIONES-III-CICLO-ESPANOL.pdf` | 40 | 1,3 MB | Habilidades articuladoras, criterios de evaluación del programa, aprendizajes esperados, ítems. Niveles Térraba (7.º), Ujarrás (8.º), Zapandí (9.º) |
| Ciencias | `2026/06/CIENCIAS-TABLA-ESPECIFICACIONES-III-CICLO-02-2026.pdf` | 26 | 1,1 MB | Por nivel → eje temático → criterios de evaluación + contextos disciplinarios + ítems |
| Estudios Sociales | `2026/06/ESTUDIOS-SOCIALES-TABLA-ESPECIFICACIONES-III-CICLO-02-2026.pdf` | 20 | 0,8 MB | Eje temático integrador por nivel, tres temas generadores por nivel; declara congruencia con el programa 2016 |
| Inglés | `2026/06/INGLES-TABLA-ESPECIFICACIONES-III-CICLO-02-2026.pdf` | 60 | 1,1 MB | Por nivel → 6 unidades → escenario; solo comprensión de lectura |
| Formación Ciudadana | `2026/03/TABLA-DE-ESPECIFICACIONES-III-CICLO-Formacion-Ciudadana.pdf` | 14 | 0,7 MB | Por nivel → tema (coinciden con unidades del programa de Educación Cívica) → objetivos + contenidos + ítems |

Base de todas las URLs: `https://dgec.mep.go.cr/wp-content/uploads/`.

## 4. Prácticas DGEC 2026 (18 archivos)

Patrón confirmado: `https://dgec.mep.go.cr/wp-content/uploads/2026/07/Practica-{Setimo|Octavo|Noveno}-{Espanol|Matematicas|Ciencias|Estudios-Sociales|Ingles|Formacion-Ciudadana}-02-2026.pdf`. **Las 18 existen** (HTTP 200).

| | Español | Matemáticas | Ciencias | Est. Sociales | Inglés | F. Ciudadana |
|---|---|---|---|---|---|---|
| 7.º | 33 p · 1,4 MB | 23 p · 1,1 MB | 29 p · 1,3 MB | 26 p · 1,6 MB | 26 p · 4,5 MB ⚠ | 30 p · 2,8 MB |
| 8.º | 30 p · 1,2 MB | 25 p · 1,1 MB | 29 p · 1,2 MB | 26 p · 1,3 MB | 26 p · 4,5 MB ⚠ | 31 p · 1,6 MB |
| 9.º | 42 p · 1,7 MB | 26 p · 1,1 MB | 35 p · 1,4 MB | 28 p · 1,9 MB | 26 p · 4,9 MB ⚠ | 28 p · 1,9 MB |

⚠ Inglés: casi todo imagen (~480 caracteres por página). Si se quieren usar para calibrar, hace falta OCR o revisión manual.

Uso permitido según la regla 7 del SPEC: **calibrar estilo y dificultad y enlazar como "Práctica oficial MEP"**; no reproducir sus ítems.

## 5. Otros documentos vistos en `dgec.mep.go.cr/iii-ciclo/` (no se usan)

Calendario y requisitos 02-2026, publicación de sedes, instructivos de "Yo Aplico", instructivo de aplicación 2026, reconocimiento de III Ciclo EGBA.
