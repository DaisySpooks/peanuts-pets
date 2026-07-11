-- Passive decay must run on its own clock, separate from `updated_at`
-- (which care actions and admin edits legitimately touch for unrelated
-- reasons). Add a dedicated `last_decay_at` column, and widen the three
-- care stat columns to numeric so fractional decay isn't discarded between
-- reads.

alter table public.pets
  add column if not exists last_decay_at timestamptz;

-- Widen integer stat columns to numeric so partial-day decay can persist
-- fractional values instead of being rounded away on every write. Existing
-- integer values convert losslessly.
alter table public.pets
  alter column hunger type numeric(6, 3) using hunger::numeric(6, 3),
  alter column cleanliness type numeric(6, 3) using cleanliness::numeric(6, 3),
  alter column happiness type numeric(6, 3) using happiness::numeric(6, 3);

alter table public.pets
  alter column hunger set default 78,
  alter column cleanliness set default 86,
  alter column happiness set default 92;

-- Backfill: start every existing pet's decay clock from the last time its
-- record actually changed (falling back to creation time), so no pet gets
-- hit with a huge one-time decay the moment this ships.
update public.pets
set last_decay_at = coalesce(last_decay_at, updated_at, created_at, now())
where last_decay_at is null;

alter table public.pets
  alter column last_decay_at set not null,
  alter column last_decay_at set default now();
