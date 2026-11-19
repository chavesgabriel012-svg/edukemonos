# Consola del equipo Eduka (`/admin`): diseño

Fecha: 19 de noviembre de 2026. Estado: listo para la aprobación del fundador.

## Intención

Hoy un colegio se arma a mano, con SQL y scripts desde la terminal. Para empezar con el colegio fundador
apenas firme, el equipo de Eduka necesita un panel propio, fácil de usar, desde el que se pueda:

- crear cada colegio y elegir sus grados y materias;
- invitar a sus docentes a partir de la lista que entrega el colegio;
- crear sus grupos con sus códigos;
- seguir el uso y el gasto de IA del colegio.

Ningún contenido llega a los estudiantes de un colegio sin que la coordinación de ese colegio lo apruebe.

Por qué ahora: es la primera prioridad de `docs/producto/salir-live.md`, y la ventaja que más separa a
Eduka de la competencia es la **cero carga docente** (`docs/producto/competencia.md`). El colegio no
arma nada: Eduka lo deja listo y el docente solo entra.

## Lo que ya decidió el fundador

- Es una consola **para el equipo de Eduka**, no para el colegio.
- Los colegios se distinguen por su contenido, idioma, cantidad de materias y materias específicas
  (AP, IB). La primera versión trabaja con los **programas del MEP** que ya existen. El contenido
  propio de cada colegio (Word, presentaciones) se diseña cuando llegue el colegio fundador y se sepa
  qué formato trae.
- **Enfoque elegido: el 1.** Un panel de gestión ahora, y la generación de contenido sigue siendo un
  comando que corre el equipo, como hoy.
- Los **estudiantes** entran con un código, sin cuenta: una sola Eduka, y el código abre el colegio.
- Los **docentes** entran solo si están en la lista que entrega el colegio. Les llega una invitación
  por correo y entran con un enlace, sin contraseña. La coordinación del colegio puede agregar y quitar
  docentes después.
- El texto de la landing («100 % personalizado») queda como está, porque es la idea del producto.
- **Eduka es un SaaS B2B.** No hay estudiantes ni docentes sin colegio:
  - solo usan Eduka los docentes invitados por un colegio que tenga contenido aprobado;
  - el registro libre de docentes se cierra;
  - el «contáctenos» o «refiera a su colegio», para un docente cuyo colegio no tiene Eduka, queda
    para más adelante.
- **Aprobación:**
  - el colegio aprueba cada grado y materia antes que nada;
  - después, los temas nuevos que publique el equipo aparecen solos, y la coordinación recibe un
    aviso;
  - la coordinación puede revertir: ocultar un tema o retirar una materia completa.

## Metas, no metas y anti-metas

**Metas**

1. **Colegio listo en una tarde.** El equipo de Eduka deja un colegio listo para el primer día sin
   tocar SQL ni la terminal: colegio, grados y materias, docentes invitados y grupos con código.
2. **Aprobación del colegio.** La coordinación del colegio revisa y aprueba los temas de cada materia
   y grado antes de que los vean sus estudiantes.
3. **Solo colegios.** Usa Eduka quien pertenece a un colegio: el docente invitado y el estudiante que
   se unió con un código del colegio. Quien no está invitado no ve nada de ningún colegio.
4. **Separación por colegio desde ya.** Los datos quedan preparados para que, cuando llegue el
   contenido propio, cada colegio vea el suyo sin rehacer nada.
5. **Gasto de IA visible por colegio**, comparado con un presupuesto mensual.

**No metas (en esta versión)**

- Subir documentos, generar, verificar y publicar contenido desde el navegador. Eso es el enfoque 2,
  y se construye encima de este cuando llegue el colegio fundador.
- Contenido en inglés, AP o IB.
- Entrar con Google o Microsoft.
- Facturación y cobros.
- Una dirección propia por colegio. `institutions.slug` ya está reservado para eso.
- El «contáctenos» o «refiera a su colegio» para docentes sin colegio.

**Anti-metas.** Si pasa algo de esto, el panel fracasó aunque funcione:

- El docente tiene que preparar o configurar algo para empezar.
- La consola muestra nombres de estudiantes, lo que escriben al tutor o datos de un estudiante en
  particular. El equipo de Eduka ve solo cifras agregadas por colegio.
- Un estudiante ve contenido no verificado o no aprobado por su colegio.
- Se corta a Kemo en plena clase porque el colegio llegó a su presupuesto.

## Restricciones

- **Stack actual:**
  - Next.js 16 en `apps/web`. Antes de escribir código, leer `apps/web/AGENTS.md` y
    `node_modules/next/dist/docs/`.
  - Supabase con RLS. Las reglas van en SQL, como funciones `security definer` en el esquema
    `private`, con su espejo en `packages/curriculum` y la prueba en `supabase/tests/rls.test.ts`.
- **Cómo se aplican las migraciones en producción:** el fundador las pega en el editor SQL de
  Supabase. Cada archivo corre como una sola transacción. Un valor nuevo de un enum va en una
  migración previa, aparte.
- **Correo:** las invitaciones salen por el correo de Supabase Auth. Antes de invitar a docentes
  reales hay que configurar un SMTP propio (P0 4 de `salir-live.md`), porque el correo que trae
  Supabase envía muy pocos mensajes por hora.
- **Producción:** no se crean datos de prueba. Todo se prueba con `e2e/setup.sh` (Supabase local).
- **Lo que ya existe y se reutiliza:**
  - Roles:
    - `profiles.role = 'admin'` es el equipo de Eduka (`private.is_admin()`).
    - `institution_members.role = 'admin'` es la coordinación del colegio
      (`private.is_institution_admin()`).
    - `institution_members.role = 'teacher'` es el docente.
  - Tablas y funciones:
    - `institutions`, `institution_members`, `groups` (con `institution_id`, `guide_id` y
      `join_code`) y `sections.institution_id`.
    - `save_institution_calendar()`, `create_group()` y `add_institution_member()`. Esta última hoy
      exige que la persona ya haya entrado una vez; la invitación reemplaza esa exigencia.
    - `ai_usage`, con `section_id`.
  - Página de coordinación: `/docente/institucion/[id]`, que ya tiene el formulario de miembros y el
    del calendario.

## Enfoques considerados

1. **Panel de gestión ahora; el contenido sigue por terminal.** *(Elegido.)* Unas 2 semanas. Es lo
   único que el colegio fundador necesita el primer día, y no construye la carga de documentos antes
   de saber qué formato trae el colegio.
2. **Panel completo, con carga y generación desde el navegador.** Unas 5 o 6 semanas. Generar contenido
   toma desde minutos hasta horas y cuesta IA, así que necesita tareas en segundo plano. La mitad del
   trabajo depende del formato del colegio, que todavía no se conoce. Se hace encima del 1, sin
   rehacerlo.
3. **Herramienta aparte** (el panel de Supabase o una herramienta interna genérica). Descartada: no es
   amigable y no sirve para mostrársela a un colegio.

## Diseño

### Quién es quién

| Persona | Cómo se reconoce | Dónde trabaja |
|---|---|---|
| Equipo Eduka | `profiles.role = 'admin'`; se asigna por SQL, una vez por persona | `/admin` |
| Coordinación del colegio | `institution_members.role = 'admin'` | `/docente/institucion/[id]` |
| Docente | `institution_members.role = 'teacher'` | `/docente` |
| Estudiante | Sesión anónima; pertenece al colegio por el grupo o la sección a la que se unió | `/estudiar`, `/unidad`… |

### Datos

Una migración nueva, más una previa si hace falta un enum. Todo con RLS activo y sin permisos directos
para anon ni authenticated: las escrituras pasan por funciones.

1. **`institutions`**: se agregan:
   - `status`: `preparando`, `activo` o `pausado`; por defecto `preparando`. **Llamada mía** sobre lo
     que bloquea cada estado:
     - `preparando`: la coordinación y los docentes pueden entrar y preparar, pero los códigos de los
       grupos todavía no aceptan estudiantes.
     - `activo`: funciona todo.
     - `pausado`: los códigos dejan de aceptar estudiantes nuevos. Todo lo demás sigue funcionando,
       Kemo incluido.
   - `ai_monthly_budget_usd numeric`, que puede quedar vacío.
   - `language text`, por defecto `'es'`. Se guarda ya para no migrarlo después. En esta versión no
     cambia nada en la app.
2. **`institution_offerings`**: qué grados y materias tiene cada colegio.
   - Columnas: `institution_id`, `grade_id`, `subject_id`, `status` (`pendiente`, `aprobado` o
     `retirado`), `approved_by`, `approved_at`, `seen_through` (hasta cuándo vio la coordinación los
     temas nuevos) y `created_at`.
   - `retirado` es la reversión de una materia completa. Sus estudiantes dejan de verla, y las
     secciones y el avance se conservan por si se vuelve a aprobar.
   - Llave única: `(institution_id, grade_id, subject_id)`.
   - Solo se puede ofrecer una combinación de grado y materia que tenga temas publicados.
   - **Llamada mía:** solo la coordinación del colegio aprueba. El equipo Eduka no puede aprobar en
     nombre del colegio, aunque `private.is_institution_admin()` hoy le da paso a los administradores
     de la plataforma: la función de aprobar exige ser miembro con rol `admin` del colegio. Mientras
     el colegio no tenga una coordinadora o un coordinador que haya aceptado su invitación, la consola
     lo muestra en la lista de lo que falta.
3. **`institution_hidden_units`**: los temas que la coordinación ocultó para su colegio.
   - Columnas: `institution_id`, `unit_id`, `hidden_by` y `hidden_at`.
   - Ocultar un tema es la reversión de un tema suelto. Se puede volver a mostrar.
4. **`curriculum_units.published_at`**: cuándo se publicó cada tema.
   - Lo pone un trigger al pasar a `published`.
   - Para los temas que ya existen se rellena con `reviewed_at` o `updated_at`.
   - Sirve para el aviso de temas nuevos: los publicados después de `seen_through`.
5. **`institution_invites`**: las invitaciones a docentes y coordinación.
   - Columnas: `id`, `institution_id`, `email` (en minúsculas y sin espacios), `display_name`,
     `role` (`institution_role`), `invited_by`, `invited_at`, `accepted_profile_id`, `accepted_at`
     y `revoked_at`.
   - Índice único: `(institution_id, email)` entre las invitaciones no revocadas.
6. **Separación del contenido.** Se agrega `curriculum_sources.institution_id uuid null`, donde
   `null` significa el catálogo común (MEP).
   - La política de lectura de `curriculum_units`, `materials` e `items` pasa a ser: publicado **y**
     (fuente común **o** la persona pertenece a ese colegio).
   - Hoy todas las fuentes son comunes, así que nadie ve un cambio. Queda lista para el contenido
     propio.
7. **Datos que ya existen.** **Llamada mía:** los grupos y secciones sin colegio que haya en
   producción (hoy hay 0 secciones) quedan como están, pero sus códigos dejan de aceptar estudiantes.
8. **`admin_audit_log`**: cada acción del equipo Eduka en la consola, con quién, qué, sobre qué
   colegio y cuándo. Lo leen solo los administradores.

### Invitaciones y acceso docente

1. En la consola, o en la página de coordinación si es la coordinación quien invita, se pega la
   lista: una persona por línea, con `correo, nombre, rol`. El rol es opcional y por defecto es
   `docente`. Antes de enviar se ve una vista previa:
   - las líneas válidas;
   - los correos repetidos;
   - quién ya era miembro.
2. Al confirmar, se crean las filas en `institution_invites` y se envía un correo a cada persona con
   `supabase.auth.admin.inviteUserByEmail`, desde el servidor con la llave de servicio. Es una
   invitación en español, con un enlace que entra directo a `/docente`.
3. **Cuándo se vincula la persona al colegio:**
   - Una función `private.claim_invites(profile, email)` hace la vinculación: crea la fila en
     `institution_members` con el rol de la invitación, usa el nombre como `display_name` si no
     había uno y marca la invitación como aceptada.
   - Se ejecuta cuando se crea el usuario (`handle_new_user`).
   - También se ejecuta en cada entrada, con un RPC `claim_my_invites()` que llama
     `/auth/confirm`. Así funciona también para quien ya tenía cuenta.
4. **Quien entra con correo sin invitación no ve nada de ningún colegio.**
   - Al entrar a `/docente` ve: «Su colegio todavía no le dio acceso a Eduka. Si ya debería tenerlo,
     pídale a la coordinación que lo invite», y un enlace a la demostración.
   - **Decidido por el fundador:** se cierra la creación de secciones y grupos sin colegio.
     `create_group(..., null)` y la sección suelta dejan de existir para docentes. En producción hay
     0 secciones, así que no afecta a nadie.
   - Un docente invitado cuyo colegio todavía no tiene ningún grado y materia aprobado ve: «Su
     colegio está terminando de preparar Eduka». Solo puede crear secciones de grados y materias
     aprobados.
   - Cambian la prueba `e2e/docente-estudiante.spec.ts`, que pasa a usar el flujo con invitación, y
     los textos de `/docentes` que hablan de crear una sección por cuenta propia.
5. **Quitar a un docente** (desde la consola o desde coordinación):
   - revoca la invitación y borra la fila de `institution_members`;
   - sus secciones del colegio pasan a la coordinación (`sections.teacher_id`) para no perder el
     avance de los estudiantes. **Llamada mía:** pasan a la coordinadora o el coordinador más antiguo
     del colegio. No se puede quitar a la única persona de coordinación mientras no haya otra;
   - queda en `admin_audit_log` o en `teacher_audit_log`, según quién lo hizo.
6. **Lo que puede hacer la coordinación:** invitar y quitar docentes y coordinación de su propio
   colegio. No puede tocar a otro colegio ni ver nada del equipo Eduka.

### La consola (`/admin`)

Solo para `profiles.role = 'admin'`. Para cualquier otra persona, `/admin` responde 404 y no un
mensaje de «sin permiso», para no anunciar que existe. Escritorio primero, aunque también funciona en
teléfono. Usa las piezas de interfaz que ya existen (`action()`, `field`, `card`).

```
/admin                         Colegios
  ┌────────────────────────────────────────────────────────────┐
  │ Colegios                                   [Nuevo colegio] │
  │ Nombre              Estado      Docentes Estud.  IA del mes│
  │ Colegio X           Activo      24/26    412     $18 / $40 │
  │ Liceo Y             Preparando   0/12      0      $0 / —   │
  └────────────────────────────────────────────────────────────┘

/admin/colegios/[id]           Pestañas: Resumen · Programa · Personas · Grupos · Uso
```

- **Resumen:** nombre, estado (`preparando`, `activo`, `pausado`), presupuesto mensual de IA y
  calendario escolar (reusa `save_institution_calendar`). Muestra una lista de lo que falta para el
  primer día:
  - programa aprobado;
  - docentes invitados y aceptados;
  - grupos creados;
  - SMTP configurado.
- **Programa:** una cuadrícula de grados por materias del catálogo MEP. En cada celda:
  - sin contenido, y no se puede marcar;
  - disponible, y se puede marcar;
  - pendiente de aprobación;
  - aprobado.

  El equipo marca lo que el colegio contrató, y eso queda «pendiente de aprobación» por la
  coordinación.
- **Personas:** pegar la lista, la vista previa, enviar las invitaciones y una tabla con cada persona
  (nombre, correo, rol y estado: invitada, activa o revocada), con las acciones «reenviar», «cambiar
  rol» y «quitar».
- **Grupos:**
  - crear grupos en lote, por ejemplo «7-1, 7-2, 7-3» en 7.º;
  - asignar la persona guía entre los miembros;
  - ver los códigos;
  - una hoja imprimible con un código por grupo, para entregar el primer día.
- **Uso:** solo cifras agregadas del colegio:
  - estudiantes activos por semana;
  - ejercicios por semana;
  - temas dominados;
  - uso de Kemo;
  - gasto de IA del mes contra el presupuesto.

  Sin nombres ni datos de un estudiante en particular.

### Aprobación del colegio

En `/docente/institucion/[id]`, la coordinación ve una sección nueva, «Programa». Por cada grado y
materia pendiente:

- la lista de temas en el orden del programa, con su título y la página de la fuente;
- un enlace para recorrer cada tema como estudiante;
- un botón «Aprobar».

Al aprobar, quedan registrados quién lo hizo y cuándo.

Después de la aprobación:

- **Temas nuevos.** Los que publique el equipo en un grado y materia aprobados aparecen solos para
  los estudiantes, porque ya pasaron la verificación. En la página de coordinación aparece un aviso:
  «N temas nuevos en 8.º Matemáticas desde su última revisión», con la lista y dos acciones por tema,
  «Ocultar» y «Entendido». Esta última mueve `seen_through`.
- **Revertir.** La coordinación puede ocultar cualquier tema, y volver a mostrarlo, o retirar un grado
  y materia completo. Retirar no borra secciones ni avance.

**Qué ven los estudiantes** (decidido por el fundador: no hay estudiantes sin colegio):

- El estudiante entra con el código de un grupo o una sección de su colegio. Los códigos solo existen
  dentro de un colegio, y un colegio en estado `preparando` todavía no acepta estudiantes.
- Ve en `/estudiar` y en `/unidad` solo los grados y materias **aprobados** de su colegio, sin los
  temas ocultos. Va como filtro en las páginas y en las acciones del servidor, y la regla se escribe
  una vez en `packages/curriculum`. No va como regla en la base de datos para el catálogo del MEP,
  que ya es público. El contenido **propio** de un colegio sí queda protegido en la base de datos
  (punto 6 de «Datos»).
- Kemo solo abre conversaciones sobre temas visibles para ese estudiante.

**Llamada mía: la demostración pública.**

- La landing necesita que un colegio o un inversionista pueda probar Eduka. «Probar» sigue abriendo
  la demostración actual, que ahora dice claramente que es una demostración.
- Quien llega sin colegio no es un estudiante: es un visitante en modo demostración.
- Para acotar el gasto, en la demostración Kemo tiene un límite menor: 10 mensajes por día.
- Nada de lo que hace un visitante llega a ningún docente.

### Presupuesto de IA

- **Llamada mía:** se agrega `ai_usage.institution_id`. Desde ahora, cada llamada a la IA
  (tutor, retroalimentación de escritura y resumen docente) registra el colegio del estudiante o del
  docente. El colegio sale de sus grupos o secciones: en la práctica un estudiante pertenece a un solo
  colegio, y si hubiera más de uno se toma el más reciente.
- Hoy la ruta del tutor no registra la sección (`apps/web/src/app/api/tutor/route.ts`), así que
  sumar por sección casi no mostraría gasto. Por eso se registra el colegio directamente.
- La generación de contenido del catálogo común no cuenta para ningún colegio.
- Al 80 % del presupuesto, la consola lo marca en amarillo. Al 100 %, lo marca en rojo.
- **Llamada mía:** no se corta a Kemo al llegar al tope (anti-meta). Siguen valiendo los límites que
  ya existen por estudiante, por conversación y por día.

### Pruebas

- **RLS** (`supabase/tests/rls.test.ts`):
  - las tablas nuevas, en la prueba que revisa que todas tengan RLS;
  - un docente de un colegio no ve invitaciones, ofertas ni contenido propio de otro;
  - la coordinación solo invita en su colegio;
  - solo `admin` llega a la consola.
- **TypeScript:** las reglas de visibilidad (oferta aprobada y fuente común o del colegio) y el
  análisis de la lista pegada (correos válidos, repetidos, rol por defecto), con Vitest.
- **De punta a punta** (`e2e/`, Supabase local y Mailpit):
  1. Un admin crea el colegio, marca 7.º Matemáticas e invita a un docente y a una coordinadora.
  2. La coordinadora entra y aprueba.
  3. El admin pasa el colegio a `activo`. El docente entra por la invitación y crea su sección.
  4. Un estudiante se une y ve solo 7.º Matemáticas.
  5. La coordinadora oculta un tema y el estudiante deja de verlo.
  6. Un código de un colegio en `preparando` no acepta estudiantes.
  7. Una cuenta sin invitación no ve nada de ningún colegio y no puede crear secciones.

## Lo que se deja al constructor

- Los nombres exactos de las funciones, las rutas y los componentes, siguiendo los patrones del
  repositorio.
- Si los estados nuevos van como enum o como `text` con `check`. Con enum, la migración previa va
  aparte.
- Cómo se renderizan las tablas y la cuadrícula, con las piezas de interfaz existentes.
- El texto exacto del correo de invitación, en español y con usted.
- Cómo se dividen las migraciones, siempre que cada archivo corra solo en el editor SQL.
