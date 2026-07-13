create table if not exists public.pet_purchases (
  purchase_id uuid primary key default gen_random_uuid(),
  discord_user_id text not null,
  guild_id text not null,
  pet_type text not null check (pet_type in ('axolotl', 'betta', 'turtle')),
  pet_name text not null,
  price_points integer not null check (price_points = 20),
  status text not null check (status in ('PENDING', 'PAID', 'PAYMENT_FAILED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz null,
  payment_failed_at timestamptz null
);

create index if not exists pet_purchases_discord_user_id_idx
  on public.pet_purchases (discord_user_id);

alter table public.pet_purchases enable row level security;
