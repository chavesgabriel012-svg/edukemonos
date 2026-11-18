# Salir live: qué falta para el colegio fundador

Revisión técnica del 18 de noviembre de 2026. La meta: que el día que firme el colegio fundador y entre
el capital semilla, se pueda empezar esa misma semana.

Eduka tiene tres partes:

- **Estudiante:** material, práctica, minijuegos y Kemo, el tutor.
- **Docente:** avance de cada estudiante, análisis y recomendaciones.
- **Colegio:** todo lo anterior, hecho con el contenido del colegio.

Las dos primeras ya funcionan de punta a punta. La tercera, armar y administrar un colegio, todavía
se hace a mano con SQL y scripts. Ahí está lo que falta.

## Lo que se revisó

- **Rutas.** Se recorrieron las 24 rutas públicas y de demostración en escritorio y en teléfono
  (iPhone SE), contra la base de producción. Todas responden y ninguna tiene errores de JavaScript ni
  se sale de la pantalla.
- **Pruebas.** Typecheck, lint y las 28 pruebas de la web pasan.
- **Chat de Kemo.** Se probó el chat nuevo con respuestas simuladas, sin gastar presupuesto de IA.
- **Flujo docente real.** No se probó. Hace falta una cuenta docente en producción y no quise crear
  datos de prueba ahí sin su visto bueno. Se revisó el código y se usó el panel de demostración.

## P0: sin esto no se puede salir

| # | Qué | Por qué | Esfuerzo |
|---|-----|---------|----------|
| 1 | **Consola del equipo Eduka** (`/admin`): crear el colegio, sus grados y materias, subir documentos, generar, revisar y publicar contenido, e invitar docentes | Hoy un colegio se arma con SQL y scripts desde la terminal | 2–3 semanas |
| 2 | **Contenido por colegio**: `institution_id` en `curriculum_sources`, `curriculum_units` e `items`, y que cada estudiante vea solo el de su colegio | Todo el contenido es global; dos colegios verían lo mismo | 1 semana (va con la 1) |
| 3 | **Acceso docente por invitación**: el colegio entrega la lista, Eduka invita por correo y la persona entra con enlace | Hoy cualquiera con correo queda como docente | 3–4 días |
| 4 | **Correo propio** (SMTP con Resend u otro, en un dominio de Eduka) | El correo que trae Supabase envía muy pocos mensajes por hora y no sirve para producción. Hay que revisar en el panel de Supabase qué está configurado hoy | 1 día |
| 5 | **Planes pagos**: Vercel Pro (US$20) y Supabase Pro (US$25) | Vercel Hobby prohíbe el uso comercial, y en el plan gratis Supabase pausa el proyecto y no hace copias diarias | 1 hora, cuando entre el dinero |
| 6 | **Presupuesto de IA por colegio** y la evaluación del prompt v12 | Noviembre ya gastó US$12,14 de un tope de US$8, y la evaluación del tutor está pendiente por eso | 2 días |
| 7 | **Revisión legal**: Ley 8968, consentimiento de las familias para menores, contrato con el colegio como responsable de los datos | Datos de menores; tiene que verlo un abogado antes de firmar | Externo |

## P1: el primer mes con el colegio

| # | Qué | Por qué |
|---|-----|---------|
| 8 | **Monitoreo de errores** (Sentry o similar) y alertas de gasto de IA | Hoy un error en producción solo se ve si alguien lo reporta |
| 9 | **Pruebas de punta a punta** con Playwright en CI: unirse con código, practicar, el tutor (simulado) y el panel docente | El recorrido de hoy se hizo a mano |
| 10 | **Prompts sin «colegios públicos de Costa Rica»** fijo: el nombre, el nivel y el idioma salen del colegio | Seis prompts lo dicen hoy (`packages/ai/src/prompts/`) |
| 11 | **Grados y materias desde la base**, no desde el código | 7.º a 9.º y las seis materias están escritos en el código |
| 12 | **Coordinación del colegio** puede agregar y quitar docentes y ver todas las secciones | Hoy depende del equipo Eduka |
| 13 | **Política de contenido** para que una CSP completa no rompa el sitio | Ya están los encabezados básicos; una CSP con nonces necesita probarse página por página |

## P2: cuando haya un segundo colegio

- Colegios en inglés (AP, IB): necesitan sus propias protecciones (filtro de género, tuteo y
  detección de malestar están escritos para el español) y sus propias evaluaciones.
- «Entrar con Google» o Microsoft limitado al dominio del colegio.
- Una dirección propia por colegio (`institutions.slug` ya está reservado para eso).
- Reportes para dirección: uso por grado y materia, sin datos individuales.

## Hecho en esta revisión

- Etiquetas y números con la tipografía de Eduka, sin la mono en mayúsculas; los códigos de sección
  y de certificado la conservan para que 0 y O no se confundan.
- Menos textos al pie: sin «Hasta 60 mensajes por día» ni los atajos de teclado en el chat. Tampoco
  queda la nota de la racha, y la explicación de puntos del torneo pasó a un desplegable.
- El chat de Kemo se lee como un chat de IA común:
  - los mensajes del estudiante a la derecha;
  - las respuestas de Kemo a todo el ancho, con botón para copiar;
  - puntos animados mientras escribe;
  - una caja que crece con el texto y queda fija abajo;
  - el conteo de mensajes aparece solo cuando quedan 3 o menos.
- Encabezados de seguridad en todas las páginas:
  - bloquea que otra página meta a Eduka en un marco;
  - el navegador no adivina el tipo de los archivos;
  - no se comparten rutas con otros sitios;
  - obliga a usar HTTPS;
  - bloquea cámara, micrófono y ubicación.

## Referencias

- El estudio de productos similares (Flint y otros) está en el chat «Eduka» de Claude Cowork, al que
  esta sesión no tiene acceso. Si lo pega aquí o lo sube al repositorio, se usa para priorizar la
  consola y el panel docente.
