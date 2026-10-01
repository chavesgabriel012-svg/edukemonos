# Inventario de fuentes oficiales (III Ciclo)

Verificado el **1 de octubre de 2026**. Descargas con agente identificado, una petición cada 2–3 s, respetando `robots.txt` (ninguna ruta usada está bloqueada en `www.mep.go.cr`). Las 6 URLs respondieron **HTTP 200** y los 6 PDF tienen **texto extraíble** (no hace falta OCR).

**Única fuente curricular: los programas de estudio oficiales de la educación formal.** Las tablas de especificaciones y prácticas de Educación Abierta (`dgec.mep.go.cr`) se excluyeron por decisión del fundador el 1 de octubre de 2026.

Versión legible por máquina: [`scripts/ingest/sources.json`](../scripts/ingest/sources.json) (incluye rangos de páginas por grado). Como no hubo bloqueos, **no fue necesario crear `docs/sources-manual.md`**.

## 1. Listados oficiales de programas (enlaces corregidos el 1 de octubre de 2026)

Cada listado tiene 3 páginas (`&page=0..2`). Mezcla programas propios del ciclo con otros compartidos (lenguas indígenas, religión, orientación), y algunas etiquetas del sitio son inexactas (p. ej. `matematica.pdf` aparece como "Educación Diversificada" en todos los ciclos porque es un solo PDF de 1.º a 11.º).

| Ciclo | Listado | PDF | Programas de las materias del MVP |
|---|---|---|---|
| **III Ciclo (MVP)** | [`academico=8082`](https://www.mep.go.cr/programas-estudio?texto-programas-academicos=&academico=8082) | 20 | `espanol3ciclo_diversificada.pdf`, `matematica.pdf`, `ciencias3ciclo.pdf`, `esociales3ciclo_diversificada.pdf`, `ingles3ciclo_diversificada.pdf`, `civica3ciclo_diversificada.pdf` — **son exactamente los 6 del manifiesto** |
| I Ciclo (futuro) | [`academico=8080`](https://www.mep.go.cr/programas-estudio?texto-programas-academicos=&academico=8080) | 22 | `espanol1ciclo.pdf`, `matematica.pdf`, `ciencias1y2ciclo2018.pdf`, `esocialesecivica1y2ciclo.pdf`, `ingles1ciclo.pdf` |
| II Ciclo (futuro) | [`academico=8081`](https://www.mep.go.cr/programas-estudio?texto-programas-academicos=&academico=8081) | 21 | `espanol2ciclo.pdf`, `matematica.pdf`, `ciencias1y2ciclo2018.pdf`, `esocialesecivica1y2ciclo.pdf`, `ingles_2ciclo.pdf` |
| Educación Diversificada (futuro) | [`academico=8083`](https://www.mep.go.cr/programas-estudio?texto-programas-academicos=&academico=8083) | 22 | Los mismos de III Ciclo (son PDF conjuntos) + Biología, Química, Física, Filosofía, Psicología |

Hallazgos para cuando se sumen otros ciclos (no afectan el MVP):
- En I y II Ciclo, **Estudios Sociales y Educación Cívica son un solo programa** (`esocialesecivica1y2ciclo.pdf`). El catálogo de materias deberá permitir una materia combinada en esos ciclos; el modelo de datos ya lo soporta (las materias son filas).
- Ciencias de I y II Ciclo comparten un PDF (2018).
- "Formación Ciudadana" no aparece como programa formal en ningún ciclo; es el nombre de Educación Abierta.

### Otros enlaces revisados

| URL | Qué es | ¿Útil? |
|---|---|---|
| `mep.go.cr/tercer-ciclo-educacion-diversificada` | Página informativa (liceos rurales, colegios científicos), sin programas | No |
| `mep.go.cr/pruebas-bachillerato/edad` | Bachillerato por Madurez | Fuera del MVP |

## 2. Programas de estudio (educación formal)

| Materia | Archivo | Versión | Págs. | Tamaño | Alcance del PDF | Organización interna | Trimestre |
|---|---|---|---|---|---|---|---|
| Matemáticas | [`matematica.pdf`](https://www.mep.go.cr/sites/default/files/media/matematica.pdf) | 2012 | 518 | 8,9 MB | **1.º a 11.º** | III Ciclo en págs. 273–382 → área (Números, Geometría, Relaciones y Álgebra, Estadística y Probabilidad) → tabla "Conocimientos / Habilidades específicas / Indicaciones puntuales" por año | No |
| Español | [`espanol3ciclo_diversificada.pdf`](https://www.mep.go.cr/sites/default/files/media/espanol3ciclo_diversificada.pdf) | 2017 | 217 | 11,7 MB | 7.º a 11.º | Por año (7.º págs. 41–69, 8.º 70–100, 9.º 101–132): criterios transversales + eje temático + criterios de evaluación por periodo (I, II, III…). Anexos de tipos de texto y escritura | No (menciones sueltas) |
| Ciencias | [`ciencias3ciclo.pdf`](https://www.mep.go.cr/sites/default/files/media/ciencias3ciclo.pdf) | 2017 | 121 | 10,0 MB | 7.º a 9.º | Por año (7.º desde pág. 42, 8.º 60, 9.º 78) | No |
| Estudios Sociales | [`esociales3ciclo_diversificada.pdf`](https://www.mep.go.cr/sites/default/files/media/esociales3ciclo_diversificada.pdf) | 2016 | 213 | 2,5 MB | 7.º a 11.º | Por nivel (7.º desde pág. 69, 8.º 95, 9.º 118) → temas | No |
| Inglés | [`ingles3ciclo_diversificada.pdf`](https://www.mep.go.cr/sites/default/files/media/ingles3ciclo_diversificada.pdf) | 2016 | 359 | 3,3 MB | 7.º a 11.º | En inglés. Por año → 6 unidades → escenarios; niveles MCER (A1/A2/B1) | No |
| Educación Cívica | [`civica3ciclo_diversificada.pdf`](https://www.mep.go.cr/sites/default/files/media/civica3ciclo_diversificada.pdf) | Feb. 2009, reimpr. 2014 | 221 | 3,0 MB | 7.º a 11.º | Por nivel → unidades con título, objetivos y contenidos | **Sí**: "Tiempo probable: Primer/Segundo/Tercer trimestre" |

Notas:
- No encontré en `mep.go.cr` versiones más recientes de estos programas. No verifiqué otras fuentes (p. ej. sitio de Desarrollo Curricular).
- En Matemáticas, `pdftotext` **pierde exponentes y algunos operadores** (ej.: aparece `(5 + 7)2` donde el PDF muestra `(5 + 7)²`). Los extractos de esta materia deben revisarse contra el PDF.
- Hay además un programa de **Inglés para liceos bilingües** (`ingles-espanol-3ciclo.pdf`), fuera del MVP.
