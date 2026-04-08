-- ── TABLES ───────────────────────────────────────────────────────────────────

create table pools (
  id                uuid primary key default gen_random_uuid(),
  share_token       text unique not null default substr(md5(random()::text), 1, 10),
  created_by        uuid references auth.users not null,
  buyin             int not null default 20,
  prop_buyin        int not null default 10,
  masters_locked_at timestamptz not null default '2026-04-09T12:00:00Z',
  props_locked_at   timestamptz not null default '2026-04-12T14:00:00Z',
  created_at        timestamptz default now()
);

create table pool_players (
  pool_id         uuid references pools not null,
  user_id         uuid references auth.users not null,
  display_name    text not null,
  is_commissioner bool default false,
  primary key (pool_id, user_id)
);

create table picks (
  id          uuid primary key default gen_random_uuid(),
  pool_id     uuid references pools not null,
  user_id     uuid references auth.users not null,
  tier        int not null,
  golfer_name text,
  submitted   bool default false,
  updated_at  timestamptz default now(),
  unique (pool_id, user_id, tier)
);

create table prop_picks (
  id        uuid primary key default gen_random_uuid(),
  pool_id   uuid references pools not null,
  user_id   uuid references auth.users not null,
  prop_id   text not null,
  value     text,
  submitted bool default false,
  unique (pool_id, user_id, prop_id)
);

create table prop_results (
  pool_id uuid references pools not null,
  prop_id text not null,
  value   text not null,
  primary key (pool_id, prop_id)
);

create table trash (
  id         uuid primary key default gen_random_uuid(),
  pool_id    uuid references pools not null,
  user_id    uuid references auth.users not null,
  text       text not null,
  created_at timestamptz default now()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table pools        enable row level security;
alter table pool_players enable row level security;
alter table picks        enable row level security;
alter table prop_picks   enable row level security;
alter table prop_results enable row level security;
alter table trash        enable row level security;

-- pools
create policy "pools: read if member" on pools for select using (
  exists (select 1 from pool_players where pool_id = pools.id and user_id = auth.uid())
);
create policy "pools: insert own" on pools for insert with check (created_by = auth.uid());

-- pool_players
create policy "pool_players: read if member" on pool_players for select using (
  exists (select 1 from pool_players pp2 where pp2.pool_id = pool_players.pool_id and pp2.user_id = auth.uid())
);
create policy "pool_players: insert if commissioner" on pool_players for insert with check (
  exists (select 1 from pools where id = pool_players.pool_id and created_by = auth.uid())
);
create policy "pool_players: self join" on pool_players for insert with check (
  user_id = auth.uid()
);

-- picks: always see your own; see others only after you've submitted all 6
create policy "picks: read own" on picks for select using (
  user_id = auth.uid()
);
create policy "picks: read others after submitted" on picks for select using (
  exists (
    select 1 from picks p2
    where p2.pool_id = picks.pool_id
      and p2.user_id = auth.uid()
      and p2.submitted = true
    having count(*) = 6
  )
);
create policy "picks: write own before lock" on picks for all using (
  user_id = auth.uid()
) with check (
  user_id = auth.uid()
  and submitted = false
  and exists (select 1 from pools where id = picks.pool_id and masters_locked_at > now())
);
-- allow the submit action (flipping submitted to true)
create policy "picks: submit own" on picks for update using (
  user_id = auth.uid()
);

-- prop_picks: same blind pattern
create policy "prop_picks: read own" on prop_picks for select using (
  user_id = auth.uid()
);
create policy "prop_picks: read others after submitted" on prop_picks for select using (
  exists (
    select 1 from prop_picks pp2
    where pp2.pool_id = prop_picks.pool_id
      and pp2.user_id = auth.uid()
      and pp2.submitted = true
    having count(*) = 10
  )
);
create policy "prop_picks: write own before lock" on prop_picks for all using (
  user_id = auth.uid()
) with check (
  user_id = auth.uid()
  and submitted = false
  and exists (select 1 from pools where id = prop_picks.pool_id and props_locked_at > now())
);
create policy "prop_picks: submit own" on prop_picks for update using (
  user_id = auth.uid()
);

-- prop_results
create policy "prop_results: read if member" on prop_results for select using (
  exists (select 1 from pool_players where pool_id = prop_results.pool_id and user_id = auth.uid())
);
create policy "prop_results: commissioner write" on prop_results for all using (
  exists (select 1 from pools where id = prop_results.pool_id and created_by = auth.uid())
) with check (
  exists (select 1 from pools where id = prop_results.pool_id and created_by = auth.uid())
);

-- trash
create policy "trash: read if member" on trash for select using (
  exists (select 1 from pool_players where pool_id = trash.pool_id and user_id = auth.uid())
);
create policy "trash: write if member" on trash for insert with check (
  user_id = auth.uid()
  and exists (select 1 from pool_players where pool_id = trash.pool_id and user_id = auth.uid())
);
