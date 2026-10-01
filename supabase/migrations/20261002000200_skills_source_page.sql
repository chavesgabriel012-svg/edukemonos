-- Page of the official document where each skill appears, so reviewer edits can be
-- re-verified verbatim against that page.
alter table public.skills add column source_page integer check (source_page > 0);
