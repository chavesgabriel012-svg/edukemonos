# Consola del equipo Eduka: plan de construcción

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que el equipo de Eduka deje listo un colegio sin SQL ni terminal (colegio, materias aprobadas por
la coordinación, docentes invitados y grupos con código) y que solo usen Eduka las personas de un colegio.

**Architecture:**
- **Base de datos.** Las reglas de acceso y las escrituras van en Supabase: tablas nuevas con RLS y
  funciones `security definer` en `public`/`private`.
- **Reglas en TypeScript.** El filtro de lo que ve cada estudiante y el análisis de la lista de
  invitados viven en `packages/curriculum/src/institutions.ts`.
- **Web.** La app (Next.js 16) suma la consola `/admin` y amplía la página de coordinación
  `/docente/institucion/[id]`. El lado del estudiante y el del docente filtran según el colegio.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres 16, RLS, Auth), Tailwind v4, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-19-consola-admin-design.md`. Léala completa antes de empezar.

## Global Constraints

- **Lecturas obligatorias.** Antes de tocar `apps/web`, lea `apps/web/AGENTS.md` y la guía que
  corresponda en `apps/web/node_modules/next/dist/docs/`. Lea también `CLAUDE.md` y
  `docs/producto/competencia.md`.
- **Migraciones.** Cada una debe correr sola, pegada en el editor SQL de Supabase, como una
  transacción. Los estados son `text` con `check`, no enums.
- **Valores exactos.**
  - `institutions.status`: `preparando` (por defecto), `activo` o `pausado`.
  - `institution_offerings.status`: `pendiente` (por defecto), `aprobado` o `retirado`.
- **Hora y umbrales.**
  - Los meses y las semanas se cuentan en hora de Costa Rica (UTC−6, sin horario de verano). Las
    semanas van de lunes a domingo.
  - El gasto de IA se marca en amarillo desde el 80 % del presupuesto y en rojo desde el 100 %.
    **Nunca** corta a Kemo.
  - En la demostración, Kemo responde como máximo 10 mensajes por día (`DEMO_TUTOR_PER_DAY = 10`).
- **Privacidad.** La consola muestra solo cifras agregadas por colegio. Nunca muestra nombres de
  estudiantes, lo que escriben al tutor ni datos de un estudiante en particular. El docente nunca ve
  conversaciones.
- **Acceso a `/admin`.** Para quien no tiene `profiles.role = 'admin'`, responde `notFound()`, aunque
  no haya iniciado sesión.
- **Aprobación.** La aprueba solo quien tiene `institution_members.role = 'admin'` en ese colegio.
  El equipo Eduka no aprueba en nombre del colegio.
- **Textos exactos.** Usted con docentes y colegio, tú con estudiantes:
  - Docente sin colegio: «Su colegio todavía no le dio acceso a Eduka. Si ya debería tenerlo, pídale a la coordinación que lo invite.»
  - Colegio sin materias aprobadas: «Su colegio está terminando de preparar Eduka.»
  - Aviso de demostración: «Estás en la demostración de Eduka. Lo que hagas aquí no le llega a ningún docente.»
  - Código de un colegio que no está activo: «Tu colegio todavía no abre Eduka para estudiantes. Pregúntale a tu docente.»
  - Tema no visible para Kemo: «Este tema no está disponible en tu colegio.»
  - Aviso de temas nuevos: «{n} temas nuevos en {grado}.º {Materia} desde su última revisión» (con
    1: «1 tema nuevo…»).
- **Producción.** Nunca se crean datos de prueba en el Supabase de producción. Las pruebas de punta
  a punta corren con `e2e/setup.sh`.
- **Antes de cada commit**, deben pasar:
  - en `apps/web`: `pnpm -s typecheck`, `pnpm -s lint` y `pnpm -s test`;
  - si tocó SQL: `pnpm test:rls`;
  - si tocó `packages/curriculum`: `pnpm --filter @edukemonos/curriculum test`.

## Review Focus

Casos que la especificación implica, que ninguna prueba de las tareas cubre por sí sola, y dónde
queda la prueba de cada uno:

1. **Correo con mayúsculas o espacios.** Si se invita a «Ana@Colegio.cr » y la persona entra con
   «ana@colegio.cr», queda vinculada igual. Prueba en la tarea 4.
2. **Persona en dos colegios.** Un estudiante en grupos de dos colegios, o un docente invitado por
   dos, ve el catálogo del colegio más reciente, y su gasto de IA se le asigna a ese colegio. Pruebas
   en las tareas 1 y 3.
3. **Lista pegada desde Excel.** Puede venir separada por tabulaciones, con fila de encabezado,
   líneas vacías o roles con tilde y mayúsculas («Coordinación»). Se entiende sin errores falsos.
   Prueba en la tarea 2.
4. **Quitar a un docente que es guía de un grupo.** Deja de ser guía, y sus secciones pasan al
   reemplazo elegido. Prueba en la tarea 4.
5. **Tema oculto en una materia que se retira y se vuelve a aprobar.** Sigue oculto. Una materia
   que el colegio no ofrece nunca aparece, aunque el equipo publique temas en ella. Prueba en la
   tarea 3.

---

## Archivos

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/20261120000100_school_console_schema.sql` | Tablas, columnas, triggers y políticas nuevas (tarea 1) |
| `supabase/migrations/20261120000200_school_program.sql` | Programa, aprobación, catálogo, resúmenes de la consola (tarea 3) |
| `supabase/migrations/20261120000300_school_people.sql` | Invitaciones, miembros, reemplazos (tarea 4) |
| `supabase/migrations/20261120000400_school_access.sql` | Secciones, grupos y códigos solo dentro de un colegio (tarea 5) |
| `supabase/tests/rls.test.ts`, `supabase/tests/fixtures.ts` | Pruebas de todo lo anterior |
| `packages/curriculum/src/institutions.ts` (+ `index.ts`) | Catálogo visible, lista de invitados, lista de lo que falta, nivel de gasto (tarea 2) |
| `apps/web/src/lib/staff.ts` | `requireAdmin()` |
| `apps/web/src/lib/catalog.ts` | `myCatalog()` |
| `apps/web/src/lib/invites.ts` | Envío de invitaciones por correo |
| `apps/web/src/app/auth/confirm/route.ts` | Reclama invitaciones al entrar |
| `apps/web/src/app/(app)/docente/institucion/actions.ts` | Acciones de servidor de colegio, compartidas por la coordinación y la consola |
| `apps/web/src/components/school/*.tsx` | Paneles de programa, personas y reasignación, compartidos |
| `apps/web/src/app/(app)/admin/**` | La consola |
| `e2e/consola.spec.ts` | El recorrido completo de punta a punta |

---

### Task 1: Esquema de colegios, gasto por colegio y separación del contenido

**Files:**
- Create: `supabase/migrations/20261120000100_school_console_schema.sql`
- Modify: `supabase/tests/rls.test.ts`, `supabase/tests/fixtures.ts`

**Interfaces:**
- Produces (tablas y columnas):
  - **`institutions`**:
    - `status text not null default 'preparando'`;
    - `ai_monthly_budget_usd numeric check (>= 0)`, que admite nulo;
    - `language text not null default 'es' check (language ~ '^[a-z]{2}$')`.
  - **`institution_offerings`**:
    - columnas `(institution_id, grade_id smallint, subject_id text, status text default 'pendiente', approved_by uuid, approved_at timestamptz, seen_through timestamptz, created_at)`;
    - llave primaria `(institution_id, grade_id, subject_id)`.
  - **`institution_hidden_units`**:
    - columnas `(institution_id, unit_id, hidden_by, hidden_at)`;
    - llave primaria `(institution_id, unit_id)`.
  - **`institution_invites`**:
    - columnas `(id uuid pk, institution_id, email text, display_name text, role institution_role default 'teacher', invited_by, invited_at, accepted_profile_id, accepted_at, revoked_at)`;
    - `check (email = lower(btrim(email)))`;
    - índice único `(institution_id, email) where revoked_at is null`.
  - **`curriculum_units.published_at timestamptz`**, que pone el trigger `private.set_unit_published_at()`.
  - **`curriculum_sources.institution_id uuid null`**: nulo significa el catálogo común.
  - **`ai_usage.institution_id uuid`**, que llena el trigger `private.ai_usage_institution()`.
  - **`admin_audit_log`**: columnas `(id bigint identity, actor_id uuid, institution_id uuid, action text, detail jsonb, created_at)`.
- Produces (funciones):
  - `private.student_institution(p_student uuid) returns uuid`: la del grupo o sección al que se
    unió más recientemente.
  - `private.person_institution(p_uid uuid) returns uuid`: primero la de estudiante; si no, la
    membresía de colegio más reciente.
  - `private.is_school_coordinator(p_institution uuid) returns boolean`: hay una fila en
    `institution_members` con `profile_id = auth.uid()` y `role = 'admin'`. **No** cuenta a los
    administradores de la plataforma.
  - `private.can_read_source(p_source uuid) returns boolean`: es verdadera si la fuente es común, si
    la persona es miembro del colegio de la fuente, si es estudiante de ese colegio o si es revisora.

- [ ] **Step 1: Write the failing tests in `rls.test.ts`**, in a new block `describe("school console schema")`:
  - `it("has RLS on every new table and no direct grants")`: para `institution_offerings`,
    `institution_hidden_units`, `institution_invites` y `admin_audit_log`, `relrowsecurity` es
    verdadero, y anon y authenticated no pueden hacer `insert`.
  - `it("stamps published_at when a unit is published")`: se pasa una unidad borrador a `published`,
    `published_at` queda con valor, y un segundo `update` del título no lo cambia.
  - `it("hides a school's own source from everyone outside it")`:
    - se crea una fuente con `institution_id` del colegio A y una unidad publicada en ella;
    - un estudiante del colegio B y anon ven 0 filas;
    - un estudiante del colegio A ve 1 fila, y lo mismo para `materials` e `items` de esa unidad.
  - `it("attributes AI usage to the student's most recent school")`: un estudiante en grupos de A
    (antes) y de B (después) inserta en `ai_usage` con `actor_id` y queda `institution_id = B`.
  - `it("admin_audit_log is readable by platform admins only")`.
  - En `fixtures.ts`, agregue dos colegios (`ids.schoolA`, `ids.schoolB`), un grupo activo en cada
    uno y una coordinadora de A (`ids.coordA`).

- [ ] **Step 2: Run** `pnpm test:rls`. Esperado: FAIL, porque las tablas y columnas no existen.

- [ ] **Step 3: Escriba la migración.** Detalles que la prueba no fija:
  - Rellene `published_at = coalesce(reviewed_at, updated_at)` para los temas ya publicados.
  - Las políticas `units_read_published`, `materials_read` e `items_read` se reemplazan, agregando
    `and private.can_read_source(<source de la unidad>)`.
  - Lectura de las tablas nuevas:
    - `institution_offerings` e `institution_hidden_units`: los miembros del colegio y
      `private.is_admin()`;
    - `institution_invites`: `private.is_school_coordinator()` o `private.is_admin()`;
    - `admin_audit_log`: solo `private.is_admin()`.
  - En `ai_usage_institution()`, si `section_id` viene con valor, gana el colegio de esa sección.

- [ ] **Step 4: Run** `pnpm test:rls`. Esperado: todo PASS.

- [ ] **Step 5: Commit** — `feat(db): schools get status, offerings, invites and AI spend; a school's own content stays inside it`

---

### Task 2: Reglas de colegio en TypeScript

**Files:**
- Create: `packages/curriculum/src/institutions.ts`, `packages/curriculum/test/institutions.test.ts`
- Modify: `packages/curriculum/src/index.ts` (exportar)

**Interfaces:**
- Produces:
  ```ts
  export type InstitutionStatus = "preparando" | "activo" | "pausado";
  export type OfferingStatus = "pendiente" | "aprobado" | "retirado";
  export interface Catalog { institutionId: string | null; status: InstitutionStatus | null; offerings: { gradeId: number; subjectId: string }[]; hiddenUnitIds: string[] }
  export const DEMO_CATALOG: Catalog; // institutionId null, status null, [] y []
  export function isDemo(c: Catalog): boolean;
  export function subjectVisible(c: Catalog, gradeId: number, subjectId: string): boolean; // demo → true
  export function unitVisible(c: Catalog, unit: { id: string; gradeId: number; subjectId: string }): boolean;
  export function visibleGrades(c: Catalog, all: readonly number[]): number[];
  export interface InvitePerson { email: string; name: string; role: "teacher" | "admin" }
  export function parseInviteList(text: string): { people: InvitePerson[]; errors: { line: number; text: string; reason: "email" | "name" | "role" }[]; duplicates: string[] };
  export type SpendLevel = "ok" | "warn" | "over";
  export function spendLevel(spentUsd: number, budgetUsd: number | null): SpendLevel; // null → "ok"; ≥80 % warn; ≥100 % over
  export interface SchoolChecklistInput { approvedOfferings: number; coordinatorsActive: number; invitesAccepted: number; invitesPending: number; groups: number; smtpReady: boolean }
  export function schoolChecklist(x: SchoolChecklistInput): { key: "program" | "coordination" | "teachers" | "groups" | "email"; done: boolean; label: string }[];
  ```

- [ ] **Step 1: Write the failing tests** in `institutions.test.ts`:
  - **Visibilidad:**
    - `unitVisible(DEMO_CATALOG, u)` es `true`.
    - Con `offerings=[{gradeId:7,subjectId:"matematicas"}]`:
      - 7.º Matemáticas es `true`;
      - 8.º Matemáticas es `false`;
      - 7.º Matemáticas con su id en `hiddenUnitIds` es `false`.
    - `visibleGrades(c, [7,8,9])` da `[7]`.
  - **`parseInviteList` con separadores y líneas sobrantes.** Con `"correo\tnombre\trol\nAna@Colegio.cr \tAna Mora\tCoordinación\n\nluis@colegio.cr, Luis Rojas\n"`:
    - `people` queda `[{email:"ana@colegio.cr",name:"Ana Mora",role:"admin"},{email:"luis@colegio.cr",name:"Luis Rojas",role:"teacher"}]`;
    - `errors` queda `[]`.
  - **`parseInviteList` con problemas.** `"no-es-correo, X\nana@c.cr, Ana\nANA@c.cr; Ana B; docente\nbeto@c.cr, Beto, rector"`:
    - `errors` es `[{line:1,…,reason:"email"},{line:4,…,reason:"role"}]`;
    - `duplicates` es `["ana@c.cr"]`;
    - `people` tiene solo la primera fila de Ana.
  - **Roles aceptados:**
    - «docente», «profesor», «profesora» y «teacher» dan `teacher`;
    - «coordinación», «coordinacion», «coordinador», «coordinadora» y «admin» dan `admin`;
    - sin tildes ni mayúsculas, el resultado es el mismo.
  - **`spendLevel`:** `(10,null)` da "ok", `(31.9,40)` da "ok", `(32,40)` da "warn" y `(40,40)` da
    "over".
  - **`schoolChecklist`:**
    - con todo en cero, son 5 ítems sin hacer;
    - `teachers` queda hecho solo si `invitesAccepted > 0` y `invitesPending === 0`;
    - `email` queda hecho solo si `smtpReady` es verdadero.

- [ ] **Step 2: Run** `pnpm --filter @edukemonos/curriculum test`. Esperado: FAIL, porque el módulo
  no existe.

- [ ] **Step 3: Implemente `institutions.ts`.**
  - Separadores de columnas: tabulación, `;` o `,`.
  - Se ignoran las líneas vacías y la primera línea si contiene «correo» o «email».
  - Validación de correo: `/^[^@\s]+@[^@\s]+\.[^@\s]+$/`.
  - El nombre debe tener entre 1 y 80 caracteres después de `trim`.
  - Etiquetas en español para la lista de lo que falta:
    - «Programa aprobado por el colegio»;
    - «Coordinación con acceso»;
    - «Docentes invitados y con acceso»;
    - «Grupos con código»;
    - «Correo propio configurado».

- [ ] **Step 4: Run** the same tests. Esperado: PASS.

- [ ] **Step 5: Commit** — `feat(curriculum): what a school's students see, the pasted invite list and the go-live checklist`

---

### Task 3: Programa, aprobación, catálogo y resúmenes de la consola (SQL)

**Files:**
- Create: `supabase/migrations/20261120000200_school_program.sql`
- Modify: `supabase/tests/rls.test.ts`

**Interfaces:**
- Consumes: la tarea 1.
- Produces. Todas las funciones son `security definer`, con `search_path = ''`, sin permiso de
  ejecución para anon, y permiso para authenticated:
  - **`admin_upsert_institution(p_id uuid, p_name text, p_slug text, p_status text, p_budget numeric) returns uuid`**:
    - solo `is_admin()`;
    - con `p_id` nulo, crea el colegio;
    - escribe en `admin_audit_log`.
  - **`admin_set_offering(p_institution uuid, p_grade smallint, p_subject text, p_offered boolean) returns void`**:
    - solo `is_admin()`;
    - con `true`, crea la oferta en `pendiente`, o vuelve a dejar `pendiente` una que estaba
      `retirado`;
    - exige al menos un tema publicado de fuente común o del colegio. Si no hay, lanza
      `'no published content'`;
    - con `false`, la borra solo si está `pendiente`. Si está `aprobado`, lanza
      `'approved offerings are withdrawn by the school'`.
  - **`institution_program(p_institution uuid) returns jsonb`**:
    - para la coordinación del colegio o `is_admin()`;
    - devuelve `[{grade_id, subject_id, subject_name, status, approved_at, units:[{id,title,sort_order,source_page,published_at,hidden,is_new}]}]`;
    - `is_new` es `published_at > coalesce(seen_through, approved_at)` y solo vale si la oferta
      está `aprobado`.
  - **Funciones de la coordinación.** Solo `private.is_school_coordinator(p_institution)`, y todas
    escriben en `admin_audit_log`:
    - `approve_offering(p_institution, p_grade, p_subject) returns void`: deja `aprobado` y fija
      `approved_by`, `approved_at = now()` y `seen_through = now()`;
    - `withdraw_offering(...) returns void`: deja `retirado`;
    - `set_unit_hidden(p_institution uuid, p_unit uuid, p_hidden boolean) returns void`;
    - `mark_units_seen(p_institution, p_grade, p_subject) returns void`: fija `seen_through = now()`.
  - **`my_catalog() returns jsonb`**: devuelve `{institution_id, status, offerings:[{grade_id,subject_id}], hidden_unit_ids:[]}`.
    - Para estudiantes, las ofertas son solo las `aprobado` de `private.person_institution(auth.uid())`.
    - Para miembros del colegio (docentes y coordinación), también entran las `pendiente`, para que la
      coordinación pueda recorrer los temas antes de aprobarlos.
    - Sin colegio, devuelve `{institution_id:null,status:null,offerings:[],hidden_unit_ids:[]}`.
  - **`admin_institutions_overview() returns table(id uuid, name text, status text, teachers_invited int, teachers_active int, students int, spend_month numeric, budget numeric)`**:
    - solo `is_admin()`;
    - el mes es el de Costa Rica.
  - **`admin_institution_usage(p_institution uuid) returns jsonb`**:
    - solo `is_admin()`;
    - devuelve `{weeks:[{week_start, active_students, attempts, skills_mastered, tutor_messages}] (8 semanas), spend_month, budget}`;
    - sin nombres ni ids de estudiantes.

- [ ] **Step 1: Write the failing tests** — `describe("school program and approval")`:
  - **Ofrecer:**
    - `admin_set_offering` sin contenido publicado lanza `no published content`;
    - el que no es admin recibe `42501`.
  - **Aprobar:**
    - la coordinadora de A aprueba 7.º Matemáticas;
    - un admin de plataforma que no es miembro recibe `42501` al aprobar;
    - un docente de A también recibe `42501`.
  - **Catálogo:**
    - `my_catalog()` de un estudiante de A lista solo `{7, matematicas}`;
    - el de un estudiante sin colegio trae `institution_id` nulo;
    - antes de aprobar, el de la coordinadora de A ya incluye `{7, matematicas}`, y el de un
      estudiante de A no.
  - **Temas nuevos:**
    - después de aprobar, se publica un tema nuevo en 7.º Matemáticas y `institution_program` lo
      marca `is_new: true`;
    - después de `mark_units_seen`, queda `false`.
  - **Review Focus 5:**
    - se oculta un tema, se retira y se vuelve a aprobar la materia, y el tema sigue en
      `hidden_unit_ids`;
    - un tema publicado en 8.º, que no se ofrece, nunca aparece en el catálogo.
  - **Review Focus 2:** un estudiante en grupos de A y luego de B recibe el catálogo de B.
  - **Resumen:** `admin_institutions_overview` cuenta el gasto del mes solo de las filas de
    `ai_usage` de ese colegio.

- [ ] **Step 2: Run** `pnpm test:rls`. Esperado: FAIL.
- [ ] **Step 3: Escriba la migración** con las firmas de arriba.
- [ ] **Step 4: Run** `pnpm test:rls`. Esperado: PASS.
- [ ] **Step 5: Commit** — `feat(db): the school approves its program; new topics show up flagged and can be hidden`

---

### Task 4: Invitaciones, miembros y reemplazos (SQL)

**Files:**
- Create: `supabase/migrations/20261120000300_school_people.sql`
- Modify: `supabase/tests/rls.test.ts`

**Interfaces:**
- Consumes: la tarea 1 (`institution_invites`, `is_school_coordinator`).
- Produces. Todas las funciones son `security definer`. Las autoriza `is_admin()` o
  `is_school_coordinator(p_institution)`, y todas escriben en `admin_audit_log`:
  - **`create_invites(p_institution uuid, p_people jsonb) returns jsonb`**:
    - `p_people` es `[{email,name,role}]`;
    - devuelve `{created:[{id,email}], skipped:[{email, reason}]}`, donde `reason` es
      `'already_member'` o `'already_invited'`;
    - normaliza los correos con `lower(btrim())`.
  - **`private.claim_invites(p_profile uuid, p_email text) returns int`**:
    - vincula todas las invitaciones no revocadas de ese correo;
    - pone el nombre en `profiles.display_name` si estaba vacío.
  - **`public.claim_my_invites() returns int`**: toma el correo de `auth.users` de `auth.uid()`.
  - **`private.handle_new_user()`**: se reemplaza para llamar también a `claim_invites`.
  - **`revoke_invite(p_invite uuid) returns void`.**
  - **`set_member_role(p_institution uuid, p_profile uuid, p_role institution_role) returns void`**:
    lanza `'last coordinator'` si deja al colegio sin coordinación.
  - **`remove_institution_member(p_institution uuid, p_profile uuid, p_replacement uuid default null) returns void`**:
    - el reemplazo debe ser un miembro activo distinto de quien se quita. Si no se da, es la persona
      de coordinación con más tiempo en el colegio, sin contar a quien se quita;
    - lanza `'last coordinator'` si se quita a la única persona de coordinación;
    - pasa las secciones del colegio de quien se quita al reemplazo;
    - pone en nulo `groups.guide_id` donde era guía;
    - revoca sus invitaciones y borra la membresía.
  - **`reassign_section(p_section uuid, p_teacher uuid) returns void`**: el nuevo docente debe ser
    miembro del colegio de la sección.
  - **`institution_people(p_institution uuid) returns table(kind text, profile_id uuid, invite_id uuid, name text, email text, role institution_role, status text, since timestamptz)`**:
    - `kind` es `'member'` o `'invite'`;
    - `status` es `'invitado'`, `'activo'` o `'revocado'`.
  - **`add_institution_member`**: se revoca el permiso de ejecución para authenticated. La
    reemplazan las invitaciones.

- [ ] **Step 1: Write the failing tests** — `describe("school invitations and members")`:
  - **Review Focus 1:** se invita a `"Ana@Colegio.cr "`. Al crear un usuario de auth con
    `ana@colegio.cr`, queda en `institution_members` con el rol de la invitación y la invitación
    queda aceptada.
  - **Usuario que ya existía:** con una invitación nueva, `claim_my_invites()` devuelve `1`.
  - **Permisos de la coordinación:** la coordinadora de A invita en A, pero recibe `42501` en B.
  - **Repetidos:** invitar dos veces el mismo correo devuelve `skipped` con `already_invited`.
  - **Review Focus 4:**
    - el docente T1, que es guía del grupo de A y tiene dos secciones, se quita con reemplazo T2;
    - las dos secciones quedan con `teacher_id = T2`;
    - el grupo queda con `guide_id` nulo;
    - la invitación de T1 queda revocada.
  - **Reemplazo por defecto:** sin reemplazo, las secciones pasan a la coordinación más antigua.
    Quitar a la única persona de coordinación lanza `last coordinator`.
  - **Reasignar:** `reassign_section` hacia alguien que no es miembro lanza un error.

- [ ] **Step 2: Run** `pnpm test:rls`. Esperado: FAIL.
- [ ] **Step 3: Escriba la migración.**
- [ ] **Step 4: Run** `pnpm test:rls`. Esperado: PASS.
- [ ] **Step 5: Commit** — `feat(db): invitations from the school's list; removing a teacher hands their sections to whoever the school names`

---

### Task 5: Secciones, grupos y códigos solo dentro de un colegio (SQL)

**Files:**
- Create: `supabase/migrations/20261120000400_school_access.sql`
- Modify: `supabase/tests/rls.test.ts`, y las pruebas existentes que creen secciones sueltas o grupos
  sin colegio (ajústelas al colegio de los fixtures).

**Interfaces:**
- Consumes: las tareas 1 y 3.
- Produces:
  - **`private.sections_group_check()`**, reemplazada. Al insertar exige, en este orden:
    - `group_id` con valor; si no, lanza `'sections need a school group'`;
    - que el grupo tenga colegio;
    - que el docente sea miembro de ese colegio;
    - una oferta `aprobado` para el grado del grupo y `subject_id`; si no, lanza
      `'subject not approved for this school'`.
  - **`create_group`**, reemplazada:
    - exige `p_institution` con valor y que quien la llama sea `is_admin()` o
      `is_school_coordinator(p_institution)`;
    - si no, lanza `'groups belong to a school'`.
  - **`join_with_code`**, reemplazada:
    - después de encontrar el grupo o la sección, toma el colegio;
    - si no hay colegio o el colegio no está `activo`, lanza
      `'school not accepting students' using errcode = 'P0001'`;
    - un grupo sin colegio también lanza ese error.

- [ ] **Step 1: Write the failing tests** — `describe("school access")`:
  - **Secciones:**
    - un docente de A no puede crear una sección suelta;
    - un docente de A no puede crear una de una materia no aprobada;
    - un docente de A sí puede crear una de 7.º Matemáticas aprobada en un grupo de A;
    - un docente de B no puede crear una en un grupo de A.
  - **Grupos:** `create_group(..., null)` lanza `groups belong to a school`.
  - **Códigos por estado del colegio:**
    - un código de grupo de A en `preparando` lanza `school not accepting students`;
    - en `activo` funciona;
    - en `pausado` vuelve a lanzar el error.

- [ ] **Step 2: Run** `pnpm test:rls`. Esperado: FAIL.
- [ ] **Step 3: Escriba la migración.**
- [ ] **Step 4: Run** `pnpm test:rls`. Esperado: todo PASS, incluidas las pruebas antiguas
  ajustadas.
- [ ] **Step 5: Commit** — `feat(db): sections, groups and join codes only exist inside an active school`

---

### Task 6: Base web: admin, catálogo, invitaciones por correo y reclamar al entrar

**Files:**
- Modify: `apps/web/src/lib/staff.ts`, `apps/web/src/app/auth/confirm/route.ts`, `apps/web/src/proxy.ts`
- Create: `apps/web/src/lib/catalog.ts`, `apps/web/src/lib/invites.ts`, `supabase/templates/invite.html`
- Modify: `supabase/config.toml` (`[auth.email.template.invite]`, con asunto «Su colegio lo invita a Eduka»)
- Test: `apps/web/test/invites.test.ts`

**Interfaces:**
- Consumes: la tarea 2 (`Catalog`, `DEMO_CATALOG`), la tarea 3 (`my_catalog`) y la tarea 4
  (`claim_my_invites`).
- Produces:
  - **`requireAdmin(): Promise<{ supabase; user }>`** en `lib/staff.ts`: llama a `notFound()` si no
    hay sesión, si la sesión es anónima o si `profiles.role !== 'admin'`.
  - **`myCatalog(): Promise<Catalog>`** en `lib/catalog.ts`: devuelve `DEMO_CATALOG` si no hay
    sesión.
  - **`sendInvites(people: { email: string; name: string }[], origin: string): Promise<{ email: string; sent: boolean; error?: string }[]>`**
    en `lib/invites.ts`:
    - usa `adminClient().auth.admin.inviteUserByEmail(email, { redirectTo: \`${origin}/auth/confirm?next=/docente\`, data: { display_name: name } })`;
    - si el error dice que el usuario ya existe, usa `signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo } })`
      con el cliente de servidor sin sesión.
  - **`auth/confirm`**: después de una sesión válida, llama a `supabase.rpc("claim_my_invites")`. Si
    falla, lo registra en el log y sigue.
  - **`proxy.ts`**: el matcher suma `"/admin/:path*"` y `"/docente/:path*"`.

- [ ] **Step 1: Write the failing test** `invites.test.ts` (mock de `adminClient` y del cliente de servidor):
  - `sendInvites` llama a `inviteUserByEmail` con un `redirectTo` que termina en
    `/auth/confirm?next=/docente`;
  - ante `"User already registered"`, cae en `signInWithOtp` con `shouldCreateUser: false` y
    devuelve `sent: true`;
  - ante otro error, devuelve `sent: false` con el mensaje.
- [ ] **Step 2: Run** `pnpm -s test` en `apps/web`. Esperado: FAIL.
- [ ] **Step 3: Implemente** las piezas de la lista de arriba y la plantilla del correo. La plantilla:
  - usa usted;
  - dice qué es Eduka en una línea;
  - incluye el botón «Entrar a Eduka» con `{{ .ConfirmationURL }}`.
- [ ] **Step 4: Run** typecheck, lint y test en `apps/web`. Esperado: PASS.
- [ ] **Step 5: Commit** — `feat(web): admin guard, the school catalog, invitation e-mails and claiming invites on sign-in`

---

### Task 7: Lado del estudiante: solo lo aprobado por su colegio, y la demostración

**Files:**
- Modify:
  - `apps/web/src/lib/learn.ts` (`subjectsForGrade`, `unitsFor` reciben `catalog: Catalog`);
  - `app/(app)/estudiar/page.tsx`, `estudiar/[grado]/page.tsx`, `estudiar/[grado]/[materia]/page.tsx`;
  - `app/(app)/unidad/[id]/page.tsx`;
  - `app/(app)/estudiar/actions.ts`;
  - `app/api/tutor/route.ts`;
  - `lib/tutor-server.ts`;
  - `app/(app)/unirme/join-form.tsx`.
- Create: `apps/web/src/components/learn/demo-banner.tsx`
- Test: `apps/web/test/demo-banner.test.tsx`

**Interfaces:**
- Consumes: `myCatalog()`, `unitVisible`, `subjectVisible`, `visibleGrades` e `isDemo`.
- Produces:
  - `DEMO_TUTOR_PER_DAY = 10` exportado de `lib/tutor-server.ts`.
  - `<DemoBanner />`, que muestra el texto exacto de la demostración.

- [ ] **Step 1: Write the failing test** `demo-banner.test.tsx`: renderiza
  «Estás en la demostración de Eduka. Lo que hagas aquí no le llega a ningún docente.».
- [ ] **Step 2: Run.** Esperado: FAIL.
- [ ] **Step 3: Implemente:**
  - **Páginas de estudio:** `/estudiar` y `/estudiar/[grado]` muestran solo los grados y materias
    visibles; las de afuera dan `notFound()`.
  - **Tema:** `/unidad/[id]` da `notFound()` si `!unitVisible`.
  - **Acciones del servidor:** toda acción exportada en `estudiar/actions.ts` que recibe un `unitId`,
    y `/api/tutor`, responde «Este tema no está disponible en tu colegio.» si el tema no es visible.
  - **Límite de Kemo:** el límite diario usa `DEMO_TUTOR_PER_DAY` cuando `isDemo(catalog)`, y la
    prop `limits` del chat lo refleja.
  - **Aviso de demostración:** `<DemoBanner />` va arriba en `/estudiar/**` y `/unidad/**` cuando
    `isDemo`.
  - **Unirse:** `join-form` muestra el texto exacto de colegio no activo cuando el error contiene
    `school not accepting students`.
- [ ] **Step 4: Run** typecheck, lint y test. Esperado: PASS.
- [ ] **Step 5: Commit** — `feat(web): students see only what their school approved; visitors get a labelled demo with a smaller Kemo limit`

---

### Task 8: Lado del docente: solo con colegio, secciones solo en grupos con materia aprobada

**Files:**
- Modify:
  - `app/(app)/docente/page.tsx`, `docente/new-section-form.tsx`, `docente/actions.ts`;
  - `app/docentes/page.tsx`, si promete crear secciones por cuenta propia.
- Delete: `app/(app)/docente/new-group-form.tsx`

**Interfaces:**
- Consumes: la tarea 5 (mensajes de error), `institution_members` y la vista `institution_offerings`
  (por RLS).

- [ ] **Step 1: Prueba.** Este comportamiento lo cubre la prueba de punta a punta de la tarea 11. No
  agregue una prueba unitaria aquí.
- [ ] **Step 2: Implemente:**
  - **`/docente`:** una cuenta con sesión, sin colegio, ve el texto exacto de docente sin colegio y
    un enlace a `/docente/demo`. Un miembro cuyo colegio no tiene ofertas `aprobado` ve el texto
    exacto de colegio sin materias aprobadas.
  - **Formulario de sección:** `NewSectionForm` solo trabaja en modo grupo. Muestra los grupos de su
    colegio y, para el grupo elegido, solo las materias con oferta `aprobado` en el grado del grupo.
    Se quitan la sección suelta y el campo «Institución».
  - **`createSection`:** sin `group_id` válido, devuelve «Elija el grupo y la materia.». Además
    traduce los errores:
    - `'subject not approved for this school'`: «Esa materia todavía no está aprobada por su colegio.»;
    - `'sections need a school group'`: «Elija el grupo y la materia.».
  - **Crear grupos:** se quita «Crear un grupo» de `/docente`. Los grupos se crean en la consola o
    en la página de coordinación (tarea 9).
  - **Textos de bienvenida:** la landing interna de `/docente` («Cree una sección, comparta el
    código…») pasa a «Su colegio lo invita a Eduka. Usted comparte el código de su grupo y ve cómo
    avanza cada estudiante en los temas del programa.».
- [ ] **Step 3: Run** typecheck, lint y test. Esperado: PASS.
- [ ] **Step 4: Commit** — `feat(web): only teachers of a school use Eduka; sections only in school groups with approved subjects`

---

### Task 9: Coordinación del colegio: programa, personas, grupos y reasignar secciones

**Files:**
- Create:
  - `apps/web/src/app/(app)/docente/institucion/actions.ts`;
  - `apps/web/src/components/school/program-approval.tsx`;
  - `apps/web/src/components/school/people-panel.tsx`;
  - `apps/web/src/components/school/reassign-section.tsx`;
  - `apps/web/src/components/school/groups-panel.tsx`.
- Modify: `app/(app)/docente/institucion/[id]/page.tsx`
- Delete: `app/(app)/docente/institucion/[id]/member-form.tsx`
- Test: `apps/web/test/people-panel.test.tsx`

**Interfaces:**
- Consumes: las tareas 3 y 4 (RPC), `parseInviteList` y `sendInvites`.
- Produces. Son acciones de servidor (`"use server"`) que también usa la consola en la tarea 10.
  Cada una llama a su RPC, revalida la página y devuelve `{ error?: string }` con un texto en
  español:
  - `approveOffering(institutionId: string, grade: number, subject: string)`;
  - `withdrawOffering(…)`, `markUnitsSeen(…)`;
  - `setUnitHidden(institutionId: string, unitId: string, hidden: boolean)`;
  - `invitePeople(institutionId: string, _prev, form: FormData)`: lee `form.get("list")` y
    `form.get("confirm")`. Sin `confirm`, devuelve la vista previa `{ preview: ReturnType<typeof parseInviteList> }`.
    Con `confirm`, llama a `create_invites` y luego a `sendInvites` con lo creado, y devuelve
    `{ sent: n, failed: [{email,error}] }`;
  - `resendInvite(institutionId: string, inviteId: string)`, `revokeInvite(institutionId: string, inviteId: string)`;
  - `setMemberRole(institutionId: string, profileId: string, role: "teacher" | "admin")`;
  - `removeMember(institutionId: string, profileId: string, replacementId: string | null)`;
  - `reassignSection(sectionId: string, teacherId: string)`;
  - `createGroups(institutionId: string, _prev, form: FormData)`: con `grade` y `names` («7-1, 7-2,
    7-3»), llama a `create_group` por cada nombre.
- Componentes, que reciben `institutionId` y los datos ya cargados:
  - `<ProgramApproval program={…} />` muestra el aviso exacto de temas nuevos con «Ocultar» y
    «Entendido»;
  - `<PeoplePanel people={…} members={…} />` tiene el textarea, la vista previa, el envío y la tabla
    con estado y acciones. Al quitar a alguien, ofrece un selector de reemplazo cuya opción por
    defecto dice «Coordinación con más tiempo en el colegio»;
  - `<ReassignSection sections={…} members={…} />`;
  - `<GroupsPanel groups={…} />` crea grupos en lote y asigna la guía. Reutiliza `setGroupGuide`, que
    ya existe.

- [ ] **Step 1: Write the failing test** `people-panel.test.tsx`:
  - con una vista previa de 2 personas, 1 error de correo en la línea 3 y 1 repetido, el panel
    muestra «2 personas listas», «Línea 3: correo no válido» y «Repetido: ana@c.cr»;
  - el botón «Enviar invitaciones» está habilitado;
  - el selector de reemplazo lista a los miembros activos menos a quien se quita.
- [ ] **Step 2: Run.** Esperado: FAIL.
- [ ] **Step 3: Implemente** las acciones y los componentes.
  - La página de coordinación agrega las secciones «Programa», «Personas», «Grupos» y «Secciones»,
    solo para `institution_members.role = 'admin'`.
  - El calendario se queda como está.
- [ ] **Step 4: Run** typecheck, lint y test. Esperado: PASS.
- [ ] **Step 5: Commit** — `feat(web): the school's coordination approves its program, manages its people and groups, and reassigns sections`

---

### Task 10: La consola `/admin`

**Files:**
- Create:
  - `apps/web/src/app/(app)/admin/page.tsx` y `apps/web/src/app/(app)/admin/loading.tsx`;
  - `apps/web/src/app/(app)/admin/actions.ts`;
  - `apps/web/src/app/(app)/admin/colegios/[id]/page.tsx` y su `loading.tsx`;
  - `apps/web/src/app/(app)/admin/colegios/[id]/codigos/page.tsx`, la hoja imprimible;
  - `apps/web/src/components/admin/offering-grid.tsx`, `apps/web/src/components/admin/usage-panel.tsx`.
- Test: `apps/web/test/offering-grid.test.tsx`

**Interfaces:**
- Consumes:
  - `requireAdmin()`;
  - de la tarea 3: `admin_upsert_institution`, `admin_set_offering`, `admin_institutions_overview`,
    `admin_institution_usage` e `institution_program`;
  - los componentes y acciones de la tarea 9;
  - `schoolChecklist` y `spendLevel`.
- Produces:
  - `saveInstitution(_prev, form: FormData)`, con `id?`, `name`, `slug`, `status` y `budget`.
    Redirige a `/admin/colegios/[id]`;
  - `setOffering(institutionId: string, grade: number, subject: string, offered: boolean)`.
- Pantallas, según la sección «La consola» de la especificación:
  - **`/admin`:**
    - una tabla con nombre, estado, docentes `activos/invitados`, estudiantes y «IA del mes»
      (`$gasto / $presupuesto`);
    - el gasto lleva el color de `spendLevel`;
    - un formulario «Nuevo colegio».
  - **`/admin/colegios/[id]?tab=resumen|programa|personas|grupos|uso`.** Usa pestañas como
    `unidad/[id]`.
    - **Resumen:** el formulario del colegio, el calendario (con `CalendarForm`, que ya existe) y la
      lista de `schoolChecklist`. `smtpReady` es `process.env.EMAIL_SMTP_CONFIGURED === "true"`.
    - **Programa:** `<OfferingGrid>` con grados por materias del catálogo común. Cada celda está en
      uno de estos estados:
      - «Sin contenido»: deshabilitada;
      - «Disponible»: casilla para ofrecer;
      - «Pendiente de aprobación»;
      - «Aprobado»;
      - «Retirado».
    - **Personas** y **Grupos:** los componentes de la tarea 9, más «Ver hoja de códigos» que lleva
      a `codigos`.
    - **Uso:** `<UsagePanel>`, con 8 semanas de cifras agregadas y el gasto contra el presupuesto.
  - **`codigos`:** una tarjeta por grupo con el nombre, el código grande y
    «Entra a eduka y toca "Únete a tu sección"». Usa `print:` para imprimir en hojas. Sin nombres de
    estudiantes.

- [ ] **Step 1: Write the failing test** `offering-grid.test.tsx`:
  - con `units` publicados solo en 7.º Matemáticas y una oferta `aprobado` en 7.º Español sin
    contenido, la celda de 8.º Matemáticas dice «Sin contenido» y está deshabilitada;
  - 7.º Matemáticas dice «Disponible»;
  - 7.º Español dice «Aprobado».
- [ ] **Step 2: Run.** Esperado: FAIL.
- [ ] **Step 3: Implemente** las rutas y los componentes. `/admin` y todas sus subrutas llaman
  primero a `requireAdmin()`.
- [ ] **Step 4: Run** typecheck, lint y test. Esperado: PASS.
- [ ] **Step 5: Commit** — `feat(web): the Eduka team console: schools, program, people, groups and usage`

---

### Task 11: Recorrido de punta a punta y documentación

**Files:**
- Create: `e2e/consola.spec.ts`
- Delete: `e2e/docente-estudiante.spec.ts` (su recorrido queda dentro de `consola.spec.ts`)
- Modify: `e2e/README.md`, `e2e/setup.sh`, `docs/producto/salir-live.md`

**Interfaces:**
- Consumes: todo lo anterior.
- Para preparar los datos, `consola.spec.ts` usa SQL solo para:
  - hacer `admin` a la cuenta del equipo, con `update profiles set role='admin'` después de su
    primer ingreso;
  - publicar un tema de 7.º con 4 ejercicios verificados, igual que la prueba anterior.

  Todo lo demás pasa por la interfaz.

- [ ] **Step 1: Write the test** `e2e/consola.spec.ts`, un solo `test` con estos pasos:
  1. El admin entra por el enlace mágico (Mailpit), crea «Colegio Prueba» y marca 7.º Matemáticas.
     Luego, en «Personas», pega `docente@example.test, Dana Docente` y
     `coord@example.test, Cora Coordinación, coordinación`, y envía.
  2. Cora abre su invitación (Mailpit), va a `/docente/institucion/[id]` y aprueba 7.º Matemáticas.
     Crea el grupo «7-1».
  3. El admin pasa el colegio a `activo`. Dana abre su invitación, va a `/docente` y crea la sección
     7-1 · Matemáticas.
  4. Una estudiante se une con el código de 7-1. `/estudiar` muestra solo Sétimo, y `/estudiar/7`
     muestra solo Matemáticas. Responde 3 ejercicios, y Dana la ve en su panel.
  5. Cora oculta un tema. La estudiante recibe 404 en `/unidad/<ese tema>`.
  6. Con el colegio en `preparando`, un código de grupo muestra el texto exacto de colegio no activo.
  7. Una cuenta sin invitación ve en `/docente` el texto exacto de docente sin colegio, y no tiene el
     formulario de sección.
- [ ] **Step 2: Run** `e2e/setup.sh`, then `pnpm --filter web dev --hostname 127.0.0.1 &`, then
  `pnpm test:e2e --trace off`. Esperado: `consola.spec.ts` y `revisar.spec.ts` en PASS. Si
  `dockerd` no corre, inícielo con `dockerd &`.
- [ ] **Step 3: Documentación:**
  - en `e2e/README.md`, describa `consola.spec.ts`;
  - en `docs/producto/salir-live.md`, marque las filas P0 1, 2 y 3 como hechas en esta rama, y
    agregue la variable `EMAIL_SMTP_CONFIGURED` a P0 4;
  - en `e2e/setup.sh`, aplique la plantilla de invitación si hace falta.
- [ ] **Step 4: Commit** — `test(e2e): the whole console loop, from a new school to a student practising; go-live doc updated`
