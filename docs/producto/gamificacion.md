# Eduka v2 · Gamificación y funciones para colegios

Diseño de la rama `producto/eduka-v2`. Todo lo nuevo va en una rama nueva que sale de `producto/eduka-v2` y vuelve a
ella con un PR. Nada pasa a `main` sin aprobación del fundador.

| Fase | Rama | Qué entrega |
|---|---|---|
| 0 | `producto/fase-0-requisitos` | Este documento, código personal de recuperación, salida del tutor a 2 048 tokens, `.env.example` |
| 1 | `fase-1` | Racha semanal de dominio, calendario escolar, comodín, aviso de descanso |
| 2 | `producto/fase-2-meta-seccion` | Meta colectiva semanal y tabla con apodos |
| 3 | `producto/fase-3-minijuegos` | Mecánicas fijas con contenido generado y verificado |
| 4 | `producto/fase-4-torneo` | Torneo automático de los viernes |
| 5 | `producto/fase-5-reconocimiento` | Insignias, certificado de dominio y equipo destacado |

## 1. Principios

Estos principios mandan sobre cualquier detalle de diseño de abajo.

1. **Todo premia dominio**: ejercicios bien resueltos. Nunca clics, tiempo en pantalla ni velocidad.
2. **Sin presión dañina**: nada de mensajes de culpa, avisos que metan miedo a perder una racha, cajas de botín,
   compras ni ventajas pagadas.
3. **Pausar nunca hace perder lo ganado.** El dominio, el récord de racha, las insignias y los certificados no
   se pierden nunca. Lo único que puede terminar es la racha *en curso*, y entonces se muestra el récord y se
   invita a empezar de nuevo. Después de una sesión larga aparece un aviso amable de descanso.
4. **Privacidad de menores**: el nombre real nunca llega a la IA. En lo que ve la clase solo aparecen apodos de una
   lista segura, y cualquier estudiante puede ocultarse.
5. **Nunca se muestra el último lugar ni la lista completa ordenada.**
6. **El docente no tiene que hacer nada**: todo funciona solo. El docente solo puede apagar funciones.
7. **Todo cuenta para el dominio del MEP**: cada respuesta de un juego o torneo actualiza el dominio por habilidad y
   aparece en el panel docente con su origen (práctica, diagnóstico, juego o torneo).
8. **Español con tuteo y sin suponer el género**, igual que el resto de la app.

## 2. Conceptos que usan todas las fases

### 2.1 Semana

- La semana va de **lunes a domingo, en hora de Costa Rica** (UTC−6, sin horario de verano). Es la misma
  convención que ya usa el fusible de gasto (`startOfDayCR`).
- En SQL: `private.week_start_cr(ts timestamptz) returns date`, el lunes de esa semana. En TypeScript, la misma
  función en `@edukemonos/curriculum`, con pruebas que comparan las dos.

### 2.2 Ejercicio bien resuelto

Una semana cuenta los **ítems distintos** que el estudiante respondió bien en esa semana, en cualquier contexto
(práctica, diagnóstico, juego o torneo):

- Responder bien dos veces el mismo ítem en la misma semana cuenta una sola vez, para que repetir no sume.
- Las consignas de escritura abiertas no cuentan, porque no tienen corrección automática (`is_correct` es nulo).
- Los ítems sin verificar sí cuentan para la racha, igual que en la práctica de hoy, pero nunca para el diagnóstico.

### 2.3 Dominio de una habilidad

Se mantiene el modelo actual: el puntaje Rasch de `mastery`, con «dominada» a partir de 0,70 (`STRONG`). Las
fases 2, 4 y 5 necesitan saber **cuánto cambió el dominio en una semana**, así que se agrega:

```sql
create table public.mastery_weekly (
  student_id uuid references public.students on delete cascade,
  skill_id   uuid references public.skills on delete cascade,
  week_start date,               -- lunes, hora de Costa Rica
  score_start numeric not null,  -- dominio antes del primer intento de la semana (0,5 si no había dato)
  score_end   numeric not null,  -- dominio después del último intento de la semana
  attempts    integer not null,
  primary key (student_id, skill_id, week_start)
);
```

`submit_attempt` la actualiza en la misma transacción que `mastery`. Con ella:

- **mejora de la semana** = Σ (`score_end` − `score_start`) de las habilidades trabajadas en la semana.
- **habilidad dominada en la semana** = `score_start` < 0,70 y `score_end` ≥ 0,70.

### 2.4 Contexto de cada respuesta

`attempt_context` pasa de `practice | diagnostic` a `practice | diagnostic | game | tournament` (`game` en la fase 3,
`tournament` en la fase 4). Todas las respuestas pasan por `submit_attempt`, que corrige en el servidor y actualiza
`mastery` y `mastery_weekly` igual que la práctica. El panel docente muestra el origen de cada intento.

### 2.5 Configuración por sección

El docente no configura nada para que todo funcione. Solo puede apagar funciones:

```sql
create table public.section_settings (
  section_id uuid primary key references public.sections on delete cascade,
  streak_enabled boolean not null default true,                                  -- fase 1
  weekly_target  smallint not null default 5 check (weekly_target between 1 and 50),  -- fase 1
  -- goal_enabled, leaderboard_enabled, games_enabled, tournament_enabled: cada fase agrega la suya
  updated_at timestamptz not null default now()
);
```

Una sección sin fila usa los valores por defecto. Solo el docente dueño de la sección la lee y la escribe. La
sección no elige calendario: usa el de su institución (§2.6).

### 2.6 Instituciones y calendario escolar

**Instituciones (decisión del fundador, 3 nov).** Para crear un Eduka por institución, cada una tiene su id en la base
de datos:

```sql
create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,           -- opcional, para una dirección propia en el futuro (eduka.cr/liceo-x)
  calendar_id uuid,           -- su calendario del año en curso
  created_at timestamptz not null default now()
);
create table public.institution_members (     -- quién pertenece y con qué papel
  institution_id uuid references public.institutions on delete cascade,
  profile_id uuid references public.profiles on delete cascade,
  role public.institution_role not null default 'teacher',   -- 'admin' | 'teacher'
  primary key (institution_id, profile_id)
);
alter table public.sections add column institution_id uuid references public.institutions on delete set null;
```

- Las instituciones las crea por ahora un administrador de la plataforma. Quien administra una institución agrega
  docentes por su correo (`add_institution_member`), edita su calendario y ve sus miembros.
- El docente asocia su sección a una institución desde los ajustes de la sección, y solo a una de la que es miembro.
  `institution_text` se mantiene como texto libre para quien no tiene institución.

**Calendario.** Uno por año, con vacaciones y **periodos editables**:

```sql
create table public.school_calendars (
  id uuid primary key default gen_random_uuid(),
  name text not null,                 -- 'MEP 2027' o '<institución> 2027'
  school_year smallint not null,
  classes_start date not null,        -- MEP 2027: 2027-03-01
  classes_end   date not null,        -- MEP 2027: 2027-11-30
  institution_id uuid references public.institutions on delete cascade,  -- null = oficial del MEP
  created_at timestamptz not null default now()
);
create table public.school_calendar_breaks  (calendar_id, starts_on, ends_on, label);   -- MEP 2027: 2–16 jul
create table public.school_calendar_periods (calendar_id, starts_on, ends_on, label, sort_order);
```

- El calendario oficial MEP 2027 se carga en una migración, con dos semestres (1 mar–1 jul y 17 jul–30 nov). Sin que
  nadie haga nada, todas las secciones lo usan.
- **Periodos editables (decisión del fundador, 3 nov):** cada institución define los suyos. Pueden ser 2 semestres, 3
  trimestres o lo que use, de 1 a 4. El formulario los propone con un toque («2 semestres», «3 trimestres»), cortando
  en las vacaciones, y se pueden ajustar a mano.
- **Qué calendario usa una sección:** el de su institución para ese año; si no tiene, el oficial del MEP.
- **Semana de vacaciones**: una semana (lunes a domingo) sin ningún día de clases (lunes a viernes, dentro del año
  lectivo y fuera de vacaciones). Una semana con al menos un día de clases cuenta normalmente; por ejemplo, la del
  28 de junio de 2027, aunque las vacaciones empiecen el viernes 2 de julio.
- **Antes del inicio y después del fin de clases** también es vacaciones: la racha se congela. **Un año sin
  calendario cargado** (por ejemplo, 2026, antes de MEP 2027) no pausa nada: todas las semanas cuentan.
- **Estudiante sin sección**: usa el calendario MEP del año. **Estudiante en varias secciones**: una semana se
  pausa si es de vacaciones en *cualquiera* de sus calendarios. Es la regla más generosa y evita perder la racha
  por un calendario ajeno. El periodo del comodín sale del calendario de la primera sección a la que se unió.

### 2.7 Eventos

Todo va a la tabla `events` (`name`, `props`), sin datos personales: `actor_id` es el id anónimo y `props` nunca
lleva nombres, apodos, texto del estudiante ni respuestas. Nombres previstos:

| Evento | `props` |
|---|---|
| `recovery_code_created` | `{}` |
| `recovery_code_redeemed` | `{ "moved": { "attempts": 12, … } }` (solo conteos) |
| `streak_week_completed` | `{ "week": "2027-03-08", "target": 5 }` |
| `streak_repaired` | `{ "week": "2027-03-15" }` |
| `rest_reminder_shown` | `{ "minutes": 61 }` |
| `nickname_chosen` / `leaderboard_hidden` | `{ "section": "<uuid>" }` |
| `game_played` | `{ "mechanic": "pairs", "unit": "<uuid>", "correct": 5, "total": 6 }` |
| `tournament_joined` | `{ "tournament": "<uuid>" }` |
| `badge_earned` | `{ "badge": "skill_mastered", "skill": "<uuid>" }` |
| `certificate_downloaded` | `{ "unit": "<uuid>" }` |
| `feature_toggled` (docente) | `{ "section": "<uuid>", "feature": "leaderboard", "enabled": false }` |

Los eventos de estudiantes se escriben desde funciones `security definer`, para que no se puedan inventar desde el
navegador. La política actual (`events_insert_own`) se mantiene para los de la interfaz, como `rest_reminder_shown`.

## 3. Fase 0 · Requisitos previos

### 3.1 Código personal de recuperación

Hoy el estudiante es un usuario anónimo de Supabase y su progreso vive en la sesión de ese navegador. Si cambia de
celular o borra los datos, lo pierde todo, y con eso cualquier racha.

**Decisión: el código traslada el progreso; no convierte la cuenta.** Descarté dos alternativas:

- **Convertir la cuenta anónima en una con correo inventado** (`<id>@…` + contraseña = código). La app distingue al
  personal por `is_anonymous` (`lib/staff.ts`, `docente/page.tsx`, el CSV), así que ese estudiante pasaría por
  docente. Además dependería de cómo esté configurado el proveedor de correo en Supabase.
- **Guardar el código en texto plano** para mostrarlo siempre. Es una credencial: se guarda solo su hash.

Cómo funciona:

1. **Generar.** En «Mi progreso», el estudiante pide «Crear mi código de recuperación» y la app muestra un código
   como `K7QM-4RTX-9PZC`: 12 caracteres de un alfabeto sin confusiones (`23456789ABCDEFGHJKMNPQRSTUVWXYZ`, sin
   0/O, 1/I/L), unos 59 bits. Se muestra **una sola vez**, con «Cópialo o anótalo en tu cuaderno». Si lo pierde,
   genera otro desde el dispositivo donde tiene su progreso, y el anterior deja de servir.
2. **Guardar.** `student_recovery_codes(student_id pk, code_hash, created_at, last_used_at)`, donde
   `code_hash = sha256(código normalizado)`. Se usa `sha256()` de Postgres, sin extensiones.
3. **Recuperar.** En otro dispositivo, en «¿Ya tienes un código?», escribe el código (acepta minúsculas, espacios y
   guiones). `redeem_recovery_code(code)` busca el hash y **traslada todo** de la cuenta anterior a la sesión
   anónima actual: intentos, diagnósticos, dominio, sesiones del tutor, retroalimentación de escritura,
   membresías de sección y, más adelante, racha, apodos, insignias y equipos. El código queda asociado a la cuenta
   nueva, así que sirve otra vez.
4. **Choques.** Si el dispositivo nuevo ya tenía algo de progreso:
   - en `mastery` se queda la fila con más intentos;
   - en `section_members` se queda la membresía anterior, con su consentimiento original;
   - el grado declarado anterior gana si existía.
   Al final se borra la fila `students` anterior.
5. **Límites.** 5 intentos de canje cada 15 minutos por sesión y 20 por hora por IP (`consume_quota`). Con 59 bits,
   adivinar un código no es viable.
6. **Nunca se pierde una tabla.** Una prueba de base de datos lista todas las llaves foráneas hacia `students(id)`
   y falla si alguna tabla no está en la función de traslado. Así, cada fase nueva tiene que sumarla.
7. **Eventos**: `recovery_code_created` y `recovery_code_redeemed` (solo conteos).

### 3.2 Salida del tutor

`TUTOR_LIMITS.maxOutputTokens` pasa de 1 024 a 2 048 (`apps/web/src/lib/tutor-server.ts`). En las evals de la segunda
ronda, 2 de 138 turnos de Sonnet salieron vacíos o cortados porque el razonamiento agotó el límite. El costo solo
sube cuando el modelo de verdad usa más tokens.

### 3.3 `.env.example`

Se sugiere `TUTOR_MAX_MESSAGES_PER_DAY=5`. Es solo documentación: el valor de producción lo cambia el fundador.

## 4. Fase 1 · Racha semanal de dominio

- **Semana cumplida**: al menos `weekly_target` ítems distintos bien resueltos (por defecto 5; el docente puede
  cambiarlo por sección, y si el estudiante está en varias secciones vale el menor).
- **Racha en curso**: semanas cumplidas seguidas, hasta la última semana cerrada, saltando las semanas de
  vacaciones, que ni suman ni rompen. La semana actual suma si ya se cumplió y **nunca rompe la racha mientras no
  termine**.
- **Comodín**: uno por periodo del calendario (§2.6): dos semestres en el oficial, o los periodos que defina la
  institución. Repara la última semana cerrada si no se cumplió y antes había racha (no se acumulan reparaciones
  hacia atrás). Se guarda en `streak_repairs(student_id, week_start, period_key)`, con único
  `(student_id, period_key)`.
- **Récord**: la racha más larga que tuvo. No se pierde nunca.
- **Cálculo**: la racha se calcula desde `attempts` en una función SQL (`streak_status()`) que devuelve racha en
  curso, récord, ejercicios de esta semana, meta, si la semana está en pausa y si hay comodín disponible. No hay
  contadores que se puedan desincronizar. Para que sea rápida: índice `(student_id, created_at) where is_correct`.
- **Si la racha se rompe**: «Tu récord es de 6 semanas. ¡Empecemos una nueva esta semana!». Sin «perdiste»,
  sin cuenta regresiva y sin avisos fuera de la app.
- **Aviso de descanso**: después de **1 hora** de actividad continua en práctica, juegos o tutor (pausas de
  menos de 5 minutos no cortan la sesión), una tarjeta amable: «Llevas un buen rato. Un descanso corto ayuda a
  recordar mejor. Tu progreso queda guardado». Una vez por sesión, sin bloquear nada. Se calcula en el cliente, y
  solo el evento va a `events`.
- **Docente**: puede apagar la racha (`streak_enabled`) y cambiar la meta semanal. Apagada, el estudiante no ve la
  racha, salvo que esté en otra sección que la tenga encendida; el dominio sigue igual. En el panel ve solo datos
  agregados: cuántos cumplieron la meta, cuántos tienen racha y la racha más larga, sin decir de quién es.
- **Eventos**: `streak_week_completed` (lo escribe un trigger al llegar a la meta, una vez por semana),
  `streak_repaired` y `rest_reminder_shown`. `streak_ended` no se registra: la racha se calcula al leerla, así que
  no hay un momento en que «se rompa».

## 5. Fase 2 · Meta colectiva y tabla con apodos

### 5.1 Meta semanal de la sección

«Entre todos dominamos **X** habilidades esta semana». Se calcula sola cada lunes y queda fija para la semana:

- `activos` = estudiantes de la sección con al menos un intento en las últimas 4 semanas (mínimo 1).
- `histórico` = mediana semanal de habilidades dominadas por la sección en las últimas 4 semanas sin vacaciones.
- Sin historia: `X = max(3, ceil(0,5 × activos))`. Con historia: `X = max(3, ceil(1,1 × histórico))`. La meta queda
  un poco por encima de lo que la sección ya logra, así que se ajusta sola al tamaño y al nivel de la sección.
- Se guarda en `section_goals(section_id, week_start, target, created_at)`, y el progreso se calcula desde
  `mastery_weekly`.

### 5.2 Apodos

- Lista segura y fija en el código: un sustantivo de la fauna o flora de Costa Rica más un adjetivo invariable, que
  no tiene género («Tucán Azul», «Ceiba Valiente», «Colibrí Veloz», «Perezoso Alegre»). Unas 40 × 15 = 600
  combinaciones, revisadas por personas, sin palabras que se presten a burla.
- El estudiante elige entre 6 opciones al azar. El apodo es único dentro de la sección y se guarda en
  `section_members.nickname` (con `nickname` + `section_id` único).
- `section_members.leaderboard_hidden boolean default false`: puede ocultarse cuando quiera.

### 5.3 Tabla de la semana

- Ordena por **mejora personal de la semana** (Σ de `score_end` − `score_start`), no por puntaje absoluto: alguien
  que empieza abajo puede estar arriba.
- Cada estudiante ve **su fila, hasta 2 compañeros arriba y hasta 2 abajo**, sin números de posición y sin la lista
  completa.
- Para no señalar a nadie como último, quedan fuera de la tabla el último lugar y los estudiantes sin mejora o con
  mejora negativa. Si el propio estudiante es el último, solo ve su fila y los de arriba, sin ninguna marca de
  posición.
- Se sirve con una función `security definer` que devuelve solo apodo, mejora redondeada y si es la fila propia.
  Nunca devuelve `display_name` ni `student_id`.
- **Docente**: ve el progreso de la meta y cuántos estudiantes participan. Puede apagar la tabla y la meta por
  separado.

## 6. Fase 3 · Minijuegos con contenido verificado

### 6.1 Mecánicas fijas

El código de las mecánicas lo escriben y lo revisan personas. La IA **no genera código**: solo el contenido de cada
mecánica.

| Mecánica | Contenido (JSON) | Cómo se corrige |
|---|---|---|
| `pairs` (parejas) | 4–6 pares `{izquierda, derecha}` | Cada par bien unido es un acierto |
| `order` (ordenar pasos) | 3–6 pasos en orden correcto | Orden exacto |
| `fill` (completar) | Enunciado con un hueco y 4 opciones | Opción correcta |
| `find_error` (encuentra el error) | 3–6 pasos o un texto, con un error marcado y su corrección | El paso o la palabra con error |
| `ghost_race` (carrera contra el fantasma) | Sin contenido nuevo: usa ítems verificados de la unidad | Igual que la práctica |

- **Carrera contra el fantasma**: el rival es el propio récord del estudiante en esa unidad o el de un compañero
  anónimo de nivel parecido. Gana quien **acierta más** de 8 preguntas; el tiempo no cuenta.

### 6.2 Dónde se guarda

Cada pieza de juego es un **ítem** con un tipo nuevo (`item_kind`: `game_pairs`, `game_order`, `game_fill`,
`game_find_error`) y una columna `game_content jsonb`. Así se reutiliza todo lo que ya existe:

- `skill_ids`, estado, verificación, «Generado con IA · pendiente de revisión», reportes de error y `/revisar`;
- `submit_attempt` corrige en el servidor según el tipo; la clave de respuesta nunca llega al navegador antes de
  responder (mismas reglas de columnas que `correct_index`);
- los intentos llevan `context = 'game'` y actualizan `mastery` y `mastery_weekly`.

### 6.3 Generación y verificación

- `MODEL_BULK` genera el contenido por habilidad, con un esquema `zod` por mecánica (`generateStructured`).
- Verificación igual que los ejercicios: `MODEL_VERIFY` resuelve sin ver la respuesta y, si hay cálculo, `mathjs`
  recalcula. Si no coinciden, queda en borrador y no se publica.
- Solo entra lo verificado, como `published` con la etiqueta «Generado con IA · pendiente de revisión» y el botón
  de reportar error.
- **Alcance inicial**: las 96 unidades publicadas de Español y Matemáticas de 7.º a 9.º.
- **Costo**: antes de generar se muestra la estimación (`--dry-run`). Si pasa de US$10, se pregunta al fundador.

## 7. Fase 4 · Torneo de los viernes

- **Se arma solo**, por sección, sin cron nuevo (no se toca la configuración de Vercel): la primera visita del
  viernes a la vista de la sección (estudiante o docente) llama a `ensure_tournament(section, week)`, que es
  idempotente. Abre el viernes a las 00:00 y cierra el domingo a las 23:59, hora de Costa Rica.
- **Temas**: las habilidades que la sección trabajó esa semana (las de `mastery_weekly` de sus miembros, con
  intentos). Si no hubo actividad, no hay torneo esa semana y no se muestra nada.
- **Equipos**: entre 3 y 5 integrantes, mezclados y balanceados por dominio actual con un reparto en serpiente
  (1-2-3-3-2-1…) sobre el dominio medio de los temas. Los nombres de equipo salen de la misma lista segura
  («Equipo Ceiba»). Solo participan los activos de las últimas 4 semanas; quien llega tarde se suma al equipo con
  menos integrantes.
- **Puntos**: 1 por acierto en ítems del torneo (máximo 10 que cuenten por estudiante, para que nadie cargue con
  todo el equipo) + 1 por cada 0,05 de mejora en los temas del torneo frente a la semana anterior. **Nunca por
  velocidad.** El puntaje del equipo es el promedio por integrante, para no favorecer a los equipos grandes.
- **Resultados**: el estudiante ve el puntaje de su equipo y los equipos por encima del último. El panel docente
  muestra todos los equipos y lo que aportó cada estudiante al dominio, no a la competencia. El docente no
  prepara nada y no tiene que usarlo en clase.
- Tablas: `tournaments`, `tournament_teams`, `tournament_members`.

## 8. Fase 5 · Reconocimiento simbólico

- **Insignias** (`student_badges(student_id, badge, ref_id, earned_at)`): habilidad dominada, unidad dominada (todas
  sus habilidades ≥ 0,70), primera semana cumplida, récord de racha 4, 8 y 12. Solo por dominio. No se pierden aunque
  el dominio baje después.
- **Certificado de dominio por unidad**: una página imprimible y descargable en PDF desde el navegador, con la unidad,
  sus habilidades, la fecha y un código de verificación. **No guarda el nombre**: el estudiante lo escribe al
  descargarlo y queda solo en su dispositivo. Nunca llega al servidor ni a la IA.
- **Equipo ganador del torneo**: destacado en el panel y en la vista de la sección hasta el siguiente torneo. Sin
  premios en dinero ni objetos.

## 9. Seguridad (RLS) en todas las fases

- El estudiante solo lee lo suyo. De su sección solo ve apodos y valores agregados, siempre a través de funciones
  `security definer` que nunca devuelven nombres ni ids de compañeros.
- El docente solo lee las secciones que son suyas (`private.owns_section`), y solo ahí cambia `section_settings` y
  los calendarios propios.
- Nada se escribe directo en tablas de juego, racha o torneo: todo pasa por funciones que validan.
- Cada fase agrega pruebas de RLS al archivo `supabase/tests/rls.test.ts`, que intentan romper estas reglas, y
  pruebas unitarias de la lógica en TypeScript.

## 10. Demo y celular

- `/docente/demo` se amplía en cada fase con datos ficticios: racha, meta, tabla, juegos y torneo. Siempre se
  etiqueta como demostración.
- Todo se diseña primero para celular: objetivos táctiles de 44 px, sin desplazamiento horizontal y
  arrastrar-y-soltar con alternativa de tocar para las mecánicas de juego.

## 11. Decisiones del fundador

Resueltas el 3 de noviembre de 2026:

1. **Comodín por periodo**: dos semestres por defecto, editables por institución (por ejemplo, 3 trimestres).
2. **Calendario de la institución**: cada institución tiene un id en la base de datos y su propio calendario (§2.6).
3. **Aviso de descanso**: después de 1 hora.
4. **Ítems sin verificar en la racha**: cuentan, igual que en la práctica de hoy.
