-- Consola del equipo Eduka, tarea 1 (docs/superpowers/specs/2026-11-19-consola-admin-design.md, «Datos»):
--   * Cada colegio tiene un estado, un presupuesto mensual de IA y un idioma.
--   * Qué grados y materias ofrece cada colegio, qué temas ocultó, a quién invitó.
--   * El gasto de IA se atribuye a un colegio.
--   * El contenido propio de un colegio (curriculum_sources.institution_id) solo lo lee su gente.
--   * Bitácora de lo que hace el equipo Eduka en la consola.
-- Todo con RLS y sin permisos de escritura directos para anon ni authenticated: las escrituras
-- pasan por funciones (tareas siguientes) o por service_role.

-- ---------------------------------------------------------------------------
-- institutions
-- ---------------------------------------------------------------------------
alter table public.institutions
  add column status text not null default 'preparando' check (status in ('preparando', 'activo', 'pausado')),
  add column ai_monthly_budget_usd numeric check (ai_monthly_budget_usd >= 0),   -- null = sin tope
  add column language text not null default 'es' check (language ~ '^[a-z]{2}$');

-- Los colegios que ya existen siguen funcionando: cuando los códigos de grupo pasen a exigir un
-- colegio activo, los que ya están en producción no deben dejar de aceptar estudiantes. Los nuevos
-- nacen en 'preparando' (el default).
update public.institutions set status = 'activo';

-- ---------------------------------------------------------------------------
-- Funciones de identidad: a qué colegio pertenece una persona
-- ---------------------------------------------------------------------------
-- El colegio del grupo o de la sección a la que el estudiante se unió más recientemente.
create function private.student_institution(p_student uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select t.institution_id
  from (
    select g.institution_id, gm.joined_at
    from public.group_members gm
    join public.groups g on g.id = gm.group_id
    where gm.student_id = p_student
    union all
    select coalesce(s.institution_id, g.institution_id), sm.joined_at
    from public.section_members sm
    join public.sections s on s.id = sm.section_id
    left join public.groups g on g.id = s.group_id
    where sm.student_id = p_student
  ) t
  where t.institution_id is not null
  order by t.joined_at desc
  limit 1
$$;

-- Primero la de estudiante; si no, la membresía de colegio más reciente.
create function private.person_institution(p_uid uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    private.student_institution(p_uid),
    (select m.institution_id from public.institution_members m
     where m.profile_id = p_uid order by m.created_at desc limit 1)
  )
$$;

-- Coordinación del colegio: miembro con rol admin. A diferencia de is_institution_admin(), NO cuenta
-- a los administradores de la plataforma: el equipo Eduka no aprueba en nombre del colegio.
create function private.is_school_coordinator(p_institution uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.institution_members m
    where m.institution_id = p_institution
      and m.profile_id = (select auth.uid())
      and m.role = 'admin'
  )
$$;

-- ---------------------------------------------------------------------------
-- Separación del contenido: institution_id null = catálogo común (MEP)
-- ---------------------------------------------------------------------------
alter table public.curriculum_sources
  add column institution_id uuid references public.institutions (id) on delete cascade;
create index curriculum_sources_institution_idx on public.curriculum_sources (institution_id)
  where institution_id is not null;

-- Verdadera si la fuente es común, si la persona es miembro del colegio de la fuente, si es
-- estudiante de ese colegio o si es revisora.
create function private.can_read_source(p_source uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.is_reviewer() or exists (
    select 1 from public.curriculum_sources s
    where s.id = p_source
      and (
        s.institution_id is null
        or exists (
          select 1 from public.institution_members m
          where m.institution_id = s.institution_id and m.profile_id = (select auth.uid())
        )
        or private.student_institution((select auth.uid())) = s.institution_id
      )
  )
$$;

create function private.unit_source_id(p_unit uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$ select source_id from public.curriculum_units where id = p_unit $$;

drop policy sources_read on public.curriculum_sources;
create policy sources_read on public.curriculum_sources for select to anon, authenticated
  using (private.can_read_source(id));

drop policy units_read_published on public.curriculum_units;
create policy units_read_published on public.curriculum_units for select to anon, authenticated
  using ((status = 'published' and private.can_read_source(source_id)) or private.is_reviewer());

drop policy materials_read on public.materials;
create policy materials_read on public.materials for select to anon, authenticated
  using (
    (status = 'published' and private.unit_is_published(unit_id)
      and private.can_read_source(private.unit_source_id(unit_id)))
    or private.is_reviewer()
  );

drop policy items_read on public.items;
create policy items_read on public.items for select to anon, authenticated
  using (
    (status = 'published' and private.unit_is_published(unit_id)
      and private.can_read_source(private.unit_source_id(unit_id)))
    or private.is_reviewer()
  );

create function private.skill_source_id(p_skill uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select u.source_id from public.skills k join public.curriculum_units u on u.id = k.unit_id where k.id = p_skill
$$;

drop policy skills_read on public.skills;
create policy skills_read on public.skills for select to anon, authenticated
  using (
    (private.unit_is_published(unit_id) and private.can_read_source(private.unit_source_id(unit_id)))
    or private.is_reviewer()
  );

drop policy skill_prereq_read on public.skill_prerequisites;
create policy skill_prereq_read on public.skill_prerequisites for select to anon, authenticated
  using (
    (private.can_read_source(private.skill_source_id(skill_id))
      and private.can_read_source(private.skill_source_id(prerequisite_id)))
    or private.is_reviewer()
  );

-- ---------------------------------------------------------------------------
-- curriculum_units.published_at
-- ---------------------------------------------------------------------------
alter table public.curriculum_units add column published_at timestamptz;
update public.curriculum_units set published_at = coalesce(reviewed_at, updated_at) where status = 'published';

create function private.set_unit_published_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end;
$$;
create trigger curriculum_units_published_at
  before insert or update on public.curriculum_units
  for each row execute function private.set_unit_published_at();

-- ---------------------------------------------------------------------------
-- Qué ofrece cada colegio, qué temas ocultó, a quién invitó
-- ---------------------------------------------------------------------------
create table public.institution_offerings (
  institution_id uuid not null references public.institutions (id) on delete cascade,
  grade_id smallint not null references public.grades (id),
  subject_id text not null references public.subjects (id),
  status text not null default 'pendiente' check (status in ('pendiente', 'aprobado', 'retirado')),
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  seen_through timestamptz,                 -- hasta cuándo vio la coordinación los temas nuevos
  created_at timestamptz not null default now(),
  primary key (institution_id, grade_id, subject_id)
);

create table public.institution_hidden_units (
  institution_id uuid not null references public.institutions (id) on delete cascade,
  unit_id uuid not null references public.curriculum_units (id) on delete cascade,
  hidden_by uuid references public.profiles (id) on delete set null,
  hidden_at timestamptz not null default now(),
  primary key (institution_id, unit_id)
);

create table public.institution_invites (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  email text not null check (email = lower(btrim(email))),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 120),
  role public.institution_role not null default 'teacher',
  invited_by uuid references public.profiles (id) on delete set null,
  invited_at timestamptz not null default now(),
  accepted_profile_id uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz
);
create unique index institution_invites_open_idx on public.institution_invites (institution_id, email)
  where revoked_at is null;

-- ---------------------------------------------------------------------------
-- Gasto de IA por colegio
-- ---------------------------------------------------------------------------
alter table public.ai_usage add column institution_id uuid references public.institutions (id) on delete set null;
create index ai_usage_institution_idx on public.ai_usage (institution_id, created_at desc);

-- Si viene la sección, gana el colegio de esa sección; si no, el de quien la usó.
create function private.ai_usage_institution()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.institution_id is null then
    new.institution_id := coalesce(
      (select coalesce(s.institution_id, g.institution_id)
       from public.sections s left join public.groups g on g.id = s.group_id
       where s.id = new.section_id),
      private.person_institution(new.actor_id)
    );
  end if;
  return new;
end;
$$;
create trigger ai_usage_institution
  before insert on public.ai_usage
  for each row execute function private.ai_usage_institution();

-- Lo que ya se gastó también queda atribuido.
update public.ai_usage u
set institution_id = coalesce(
  (select coalesce(s.institution_id, g.institution_id)
   from public.sections s left join public.groups g on g.id = s.group_id
   where s.id = u.section_id),
  private.person_institution(u.actor_id)
)
where u.actor_id is not null or u.section_id is not null;

-- ---------------------------------------------------------------------------
-- Bitácora del equipo Eduka
-- ---------------------------------------------------------------------------
create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,                            -- sin llave foránea: la bitácora no cambia si se borra la cuenta
  institution_id uuid references public.institutions (id) on delete set null,
  action text not null check (char_length(action) between 1 and 80),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);

-- ---------------------------------------------------------------------------
-- RLS: lectura por política, ninguna escritura directa
-- ---------------------------------------------------------------------------
alter table public.institution_offerings enable row level security;
alter table public.institution_hidden_units enable row level security;
alter table public.institution_invites enable row level security;
alter table public.admin_audit_log enable row level security;

revoke all on public.institution_offerings, public.institution_hidden_units,
              public.institution_invites, public.admin_audit_log from anon, authenticated;
grant select on public.institution_offerings, public.institution_hidden_units,
                public.institution_invites, public.admin_audit_log to authenticated;

create policy offerings_read on public.institution_offerings for select to authenticated
  using (private.institution_role(institution_id) is not null or private.is_admin());
create policy hidden_units_read on public.institution_hidden_units for select to authenticated
  using (private.institution_role(institution_id) is not null or private.is_admin());
create policy invites_read on public.institution_invites for select to authenticated
  using (private.is_school_coordinator(institution_id) or private.is_admin());
create policy audit_log_read on public.admin_audit_log for select to authenticated
  using (private.is_admin());

-- ---------------------------------------------------------------------------
-- Funciones security definer que entregan contenido: también exigen la fuente
-- ---------------------------------------------------------------------------
-- Las políticas de arriba no alcanzan a las funciones que leen como dueño. Cada una de estas
-- mantiene su versión más reciente tal cual y solo agrega private.can_read_source() sobre la fuente
-- del tema. No se cambia private.unit_is_published(): quien no tiene auth.uid() (service_role, el
-- cierre del torneo) dejaría de verlo todo. Se reescribe desde pg_get_functiondef() para no copiar
-- a mano versiones largas; si algún patrón deja de encontrarse, la migración falla en vez de
-- dejar la función sin proteger.
--   check_answer, submit_attempt   califican un ítem y devuelven la clave y las explicaciones.
--   start_game_run                 devuelve enunciados y opciones de un tema.
--   tournament_questions           devuelve enunciados y opciones del torneo.
-- Revisadas y sin cambio: review_items (solo revisores), finish_diagnostic y finish_game_run
-- (solo leen intentos propios y no devuelven contenido), my_badges y verify_certificate (devuelven
-- el título de lo que ya se ganó), private.tournament_pool (la llama el cierre sin auth.uid(); el
-- filtro va en tournament_questions), tournament_topics, section_scope_skills y las demás de uso
-- interno (private.*, no devuelven contenido a quien llama).
do $do$
declare
  fn regprocedure;
  def text;
  patched text;
begin
  foreach fn in array array[
    'public.check_answer(uuid, smallint)'::regprocedure,
    'public.submit_attempt(uuid, smallint, text, integer, smallint, uuid, public.attempt_context, uuid)'::regprocedure,
    'public.start_game_run(uuid, text)'::regprocedure
  ] loop
    def := pg_get_functiondef(fn);
    patched := regexp_replace(
      def,
      'private\.unit_is_published\((i\.unit_id|p_unit)\)',
      '(private.unit_is_published(\1) and private.can_read_source(private.unit_source_id(\1)))',
      'g'
    );
    if patched = def then
      raise exception 'no unit_is_published() call found in %', fn;
    end if;
    execute patched;
  end loop;

  def := pg_get_functiondef('public.tournament_questions(uuid)'::regprocedure);
  patched := replace(
    def,
    'select p.id from private.tournament_pool(t.skill_ids) p(id)',
    'select p.id from private.tournament_pool(t.skill_ids) p(id)
      join public.items pi on pi.id = p.id
      where private.can_read_source(private.unit_source_id(pi.unit_id))'
  );
  if patched = def then
    raise exception 'tournament_questions: pool selection not found';
  end if;
  def := patched;
  patched := replace(
    def,
    'join public.items i on i.id = q.id',
    'join public.items i on i.id = q.id and private.can_read_source(private.unit_source_id(i.unit_id))'
  );
  if patched = def then
    raise exception 'tournament_questions: question join not found';
  end if;
  execute patched;
end;
$do$;
