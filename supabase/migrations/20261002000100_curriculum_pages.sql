-- Extracted text of each page of an official program, so /revisar can show the source next to
-- each unit and re-check edited excerpts verbatim. Reviewers only: it is the full document text.
create table public.curriculum_pages (
  source_id uuid not null references public.curriculum_sources (id) on delete cascade,
  page integer not null check (page > 0),
  text text not null,
  extracted_with text not null,          -- e.g. 'pdftotext 24.02 (default mode)'
  extracted_at timestamptz not null default now(),
  primary key (source_id, page)
);

alter table public.curriculum_pages enable row level security;

create policy pages_read_reviewers on public.curriculum_pages for select to authenticated
  using (private.is_reviewer());
create policy pages_write_admin on public.curriculum_pages for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
revoke all on public.curriculum_pages from anon;
