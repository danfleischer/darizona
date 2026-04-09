import { createClient } from '@supabase/supabase-js';
import state from './state.js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Ensure a single client instance across Vite HMR reloads.
const globalScope = typeof window !== 'undefined' ? window : globalThis;

function inProcessLock(name, acquireTimeout, fn) {
  const locks = globalScope.__darizonaAuthLocks || (globalScope.__darizonaAuthLocks = new Map());
  const prev = locks.get(name) || Promise.resolve();
  let release;
  const next = new Promise((res) => { release = res; });
  locks.set(name, prev.then(() => next));

  let timeoutId;
  const timeoutPromise = acquireTimeout >= 0
    ? new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          const err = new Error('Lock acquire timeout');
          err.isAcquireTimeout = true;
          reject(err);
        }, acquireTimeout);
      })
    : null;

  const waitForTurn = timeoutPromise ? Promise.race([prev, timeoutPromise]) : prev;

  return waitForTurn.then(async () => {
    if (timeoutId) clearTimeout(timeoutId);
    try {
      return await fn();
    } finally {
      release();
      if (locks.get(name) === next) locks.delete(name);
    }
  }, (err) => {
    // Timed out before acquiring the lock; clean up our queue entry.
    release();
    if (locks.get(name) === next) locks.delete(name);
    if (timeoutId) clearTimeout(timeoutId);
    throw err;
  });
}

if (!globalScope.__darizonaSupabase) {
  globalScope.__darizonaSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      lock: inProcessLock,
    },
  });
}
export const supabase = globalScope.__darizonaSupabase;

// Use state.userId instead of a network round-trip to getUser() on every call.
function uid() {
  if (!state.userId) throw new Error('Not signed in');
  return state.userId;
}

// ── POOL ─────────────────────────────────────────────────────────────────────

export async function getPool(shareToken) {
  const { data, error } = await supabase
    .from('pools')
    .select('*')
    .eq('share_token', shareToken)
    .single();
  if (error) throw error;
  return data;
}

// ── POOL PLAYERS ─────────────────────────────────────────────────────────────

export async function getPoolPlayers(poolId) {
  const { data, error } = await supabase
    .from('pool_players')
    .select('*')
    .eq('pool_id', poolId);
  if (error) throw error;
  return data;
}

export async function getPoolPlayerByPin(poolId, pin) {
  const { data, error } = await supabase
    .from('pool_players')
    .select('*')
    .eq('pool_id', poolId)
    .eq('pin', pin)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ── PICKS ─────────────────────────────────────────────────────────────────────

export async function getMyPicks(poolId) {
  const { data, error } = await supabase
    .from('picks')
    .select('*')
    .eq('pool_id', poolId)
    .eq('user_id', uid());
  if (error) throw error;
  return data;
}

export async function getAllPicks(poolId) {
  const { data, error } = await supabase
    .from('picks')
    .select('user_id, tier, golfer_name, submitted')
    .eq('pool_id', poolId);
  if (error) throw error;
  return data;
}

export async function savePickDraft(poolId, tier, golferName) {
  const { error } = await supabase
    .from('picks')
    .upsert(
      { pool_id: poolId, user_id: uid(), tier, golfer_name: golferName, submitted: false, updated_at: new Date().toISOString() },
      { onConflict: 'pool_id,user_id,tier' }
    );
  if (error) throw error;
}

export async function submitPicks(poolId) {
  const { error } = await supabase
    .from('picks')
    .update({ submitted: true })
    .eq('pool_id', poolId)
    .eq('user_id', uid());
  if (error) throw error;
}

// ── PROP PICKS ────────────────────────────────────────────────────────────────

export async function getMyPropPicks(poolId) {
  const { data, error } = await supabase
    .from('prop_picks')
    .select('*')
    .eq('pool_id', poolId)
    .eq('user_id', uid());
  if (error) throw error;
  return data;
}

export async function getAllPropPicks(poolId) {
  const { data, error } = await supabase
    .from('prop_picks')
    .select('user_id, prop_id, value, submitted')
    .eq('pool_id', poolId);
  if (error) throw error;
  return data;
}

export async function savePropPickDraft(poolId, propId, value) {
  const { error } = await supabase
    .from('prop_picks')
    .upsert(
      { pool_id: poolId, user_id: uid(), prop_id: propId, value: String(value), submitted: false },
      { onConflict: 'pool_id,user_id,prop_id' }
    );
  if (error) throw error;
}

export async function submitPropPicks(poolId) {
  const { error } = await supabase
    .from('prop_picks')
    .update({ submitted: true })
    .eq('pool_id', poolId)
    .eq('user_id', uid());
  if (error) throw error;
}

// ── PROP RESULTS ──────────────────────────────────────────────────────────────

export async function getPropResults(poolId) {
  const { data, error } = await supabase
    .from('prop_results')
    .select('*')
    .eq('pool_id', poolId);
  if (error) throw error;
  return data;
}

export async function savePropResults(poolId, results) {
  const rows = Object.entries(results).map(([prop_id, value]) => ({
    pool_id: poolId, prop_id, value: String(value),
  }));
  const { error } = await supabase
    .from('prop_results')
    .upsert(rows, { onConflict: 'pool_id,prop_id' });
  if (error) throw error;
}

// ── TRASH ─────────────────────────────────────────────────────────────────────

export async function getTrash(poolId) {
  const { data, error } = await supabase
    .from('trash')
    .select('id, text, created_at, pool_players(display_name)')
    .eq('pool_id', poolId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return data;
}

export async function postTrashMessage(poolId, text) {
  const { error } = await supabase
    .from('trash')
    .insert({ pool_id: poolId, user_id: uid(), text });
  if (error) throw error;
}
