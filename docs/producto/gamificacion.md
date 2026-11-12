# Eduka v2 · Gamificación y funciones para colegios

Diseño de la rama `producto/eduka-v2`. Todo lo nuevo va en una rama nueva que sale de `producto/eduka-v2` y vuelve a
ella con un PR. Nada pasa a `main` sin aprobación del fundador.

| Fase | Rama | Qué entrega |
|---|---|---|
| 0 | `producto/fase-0-requisitos` | Este documento, código personal de recuperación, salida del tutor a 2 048 tokens, `.env.example` |
| 1 | `fase-1` | Racha semanal de dominio, calendario escolar, comodín, aviso de descanso |
| 2 | `fase-2` | Meta colectiva semanal y tabla con apodos |
| — | `secciones-por-materia` | Grupos con un código, docente = materia, guía = grupo (§12) |
| — | `panel-docente-grupos` | «Mis secciones»: los grupos del docente lado a lado, por materia (§12) |
| 3 | `fase-3` | Mecánicas fijas con contenido generado y verificado |
| 4 | `fase-4` | Torneo automático de los viernes |
| 5 | `fase-5` | Insignias, certificado de dominio y equipo destacado |

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
- **Corrección en la Fase 2**: `week_paused_for_section` daba «vacaciones» a toda sección en un año sin calendario
  (2026), así que el panel docente decía «las rachas están en pausa». Ahora un año sin calendario no pausa, igual que
  para cada estudiante (la racha de los estudiantes no estaba afectada).
- **Eventos**: `streak_week_completed` (lo escribe un trigger al llegar a la meta, una vez por semana),
  `streak_repaired` y `rest_reminder_shown`. `streak_ended` no se registra: la racha se calcula al leerla, así que
  no hay un momento en que «se rompa».

## 5. Fase 2 · Meta colectiva y tabla con apodos

**Qué cubre una sección.** Todo lo de esta fase (meta, tabla y mejora) cuenta solo las habilidades que «cubre» la
sección, y eso sale de una sola función: `private.section_scope_skills(section)`. Hoy son todas las habilidades del
grado de la sección. Con secciones por materia (§12) basta con cambiar esa función.

### 5.1 Meta semanal de la sección

«Entre todos: **X** habilidades dominadas esta semana». Se calcula la primera vez que alguien la pide en la semana
(estudiante o docente, sin cron) y queda fija hasta el domingo:

- **Habilidad dominada en la semana**: un estudiante de la sección pasa una habilidad de la sección de menos de 0,70
  a 0,70 o más (`mastery_weekly`, §2.3). Cuenta una vez por estudiante y habilidad.
- `activos` = estudiantes de la sección con al menos un intento en las últimas 4 semanas (mínimo 1).
- `histórico` = habilidades dominadas por la sección en cada una de las últimas 4 semanas de clases (sin vacaciones,
  mirando hasta 12 semanas atrás).
- Si el histórico es todo cero: `X = max(3, ceil(0,5 × activos))`. Si no: `X = max(3, ceil(1,1 × mediana))`. La meta
  queda un poco por encima de lo que la sección ya logra, así que se ajusta sola a su tamaño y su nivel.
- Se guarda en `section_goals(section_id, week_start, target, active_students, history)`. El panel docente lo explica
  en «Cómo se calculó». La misma regla está en `goalTarget()` de `@edukemonos/curriculum`, y una prueba compara las dos.

### 5.2 Apodos

- **Uno por estudiante para todo Eduka, no uno por sección.** Si en el futuro un estudiante está en varias secciones
  (una por materia, §12), elige su apodo una sola vez.
- **Formato**: sustantivo de la naturaleza de Costa Rica + adjetivo sin género + número de 10 a 99 («Tucán Azul 27»).
  Son 40 × 18 × 90 = 64 800 apodos, únicos en todo Eduka. Las listas son fijas y revisadas, sin palabras que se
  presten a burla (por eso no hay «Perezoso» ni «Mono»). Están en SQL y en TypeScript, y una prueba verifica que
  coinciden.
- El estudiante elige entre 6 opciones libres al azar (`nickname_options()`), y `choose_nickname()` rechaza todo lo
  que no esté en la lista. Un `check` de la tabla también lo impide. Nadie escribe la columna directamente: el
  `insert` en `students` quedó limitado a `id` y `declared_grade_id`.
- `students.leaderboard_hidden`: el estudiante puede ocultarse cuando quiera, en todas sus secciones.
- El docente puede leer el apodo de sus estudiantes (la tabla `students` ya era visible para él). La clase solo ve
  apodos.

### 5.3 Tabla de la semana

- Ordena por **mejora personal de la semana** (Σ de `score_end` − `score_start` en las habilidades de la sección), no
  por puntaje absoluto: alguien que empieza abajo puede estar arriba. Se muestra en puntos (× 100).
- Cada estudiante ve **su fila, hasta 2 compañeros arriba y hasta 2 abajo**, sin números de posición y sin la lista
  completa.
- Quedan fuera los estudiantes sin apodo, ocultos o sin mejora. **El último lugar nunca se muestra a otros.** Si el
  propio estudiante es el último, ve su fila y los de arriba, sin ninguna marca de posición.
- **Con menos de 4 estudiantes en la tabla no se muestra nada**, para que nadie quede identificado.
- `section_leaderboard()` devuelve solo apodo, puntos y si es la fila propia: nunca `display_name` ni `student_id`.
  Solo la pueden pedir los estudiantes de la sección. La misma regla está en `leaderboardWindow()`, y una prueba
  compara las dos.
- **Docente**: ve el avance de la meta, «Cómo se calculó» y cuántos eligieron apodo o se ocultaron, nunca el orden.
  Puede apagar la meta y la tabla por separado.
- **Eventos**: `nickname_chosen` (sin el apodo) y `leaderboard_hidden` (`{hidden}`).

## 6. Fase 3 · Minijuegos con contenido verificado

### 6.1 Mecánicas fijas

El código de las mecánicas lo escriben y lo revisan personas (`apps/web/src/app/unidad/[id]/games.tsx`). La IA **no
genera código**: solo el contenido de cada pieza, que pasa las mismas verificaciones que los ejercicios.

| Mecánica | Contenido | Cómo se juega en el celular | Cómo se corrige |
|---|---|---|---|
| `pairs` (parejas) | 4–6 parejas `{left, right}` | Por cada elemento, se toca la letra de su pareja (sin arrastrar) | Todas las parejas bien |
| `order` (ordenar pasos) | 3–6 pasos en orden | Botones de subir y bajar, de 44 px | Orden exacto |
| `fill` (completar) | Enunciado con «___» y 4 opciones | Opciones como en la práctica | Opción correcta |
| `find_error` (encuentra el error) | 3–6 pasos o frases, uno con error, y su corrección | Se toca el paso | El paso con error |
| `ghost_race` (carrera contra el fantasma) | Sin contenido propio | Preguntas de opción, con dos barras de avance | Igual que la práctica |

- **Una partida** son 3 piezas de una mecánica (primero las que el estudiante todavía no resolvió bien), o hasta 8
  preguntas en la carrera.
- **Carrera contra el fantasma**: usa ejercicios verificados y piezas de «completar» de la unidad (hay unidades con
  menos de 8 ejercicios, por eso se suman). El fantasma son las respuestas, acertadas o no, de la **mejor carrera
  propia** en la unidad. La primera vez es la carrera de **un compañero de la misma sección con un dominio parecido**
  en la unidad. Si no hay ninguno, el estudiante marca su récord. Del compañero solo llega la secuencia de aciertos,
  nunca quién es.
- **Nada premia la velocidad**: no hay reloj en ningún juego. La carrera avanza pregunta a pregunta y gana quien
  acierta más. Si gana el fantasma: «Esta vez el fantasma acertó más. Cada intento suma a tu dominio».

### 6.2 Dónde se guarda

- Cada pieza es un **ítem** de tipo `game_pairs`, `game_order`, `game_fill` o `game_find_error`. Lo que se le muestra
  al estudiante (barajado, sin respuesta) va en `items.game_public`, que es legible como el resto del ítem. La
  respuesta va en `items.game_answer`, que **no se puede leer por la API**.
- Así se reutiliza lo que ya existe: habilidades, estado, verificación, «Generado con IA · pendiente de revisión» y
  el botón de reportar error. En `/revisar` las piezas aparecen contadas aparte; su revisión detallada queda para más
  adelante.
- **Partidas** (`game_runs`): `start_game_run()` elige las piezas y el fantasma, `submit_attempt()` corrige cada
  respuesta en la base de datos (contexto `game`, solo piezas de una partida abierta del propio estudiante y una vez
  cada una) y `finish_game_run()` calcula el resultado **con las respuestas guardadas**, no con lo que diga el
  navegador. Las partidas son privadas del estudiante.
- Las respuestas cuentan para `mastery` y `mastery_weekly` igual que la práctica, así que suman a la racha, la meta y
  la tabla. Las piezas de juego nunca entran al diagnóstico.
- **Panel docente**: «Ejercicios esta semana» dice de dónde vino cada respuesta («práctica 120 · juegos 30 ·
  diagnóstico 10»), y la línea de tiempo de cada estudiante separa práctica, juegos, diagnóstico y torneo.
- **Docente**: puede apagar los juegos (`section_settings.games_enabled`). Como con la racha, se ocultan solo si
  todas las secciones del estudiante los apagaron.
- **Migraciones**: `20261106000100_game_enums.sql` va aparte y primero, porque Postgres no deja usar un valor nuevo de
  un enum en la misma transacción que lo crea. Después va `20261106000200_games.sql`.
- **Código de recuperación**: desde esta fase, las tablas nuevas se trasladan en `private.move_student_extras()`, así
  que no hace falta reescribir `redeem_recovery_code()` en cada fase.

### 6.3 Generación y verificación

- `pnpm games generate|load|publish|status|archive` (`scripts/ingest/src/games-cli.ts`). Sin `--yes` solo muestra
  la estimación. `status`, `archive` y `load` vuelven a correr las verificaciones fijas (gratis), así que un ajuste
  de las comprobaciones no obliga a pagar de nuevo. Lo generado queda versionado en
  `scripts/ingest/generated/games/<unidad>.json`.
- `MODEL_BULK` escribe, por unidad, hasta una pieza de cada mecánica por habilidad (solo las que encajan con la
  habilidad), con un esquema plano y comprobaciones de forma en código.
- **Verificación**:
  - `MODEL_VERIFY` resuelve las piezas **barajadas y sin respuesta**, con esfuerzo `high`, y tiene que coincidir sin
    señalar problemas.
  - mathjs recalcula las piezas de «completar» con cálculo (`calc`), las parejas de operación y resultado, y los pasos
    numéricos de «encuentra el error». Lee la notación escolar: igualdades encadenadas, superíndices (también
    `10⁻³`), `gcd(42,56)` con la coma como separador, fracciones alrededor de `÷` (`3/5 ÷ 3/10 = 2`) y raíces
    redondeadas a las cifras que muestran (`√10 ≈ 3,16`). Un paso con unidades distintas a cada lado no se compara.
  - Lo que no pasa queda en borrador.
- Solo se publica lo verificado, con «Generado con IA · pendiente de revisión».
- **Alcance**: las 96 unidades publicadas de Español y Matemáticas de 7.º a 9.º (297 habilidades). Estimación
  previa: US$6,39. Piloto de 2 unidades: US$0,105.
- **Resultado** (noviembre de 2026): 953 piezas, **803 verificadas (84 %)**. Por mecánica: parejas 201/223,
  completar 294/331, encuentra el error 195/244, ordenar 113/155. Lo no verificado: el verificador señaló algo (116),
  dio otra respuesta (25) u opciones repetidas (9). **Costo real: US$7,21** (192 llamadas, ninguna falló; la salida
  fue más larga que lo estimado).
- **Pendiente**: el verificador escribe comentarios en `problems` aun cuando no encuentra fallas («Sin problemas»,
  «Solo la 3 es correcta»), y la política conservadora los cuenta como objeción. Una versión 2 del prompt de
  resolución con un campo aparte para notas recuperaría parte de esas piezas (≈ US$1,10 por volver a resolver todo).

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

## 12. Grupos y una sección por materia

Idea del fundador (4 nov), con sus decisiones del 5 nov. Va en la rama `secciones-por-materia`, antes de la Fase 3.

| Papel | Qué es | Qué ve |
|---|---|---|
| **Grupo** | El 7-3 de la institución, con **un solo código** | — |
| **Docente = materia** | Una sección con materia dentro del grupo | Solo el avance de **su materia** |
| **Guía = grupo** | Opcional, una persona por grupo | El rendimiento de **todos los estudiantes del grupo en todas las materias** |
| **Estudiante** | Miembro del grupo | Su grupo y las materias que le tocan |

«Guía = grado» se interpretó como el grupo (7-3), que es como funciona el profesor guía en Costa Rica. Si en algún
colegio la guía debe ver todos los 7.º de la institución, es una extensión pequeña: una guía por nivel en vez de por
grupo.

### Modelo de datos

- `groups(id, name, grade_id, institution_id, guide_id, created_by, join_code, active)` y
  `group_members(group_id, student_id, display_name, consent_at)`.
- `sections.subject_id` y `sections.group_id`: una sección de un grupo **siempre** tiene materia, y hay una sola por
  materia en cada grupo. El grado y la institución vienen del grupo.
- **Las secciones sin materia** (las de antes, o una sección suelta) **siguen como antes**: su docente ve todas las
  materias de sus estudiantes. No se migró nada.
- **Membresías materializadas**: al unirse al grupo, el estudiante queda en `section_members` de cada materia del
  grupo, y una materia agregada después incluye sola a los estudiantes del grupo. Así funcionan sin cambios el panel,
  la racha, la meta y la tabla.

### Un solo código

- `join_with_code()` acepta el código del grupo (entra a todas sus materias), el de una sección de un grupo (entra al
  grupo completo) o el de una sección suelta (como antes). Grupos y secciones comparten el espacio de códigos, así
  que nunca chocan.
- El consentimiento dice que cada docente ve su materia y la persona guía, todas.

### Privacidad por materia (la parte delicada)

- Cada fila de `attempts`, `mastery`, `mastery_weekly`, `tutor_sessions` y `writing_feedback` guarda su materia (la
  llena un trigger; los datos anteriores se completaron en la migración). `diagnostics` ya la tenía.
- Sus políticas pasan de «enseña a este estudiante» a `private.can_see_student_subject(student, subject)`: el docente
  de una sección con esa materia (o sin materia) o la persona guía del grupo. Un tema del tutor fuera de una unidad (sin
  materia) solo lo ven las vistas de todo el estudiante.
- El panel de una sección de materia también filtra por materia en las consultas, para que quien sea guía y docente
  vea en su sección solo esa materia.
- La meta y la tabla de una sección de materia cuentan solo esa materia (`section_scope_skills`). **La racha sigue
  siendo del estudiante** y cuenta todas sus materias; el panel de cada docente la muestra igual.

### Quién hace qué

- **Crear un grupo**: con institución, quien la administra; sin institución, cualquier docente (grupo suelto).
- **Agregar una materia al grupo**: cualquier docente de la institución del grupo (en un grupo suelto, quien lo creó).
- **Asignar la persona guía**: quien administra el grupo, por correo. En un grupo con institución, la persona guía
  tiene que ser parte de ella.
- **Sacar a un estudiante del grupo** (y de todas sus materias): quien administra el grupo o la persona guía. Un docente
  puede sacarlo solo de su materia, como antes.
- **Pantallas**:
  - `/docente/grupo/[id]`: código, materias con su docente, «Agregar mi materia» y persona guía.
  - `/docente/grupo/[id]/panel`: la vista de la persona guía.
  - `/docente/demo` muestra la sección de Matemáticas de un 7-3 y `/docente/demo/guia` la vista de la persona guía,
    las dos con datos ficticios.

### Un docente en varios grupos

«Docente = materia» no quiere decir una materia en todo el nivel, sino **una sección por cada grupo donde el docente da
su materia**. Quien da Matemáticas solo en 7-1 y 8-3 tiene dos secciones y solo ve esos dos grupos, nunca el 7-2. Una
prueba de RLS lo verifica. También puede dar materias distintas en grupos distintos.

En «Mis secciones» el docente ve sus grupos **lado a lado, ordenados por materia**: estudiantes, activos en 7 días,
dominio, meta de la semana y quiénes podrían necesitar apoyo, con enlace a cada estudiante. Usa los mismos números que el
panel de cada sección (`sectionSnapshot()` sobre `computeSectionMetrics()`). En el total, cada estudiante cuenta una
sola vez aunque esté en dos materias del mismo grupo. La demo está en `/docente/demo/resumen`.

### Efecto en las fases que siguen

- **Fase 3 (minijuegos)**: los juegos se proponen por la materia de cada sección.
- **Fase 4 (torneo)**: se arma por sección de materia, con los temas de esa materia.
- **Fase 5 (reconocimiento)**: el equipo ganador se destaca en la sección de materia. La persona guía ve los de
  todas las materias de su grupo.
