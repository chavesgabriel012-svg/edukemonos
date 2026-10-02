# Marca Eduka

Resumen del manual de marca v1 (octubre 2026, hecho en Claude Design) y de cómo se aplica en el código.
Eduka se llamaba Edukemonos; la mascota y tutor, **Kemo**, conserva el nombre original.

## Dónde vive

| Qué | Archivo |
|---|---|
| Colores, tipografías, radios (tokens CSS) | `apps/web/src/app/globals.css` |
| Los mismos colores en TypeScript (íconos, imágenes generadas) | `apps/web/src/lib/brand.ts` |
| Logo, wordmark y Kemo | `apps/web/src/components/brand/logo.tsx` |
| Ícono por materia | `apps/web/src/components/brand/subject-icon.tsx` |
| Favicon, ícono de iPhone, íconos de la app, manifest | `app/icon.svg`, `app/apple-icon.tsx`, `app/icons/[size]/route.tsx`, `app/manifest.ts` |
| Imagen al compartir un enlace (WhatsApp, Facebook…) | `app/opengraph-image.tsx` |

## Color

| Nombre | Hex | Uso |
|---|---|---|
| Violeta Eduka | `#5B3DF5` | Primario: acciones, marca (`bg-violeta`, `bg-primary`) |
| Lima | `#C6F432` | Acento: resaltar, Kemo, botón secundario (`bg-lima`) |
| Tinta | `#17132A` | Texto y fondos oscuros (`text-tinta`) |
| Papel | `#F6F5F9` | Fondo principal |

Colores por materia (misma luminosidad y saturación, cambia el tono; **el texto encima siempre es Tinta**):
Matemáticas `#F7997C`, Español `#EDBB55`, Ciencias `#74D49A`, Estudios Sociales `#5CC3EB`, Inglés `#F391B6`,
Cívica `#C49BF0`. En código: `subjectColor(id)` o las clases `bg-matematicas`, `bg-espanol`, etc.

## Tipografía

- **League Spartan** Bold: títulos, logo, piezas para redes (`font-heading`; los `h1`–`h3` ya la usan).
- **Outfit** 400/500/600: interfaz y lectura (fuente por defecto).
- **Geist Mono**: datos, etiquetas y conteos (`font-mono`), por ejemplo «MATEMÁTICAS · 7.º» o «62 %».

## Logo y Kemo

- `<Logo />`: símbolo + wordmark (encabezado). Alto mínimo 24 px; área de respeto = alto de la «E» × 0,35.
- `<Wordmark />`: «Eduka» con la burbuja de chat sobre la «a»: el tutor que te guía.
- `<Kemo mood=… />`: el símbolo. **Solo se mueven los ojos**: nunca boca, brazos ni cuerpo.

| Mirada | Uso en la app |
|---|---|
| `normal` (Curioso) | Por defecto: inicio, tutor, estado vacío del chat |
| `think` (Pensando) | El tutor está escribiendo; respuesta incorrecta en la práctica |
| `wow` (Sorpresa) | Dato curioso; página 404 |
| `happy` (Feliz) | Respuesta correcta; diagnóstico terminado |
| `down` (Concentrado) | Antes del diagnóstico; página de error |

## Interfaz

- Botones: radio 14 px, alto 52 px. Primario violeta con texto blanco; secundario lima con texto Tinta; terciario con
  borde Tinta.
- Tarjetas: radio 22 px. Encabezados de materia y unidad con el color de la materia.
- Íconos: el manual usa Phosphor Bold; la app usa Lucide con trazo 2,5, que da el mismo efecto (grueso, redondeado,
  un solo color).

## Voz

- **Tuteo, nunca voseo**: «Piénsalo en una recta numérica», no «Pensalo». El ejemplo del chat del manual usa voseo;
  en la app y en el tutor se escribe con tuteo (el tutor lo corrige en código si se le escapa).
- No suponer el género del estudiante: «te doy la bienvenida», «por tu cuenta», «aunque tengas dudas».
- El manual habla de «1.º a 11.º» (la visión). Mientras solo haya contenido de III Ciclo, la app y las piezas dicen
  «de 7.º a 9.º» para no prometer lo que todavía no hay.
- Siempre visible: «Eduka es una iniciativa independiente. No es una plataforma oficial del Ministerio de Educación
  Pública.»
