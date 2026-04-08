import './style.css';
import state from './state.js';
import { supabase, getPool, getPoolPlayers, getMyPicks, getMyPropPicks, getAllPicks, getAllPropPicks, getPropResults } from './supabase.js';
import { getParam, show } from './utils.js';
import { showAuth, initAuth } from './pages/auth.js';
import { addGolfer, removeGolfer, refreshPot, createPool } from './pages/create.js';
import { showJoin, renderJoinPage, joinPoolFlow } from './pages/join.js';
import { startPicking, startPropPicking, submitPicks, renderTiers, toggleTier, togglePick } from './pages/picks.js';
import { showPropPicks, submitPropPicks, setPropPick } from './pages/propPicks.js';
import { showLeaderboard, loadLeaderboard } from './pages/leaderboard.js';
import { showSummary, copyLink, exportCSV } from './pages/summary.js';
import { showFun, showFunSection, showResultsEntry, saveResults, setResult, postTrash } from './pages/fun.js';

// ── STATIC BUTTON LISTENERS ───────────────────────────────────────────────────

document.getElementById('submit-picks-btn').addEventListener('click', submitPicks);
document.getElementById('submit-prop-picks-btn').addEventListener('click', submitPropPicks);
document.getElementById('create-btn').addEventListener('click', createPool);
document.getElementById('export-btn').addEventListener('click', exportCSV);
document.getElementById('trash-send-btn').addEventListener('click', postTrash);
document.getElementById('pick-back-btn').addEventListener('click', showJoin);
document.getElementById('prop-picks-back-btn').addEventListener('click', showJoin);
document.getElementById('copy-link-btn').addEventListener('click', function() { copyLink(this); });
document.getElementById('enter-results-btn').addEventListener('click', showResultsEntry);
document.getElementById('save-results-btn').addEventListener('click', saveResults);
document.getElementById('join-btn').addEventListener('click', joinPoolFlow);
document.getElementById('add-golfer-btn').addEventListener('click', addGolfer);

// Input / form listeners
document.getElementById('trash-msg-in').addEventListener('keydown', function(e) { if (e.key === 'Enter') postTrash(); });
document.getElementById('in-join-name').addEventListener('keydown', function(e) { if (e.key === 'Enter') joinPoolFlow(); });
document.getElementById('in-golfer-name').addEventListener('keydown', function(e) { if (e.key === 'Enter') addGolfer(); });
document.getElementById('in-buyin').addEventListener('input', refreshPot);
document.getElementById('in-prop-buyin').addEventListener('input', refreshPot);
document.getElementById('pick-search').addEventListener('input', renderTiers);

// ── NAV TAB DELEGATION ────────────────────────────────────────────────────────

document.addEventListener('click', function(e) {
  var tab = e.target.closest('[data-nav]');
  if (!tab) return;
  var navMap = { join: showJoin, leaderboard: showLeaderboard, summary: showSummary, fun: showFun };
  if (navMap[tab.dataset.nav]) navMap[tab.dataset.nav]();
});

// ── DYNAMIC CONTENT DELEGATION ────────────────────────────────────────────────

document.getElementById('name-list').addEventListener('click', function(e) {
  var btn = e.target.closest('[data-action]');
  if (!btn) return;
  if (btn.dataset.action === 'startPicking') startPicking();
  if (btn.dataset.action === 'startPropPicking') startPropPicking();
});

document.getElementById('golfer-tags').addEventListener('click', function(e) {
  var btn = e.target.closest('[data-action="removeGolfer"]');
  if (btn) removeGolfer(+btn.dataset.index);
});

document.getElementById('tier-list').addEventListener('click', function(e) {
  var btn = e.target.closest('[data-action]');
  if (!btn) return;
  if (btn.dataset.action === 'togglePick') togglePick(+btn.dataset.tier, btn.dataset.name);
  if (btn.dataset.action === 'toggleTier') toggleTier(+btn.dataset.tier);
});

document.getElementById('prop-pick-list').addEventListener('click', function(e) {
  var btn = e.target.closest('[data-action="setPropPick"]');
  if (btn) setPropPick(btn.dataset.propId, btn.dataset.val);
});

document.getElementById('results-form').addEventListener('click', function(e) {
  var btn = e.target.closest('[data-action="setResult"]');
  if (btn) setResult(btn.dataset.propId, btn.dataset.val);
});

document.getElementById('fsn-props').addEventListener('click', function() { showFunSection('props'); });
document.getElementById('fsn-rules').addEventListener('click', function() { showFunSection('rules'); });
document.getElementById('fsn-trash').addEventListener('click', function() { showFunSection('trash'); });

// ── BOOT ─────────────────────────────────────────────────────────────────────

initAuth();

async function loadPool(poolId) {
  const [rows, propRows, allPickRows, allPropRows, resultRows] = await Promise.all([
    getMyPicks(poolId),
    getMyPropPicks(poolId),
    getAllPicks(poolId),
    getAllPropPicks(poolId),
    getPropResults(poolId),
  ]);

  state.myPicks = {};
  state.myPicksSubmitted = rows.length === 6 && rows.every(r => r.submitted);
  rows.forEach(r => { state.myPicks[r.tier] = r.golfer_name; });

  state.myPropPicks = {};
  state.myPropPicksSubmitted = propRows.length > 0 && propRows.every(r => r.submitted);
  propRows.forEach(r => { state.myPropPicks[r.prop_id] = r.value; });

  state.allPicks = {};
  allPickRows.forEach(r => {
    if (!state.allPicks[r.user_id]) state.allPicks[r.user_id] = {};
    state.allPicks[r.user_id][r.tier] = r.golfer_name;
  });

  state.allPropPicks = {};
  allPropRows.forEach(r => {
    if (!state.allPropPicks[r.user_id]) state.allPropPicks[r.user_id] = {};
    state.allPropPicks[r.user_id][r.prop_id] = r.value;
  });

  state.propResults = {};
  resultRows.forEach(r => { state.propResults[r.prop_id] = r.value; });
}

async function init() {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;

    if (!session) {
      showAuth();
      return;
    }

    state.userId = session.user.id;
    state.userEmail = session.user.email;

    const shareToken = getParam('pool');

    if (shareToken) {
      state.shareToken = shareToken;
      const pool = await getPool(shareToken);
      state.poolId = pool.id;
      state.poolData = pool;

      const players = await getPoolPlayers(pool.id);
      state.players = players;
      const me = players.find(p => p.user_id === state.userId);

      if (me) {
        state.displayName = me.display_name;
        await loadPool(pool.id);
        renderJoinPage();
        show('pg-join');
      } else {
        // Signed in but not yet in this pool — show join form
        show('pg-pool-join');
      }
    } else {
      show('pg-create');
    }
  } catch(e) {
    console.error('init() failed:', e);
    show('pg-auth');
  }
}

// Handle auth state changes (magic link callback fires this)
// INITIAL_SESSION fires on page load — let init() handle that.
// Only re-run init on a new SIGNED_IN event (magic link click).
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN') {
    await init();
  }
});

init();
