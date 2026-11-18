# Eduka: competencia y posicionamiento

Fuente: estudio competitivo verificado el 14 de noviembre de 2026, con las páginas oficiales de cada
proveedor y el código de este repositorio. Es el criterio para decidir qué construir, qué priorizar y
cómo describir Eduka en la interfaz, la documentación y los textos de venta.

## Dónde se ubica Eduka

Eduka **no** es «un tutor con IA». El tutor que guía sin dar la respuesta ya es gratis y casi
universal: Gemini, Copilot, ChatGPT, Khanmigo, Flint, SchoolAI… Eduka es el **registro de qué domina
cada estudiante del programa del colegio**, construido sin trabajo del docente:

> Programa del colegio (o del MEP) → unidades, material, diagnóstico y ejercicios verificados → tutor
> Kemo que guía → dominio por habilidad para el docente.

- **Cliente principal:** colegios y escuelas **privadas de Costa Rica**, con licencia anual (B2B).
- **Después:** preparación para exámenes, educación especial y el resto de Latinoamérica.
- **El MEP** es la fase 2.

## Las 5 ventajas que nadie más combina (protegerlas)

1. **Cero carga docente.** Flint, SchoolAI, Brisk, MagicSchool y Gemini piden que el docente suba
   materiales y arme actividades. En Eduka, el docente solo crea el grupo y comparte el código.
2. **Contenido verificado del programa.** Un segundo modelo resuelve cada ejercicio sin ver la
   respuesta, y `mathjs` revisa los cálculos. Lo que no está verificado no se publica ni entra al
   diagnóstico. Ningún competidor revisado documenta algo así, ni usa el programa del MEP.
3. **Analítica de dominio sin leer chats.** Diagnóstico inicial, dominio por habilidad y quién
   necesita apoyo. Las grandes empresas no dan dominio por habilidad; los demás dan participación o
   resúmenes.
4. **Privacidad pensada para menores.**
   - Sin cuentas ni correos para el estudiante.
   - El nombre nunca llega a la IA.
   - El docente ve temas, no conversaciones.
   - Los chats se borran a los 30 días.

   Flint y SchoolAI dejan al docente leer todo, y ninguno de los competidores revisados publica
   cuánto tiempo guarda los chats.
5. **Local.** Programa del MEP, español de Costa Rica y equipo en el país.

## Criterios para construir

- **No debilitar las 5 ventajas.** Nada que:
  - exija preparación al docente;
  - publique contenido sin verificar;
  - muestre transcripciones al docente;
  - envíe nombres u otros datos personales a la IA;
  - alargue la retención de chats.
- **Priorizar lo que refuerza el diferencial**, no lo que copia a la competencia:
  - **Cargar el programa propio del colegio.** Hoy solo acepta PDF desde un manifiesto, y lo opera
    el equipo. Faltan Word y presentaciones, el idioma y la terminología del colegio, y una vista para
    que el colegio apruebe antes de publicar.
  - **Más materias y grados.** Hoy solo hay Español y Matemáticas de 7.º a 9.º.
  - **Calidad del panel de dominio y del diagnóstico.**
- **No competir en el tutor genérico.** Mejorar a Kemo está bien, pero un chat más «inteligente» no
  diferencia: Google ya da un tutor guiado gratis dentro de Classroom.
- **La gamificación premia el dominio, nunca el tiempo ni la velocidad.** Sin compras, sin cajas de
  botín y sin culpa.
- **Ser honestos en textos de producto y documentación.** No escribir «100 % del MEP» ni «ingesta
  automática de Word y presentaciones», porque hoy no es cierto. Describir lo que existe.
- **Primaria requiere más cuidado.** Son menores de 12 años: antes de habilitar el tutor en primaria,
  hay que evaluar el tono y la seguridad para esa edad.

## Mapa rápido de competidores

| Competidor | Qué ofrece | Por qué Eduka es distinta |
|---|---|---|
| Flint (EE. UU.) | Tutor Sparky; el docente sube sus materiales. Gratis con alumnos ilimitados; para escuelas, desde US$3.000 al año | El docente arma todo y lee las transcripciones; sin currículo local |
| SchoolAI (EE. UU.) | Spaces que arma el docente, monitoreo en vivo y tutor 24/7 en el plan Scale | Todo parte del docente; modelo de vigilancia |
| Khanmigo | Tutor sobre el contenido de Khan Academy; gratis para docentes de Latinoamérica, en español | Para estudiantes, solo en EE. UU.; no usa el programa del MEP ni el del colegio |
| MagicSchool | Más de 80 herramientas para docentes, y MagicStudent | Productividad docente; sin diagnóstico ni banco de temas |
| Brisk Boost | Actividades a partir de documentos, por enlace o QR | Trabajo diario del docente; no sigue el dominio en el tiempo |
| Gemini en Classroom, Copilot, ChatGPT | Tutor guiado gratis | Sin dominio por habilidad, diagnóstico ni contenido verificado |
| Costa Rica: Inspired AI, Amira, Ociann | IA interna de un grupo de colegios, lectura para el MEP, IA solo para docentes | Ninguno junta tutor, programa del MEP y dominio para colegios privados |

## Evidencia que respalda el enfoque

Bastani et al. (PNAS, 2025) encontraron que estudiantes de secundaria que practicaron con un chatbot
libre sacaron un 17 % menos en el examen sin IA. Con un tutor con salvaguardas, ese daño se redujo en
gran medida. Lo que importa es la estructura, la verificación y la guía, que es justo lo que construye
Eduka.
