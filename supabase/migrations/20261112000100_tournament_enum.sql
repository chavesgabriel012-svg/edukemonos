-- Fase 4 (docs/producto/gamificacion.md §7): answers given in the Friday tournament.
--
-- Its own migration on purpose: Postgres does not allow using a new enum value in the same
-- transaction that adds it. Apply this file first, then 20261112000200_tournament.sql.
alter type public.attempt_context add value if not exists 'tournament';
