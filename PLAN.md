# Darizona — Supabase Migration Plan

## Goal

Migrate from Firebase Realtime Database to Supabase (Postgres + Auth) to enable:
1. **You can't edit others' picks** — enforced at the DB via RLS, not just the client
2. **Blind picks** — you can't see others' submitted picks until you've submitted your own (RLS-enforced)
3. **No lost picks** — submitted picks are locked (`submitted = true`), never overwritten
4. **Magic link auth** — no passwords; players click an email link to sign in as themselves

The Vite SPA structure stays. Only `firebase.js` is fully replaced; the rest is incremental changes.

---

## New URL scheme

Old: `?fb=https://project.firebaseio.com&pool=pool_1234567`  
New: `?pool=<share_token>` (short opaque token, no credentials in URL)

---

## Schema

```sql
-- pools: one per commissioner setup
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

-- pool_players: maps auth users → display name within a pool
create table pool_players (
  pool_id      uuid references pools not null,
  user_id      uuid references auth.users not null,
  display_name text not null,
  is_commissioner bool default false,
  primary key (pool_id, user_id)
);

-- picks: one row per tier per player (upserted on save, submitted=true on final submit)
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

-- prop_picks: one row per prop per player
create table prop_picks (
  id        uuid primary key default gen_random_uuid(),
  pool_id   uuid references pools not null,
  user_id   uuid references auth.users not null,
  prop_id   text not null,
  value     text,
  submitted bool default false,
  unique (pool_id, user_id, prop_id)
);

-- prop_results: commissioner-entered after the round
create table prop_results (
  pool_id uuid references pools not null,
  prop_id text not null,
  value   text not null,
  primary key (pool_id, prop_id)
);

-- trash: trash talk messages
create table trash (
  id         uuid primary key default gen_random_uuid(),
  pool_id    uuid references pools not null,
  user_id    uuid references auth.users not null,
  text       text not null,
  created_at timestamptz default now()
);
```

---

## RLS policies

```sql
-- Enable RLS on all tables
alter table pools enable row level security;
alter table pool_players enable row level security;
alter table picks enable row level security;
alter table prop_picks enable row level security;
alter table prop_results enable row level security;
alter table trash enable row level security;

-- pools: readable by anyone in the pool; writable only by creator
create policy "pools: read if member" on pools for select using (
  exists (select 1 from pool_players where pool_id = pools.id and user_id = auth.uid())
);
create policy "pools: insert own" on pools for insert with check (created_by = auth.uid());

-- pool_players: readable by pool members; commissioner can insert
create policy "pool_players: read if member" on pool_players for select using (
  exists (select 1 from pool_players pp2 where pp2.pool_id = pool_players.pool_id and pp2.user_id = auth.uid())
);
create policy "pool_players: commissioner can insert" on pool_players for insert with check (
  exists (select 1 from pools where id = pool_players.pool_id and created_by = auth.uid())
);

-- picks: blind until you've submitted all 6 of your own
create policy "picks: read own always" on picks for select using (user_id = auth.uid());
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
  and exists (
    select 1 from pools where id = picks.pool_id and masters_locked_at > now()
  )
);

-- prop_picks: same blind pattern, based on all 10 props submitted
create policy "prop_picks: read own always" on prop_picks for select using (user_id = auth.uid());
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
  and exists (
    select 1 from pools where id = prop_picks.pool_id and props_locked_at > now()
  )
);

-- prop_results: readable by pool members; writable by commissioner only
create policy "prop_results: read if member" on prop_results for select using (
  exists (select 1 from pool_players where pool_id = prop_results.pool_id and user_id = auth.uid())
);
create policy "prop_results: commissioner write" on prop_results for all using (
  exists (select 1 from pools where id = prop_results.pool_id and created_by = auth.uid())
);

-- trash: readable and writable by pool members
create policy "trash: read if member" on trash for select using (
  exists (select 1 from pool_players where pool_id = trash.pool_id and user_id = auth.uid())
);
create policy "trash: write if member" on trash for insert with check (
  user_id = auth.uid()
  and exists (select 1 from pool_players where pool_id = trash.pool_id and user_id = auth.uid())
);
```

---

## State changes

Remove from `state.js`:
- `fbUrl` — no longer needed (credentials not in URL)
- `setupList` — replaced by DB-driven player list

Add to `state.js`:
- `shareToken` — replaces `poolKey`
- `userId` — current auth user's UUID
- `userEmail` — for display
- `displayName` — current user's display name in this pool
- `poolId` — UUID from pools table (internal; URL uses share_token)

The `myPicks` shape changes from `{ t1: name, ..., t6: name }` to match the `picks` table rows. `myPropPicks` similarly.

---

## Migration passes

Each pass leaves a working (or at-parity) app.

### Pass 1 — Supabase project + schema
- Create Supabase project at supabase.com
- Run schema SQL in Supabase SQL editor
- Run RLS policy SQL
- Enable magic link auth in Supabase dashboard (Auth → Providers → Email, disable password login)
- Note down: project URL, anon public key
- Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env.local`
- Add `.env.local` to `.gitignore`
- **Test:** Supabase dashboard shows tables

### Pass 2 — Install SDK + create `src/supabase.js`
- `npm install @supabase/supabase-js`
- Create `src/supabase.js`: exports a configured Supabase client + helper functions that mirror the old firebase.js interface:
  - `getPool(shareToken)` → reads pools + pool_players
  - `savePicksDraft(poolId, tier, golferName)` → upserts picks with submitted=false
  - `submitPicks(poolId)` → sets all picks to submitted=true
  - `savePropPicksDraft(poolId, propId, value)` → upserts prop_picks
  - `submitPropPicks(poolId)` → sets all prop_picks to submitted=true
  - `savePropResults(poolId, results)` → upserts prop_results
  - `postTrashMessage(poolId, text)` → inserts trash row
  - `getLeaderboardData(poolId)` → fetches pool + all picks (respects RLS)
- Update `state.js` with new fields
- **Test:** can import supabase client without errors

### Pass 3 — Auth screen
- Create `src/pages/auth.js` with `showAuth()`, `sendMagicLink(email)`, `handleAuthCallback()`
- Add `pg-auth` page to `index.html`: email input + "Send magic link" button + "Check your email" confirmation state
- In `init()`: check `supabase.auth.getSession()` first; if no session check for `#access_token` in URL hash (Supabase magic link callback); if neither, show `pg-auth`
- `supabase.auth.onAuthStateChange` wires the rest of boot once session is confirmed
- Update `state.js`: populate `userId`, `userEmail` on session
- **Test:** can sign in via magic link, session persists on refresh

### Pass 4 — Pool creation (commissioner flow)
- Replace create page: add email column alongside player name inputs
- Commissioner enters name + email per player
- On "Create pool":
  1. Insert into `pools`
  2. For each player, call `supabase.auth.admin.inviteUserByEmail` — or simpler: insert into `pool_players` with their email, send a custom invite URL via Supabase Edge Function / just share the `?pool=<token>` link and players sign in themselves
  3. Share URL is now `?pool=<share_token>` only — no Firebase URL
- Remove `pg-setup` (Firebase URL entry) — no longer needed
- **Decision point**: invite-by-email vs. share link + self-signup. Share link is simpler to start.
- **Test:** pool created in Supabase dashboard, share URL works

### Pass 5 — Join page (auth-aware)
- Remove player-name picker entirely
- On load: look up `pool_players` for `userId` — this is their display name
- If user is not in `pool_players` for this pool (followed a share link for the first time): show "Join this pool" with name input → insert into `pool_players`
- Load their existing picks + prop_picks from Supabase
- **Test:** sign in, follow share link, join pool, see your name

### Pass 6 — Picks page (save draft + submit)
- `savePicks()` → upserts each tier as a draft row (`submitted=false`)
- Add **Submit picks** button (separate from Save): calls `submitPicks()` which sets `submitted=true` on all 6 rows
  - Confirmation dialog: "Once submitted, picks are locked. Continue?"
  - After submit: picks are read-only; button becomes "Submitted ✓"
- Leaderboard/summary reads: because of RLS, others' picks only appear once they've submitted
- **Test:** save draft → picks visible only to you; submit → picks visible to others who have also submitted

### Pass 7 — Prop picks page (same pattern as Pass 6)
- Same save draft + submit flow for prop_picks
- **Test:** submit props → visible to others who submitted

### Pass 8 — Leaderboard, summary, fun, trash
- Update all data fetches to use Supabase queries instead of `fbGet`
- `loadLeaderboard`: fetch picks for pool (RLS filters automatically), merge with ESPN scores
- `renderSummary`: fetch all submitted picks for pool
- `renderPropsView`: fetch prop_picks + prop_results
- `saveResults`: commissioner upserts to `prop_results`
- `loadTrash` / `postTrash`: read/write trash table
- **Test:** full flow end-to-end

### Pass 9 — Remove firebase.js + cleanup
- Delete `src/firebase.js`
- Remove Firebase references from `state.js`, `main.js`
- Remove `pg-setup` page from `index.html`
- Update CLAUDE.md + README
- `npm run build` — clean build
- **Full smoke test**: create pool → invite → join → draft picks → submit → see leaderboard → props → fun → trash → export CSV

---

## Files changed

| File | Change |
|---|---|
| `src/firebase.js` | Deleted |
| `src/supabase.js` | New — Supabase client + all DB helpers |
| `src/state.js` | Remove fbUrl/setupList, add shareToken/userId/displayName/poolId |
| `src/main.js` | Update imports, auth boot sequence |
| `src/pages/auth.js` | New — magic link auth screen |
| `src/pages/setup.js` | Deleted (no more Firebase URL setup) |
| `src/pages/create.js` | Add email field per player, insert to Supabase |
| `src/pages/join.js` | Remove name picker, auth-aware, self-join flow |
| `src/pages/picks.js` | Save draft + Submit (two actions) |
| `src/pages/propPicks.js` | Same as picks.js |
| `src/pages/leaderboard.js` | Supabase fetch |
| `src/pages/summary.js` | Supabase fetch |
| `src/pages/fun.js` | Supabase fetch + prop results save |
| `index.html` | Add `pg-auth`, remove `pg-setup`, tweak picks page |
| `.env.local` | New — Supabase URL + anon key (gitignored) |
| `README.md` | Update setup instructions |
| `CLAUDE.md` | Update module map |

---

## Gotchas

- **Supabase magic link redirect URL**: must be set in Supabase dashboard (Auth → URL Configuration → Site URL). Set to your GH Pages URL in prod, `http://localhost:5173` in dev.
- **RLS + anon key**: the anon key is safe to expose in the client — RLS is the security layer, not key secrecy. Never use the service role key in the browser.
- **`submitted=true` is permanent**: no UPDATE policy allows flipping it back. If a player submits early by mistake, commissioner can fix via Supabase dashboard.
- **Leaderboard before anyone submits**: show "No picks submitted yet" — same as current "No picks yet" state.
- **ESPN scores + Supabase**: ESPN fetch stays client-side; it's a public read-only API. No change.
- **`masters_locked_at` / `props_locked_at`**: stored per-pool in Supabase, not hardcoded in `constants.js`. Commissioner could override if needed.
- **share_token collision**: `substr(md5(random()), 1, 10)` gives ~10^12 combinations — fine for this use case.

---

## Future work (still not in scope)

- Real-time leaderboard updates via Supabase Realtime (replaces 90s polling)
- Commissioner PIN reset flow (currently requires Supabase dashboard)
- Multiple pools per user (dashboard view)
