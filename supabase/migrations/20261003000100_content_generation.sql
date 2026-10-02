-- Phase 2: generated study material and practice items.

-- Result of the independent review pass on each material (problems found, model, prompt), so a
-- reviewer sees why something was held back and students only get material that passed.
alter table public.materials add column verification jsonb not null default '{}';

-- Español reading comprehension: literal / inferential / critical (SPEC §8). Lets the teacher
-- panel report inference separately, the gap the Estado de la Educación points at.
alter table public.items add column reading_level text
  check (reading_level in ('literal', 'inferencial', 'critica'));
grant select (reading_level) on public.items to anon, authenticated;

-- Answer keys are not readable through the API (see rls.sql). Reviewers need them to judge an
-- item, so they get them through this function, which checks the role itself.
create or replace function public.review_items(p_unit_id uuid)
returns setof public.items
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_reviewer() then
    raise exception 'only reviewers can read answer keys' using errcode = '42501';
  end if;
  return query
    select * from public.items i where i.unit_id = p_unit_id order by i.created_at, i.id;
end;
$$;
revoke all on function public.review_items(uuid) from public, anon;
grant execute on function public.review_items(uuid) to authenticated;
