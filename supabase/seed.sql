-- Catalog data. Adding I/II Ciclo or Diversificada later is just more rows here.
insert into public.cycles (id, name, sort) values
  ('III', 'III Ciclo', 3)
on conflict (id) do update set name = excluded.name, sort = excluded.sort;

insert into public.grades (id, cycle_id, name, sort) values
  (7, 'III', 'Sétimo año', 7),
  (8, 'III', 'Octavo año', 8),
  (9, 'III', 'Noveno año', 9)
on conflict (id) do update set cycle_id = excluded.cycle_id, name = excluded.name, sort = excluded.sort;

-- Order = SPEC §16 subject priority. `available` flips to true when content is published.
-- 'civica': the formal-education subject is "Educación Cívica"; DGEC (Educación Abierta)
-- calls it "Formación Ciudadana". Display name pending the founder's decision (PLAN.md Q2).
insert into public.subjects (id, name, sort, available) values
  ('espanol', 'Español', 1, false),
  ('matematicas', 'Matemáticas', 2, false),
  ('ciencias', 'Ciencias', 3, false),
  ('estudios_sociales', 'Estudios Sociales', 4, false),
  ('ingles', 'Inglés', 5, false),
  ('civica', 'Educación Cívica', 6, false)
on conflict (id) do update set name = excluded.name, sort = excluded.sort;
