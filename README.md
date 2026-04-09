# The Darizona Masters

Private Masters pool app for a single group. Runs as a static Vite app with Supabase Postgres for persistence.

## What changed

- PIN-only login (4 digits per participant)
- Single pool (no create/join UI)
- Supabase Auth not used
- RLS disabled

---

## Setup

### 1) Supabase tables + access

Run the SQL below in Supabase (SQL editor):

```sql
-- add PIN column
alter table pool_players add column if not exists pin text;

-- drop auth.users foreign keys if still present
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'pools_created_by_fkey') then
    alter table pools drop constraint pools_created_by_fkey;
  end if;
  if exists (select 1 from pg_constraint where conname = 'pool_players_user_id_fkey') then
    alter table pool_players drop constraint pool_players_user_id_fkey;
  end if;
  if exists (select 1 from pg_constraint where conname = 'picks_user_id_fkey') then
    alter table picks drop constraint picks_user_id_fkey;
  end if;
  if exists (select 1 from pg_constraint where conname = 'prop_picks_user_id_fkey') then
    alter table prop_picks drop constraint prop_picks_user_id_fkey;
  end if;
  if exists (select 1 from pg_constraint where conname = 'trash_user_id_fkey') then
    alter table trash drop constraint trash_user_id_fkey;
  end if;
end $$;

-- allow non-auth user ids
alter table pools alter column created_by drop not null;

-- disable RLS
alter table pools        disable row level security;
alter table pool_players disable row level security;
alter table picks        disable row level security;
alter table prop_picks   disable row level security;
alter table prop_results disable row level security;
alter table trash        disable row level security;

-- allow anon access
grant usage on schema public to anon;
grant select, insert, update, delete on all tables in schema public to anon;
alter default privileges in schema public grant select, insert, update, delete on tables to anon;
```

### 2) Seed the pool + players

```sql
begin;

truncate table pools cascade;

with new_pool as (
  insert into pools (buyin, prop_buyin)
  values (20, 10)
  returning id, share_token
),
players(display_name, pin) as (
  values
    ('Jason','9945'),
    ('Fleisch','8251'),
    ('Bridezilla','4405'),
    ('Daniel','7594'),
    ('Kevin','7274'),
    ('Danny R','4223'),
    ('Willjay','8685'),
    ('Babst','3798'),
    ('Grega','2151'),
    ('Joshua','9004'),
    ('Charlie','1080'),
    ('Hageman','9663'),
    ('Rabie','1777'),
    ('Dave B','9179'),
    ('Geno','0519')
)
insert into pool_players (pool_id, user_id, display_name, pin)
select new_pool.id, gen_random_uuid(), players.display_name, players.pin
from new_pool, players;

select share_token from pools limit 1;

commit;
```

If `gen_random_uuid()` errors once, run:

```sql
create extension if not exists pgcrypto;
```

### 3) Run locally

```bash
npm install
npm run dev
```

Open:

```
http://localhost:5173/?pool=YOUR_TOKEN
```

Everyone logs in with their 4-digit PIN.

---

## Notes

- Props dropdown uses the same list as pool participants.
- Picks lock times are in `src/constants.js`.
- PIN auth is intentionally lightweight. Do not use for real security.
