alter table public.pets
  add column if not exists temperament text;

-- One-time backfill for pets created before temperament existed: each gets
-- an independent uniform-random pick from the same 5-value pool used for
-- new pets (see server/petTemperament.js), not a fixed default — so
-- existing pets aren't all lumped into one temperament.
update public.pets
set temperament = (array['playful', 'curious', 'gentle', 'sleepy', 'foodie'])[floor(random() * 5 + 1)]
where temperament is null;

-- Only safe once every row has been backfilled above.
alter table public.pets
  alter column temperament set not null;
