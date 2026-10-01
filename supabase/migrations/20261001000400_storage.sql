-- Private bucket for the official PDFs. No storage.objects policies are created for it,
-- so only service_role (ingest scripts) can read or write. The public sees short excerpts
-- plus a link to the official MEP URL (pending confirmation of MEP reuse terms).
insert into storage.buckets (id, name, public)
values ('curriculum-sources', 'curriculum-sources', false)
on conflict (id) do nothing;
