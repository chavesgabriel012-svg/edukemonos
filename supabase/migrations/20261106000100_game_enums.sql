-- Fase 3 (docs/producto/gamificacion.md §6): new enum values for the mini-games.
--
-- Its own migration on purpose: Postgres does not allow using a new enum value in the same
-- transaction that adds it, and both the Supabase SQL editor and the tests run each file as one
-- transaction. Apply this file first, then 20261106000200_games.sql.

-- Answers given inside a game count for mastery like practice, labelled with where they came from.
alter type public.attempt_context add value if not exists 'game';

-- One kind per fixed mechanic. The ghost race reuses single_choice and game_fill pieces.
alter type public.item_kind add value if not exists 'game_pairs';
alter type public.item_kind add value if not exists 'game_order';
alter type public.item_kind add value if not exists 'game_fill';
alter type public.item_kind add value if not exists 'game_find_error';
