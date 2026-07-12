alter table public.pets
  add column if not exists colour text;

update public.pets
set colour = case pet_type
  when 'axolotl' then 'pink'
  when 'turtle' then 'green'
  when 'betta' then 'blue'
  else colour
end
where colour is null;

-- Only safe once every row has been backfilled above — if pet_type ever
-- contains a value outside axolotl/turtle/betta, this will fail loudly
-- instead of silently leaving a null, which is the desired behavior.
alter table public.pets
  alter column colour set not null;
