import './style.css';
import state from './state.js';
import { getPool, getPoolPlayers, getMyPicks, getMyPropPicks, getAllPicks, getAllPropPicks, getPropResults } from './supabase.js';
import { getParam, show } from './utils.js';
import { showAuth, initAuth } from './pages/auth.js';
import { startPicking, submitPicks, renderPickPage, renderTiers, toggleTier, togglePick } from './pages/picks.js';
import { showPropPicks, submitPropPicks, setPropPick } from './pages/propPicks.js';
import { showLeaderboard, loadLeaderboard } from './pages/leaderboard.js';
import { showSummary, copyLink, exportCSV } from './pages/summary.js';
import { showFun, showFunSection, showResultsEntry, saveResults, setResult } from './pages/fun.js';

// ── STATIC BUTTON LISTENERS ───────────────────────────────────────────────────

const submitPicksBtn = document.getElementById('submit-picks-btn');
if (submitPicksBtn) submitPicksBtn.addEventListener('click', submitPicks);
const submitPropBtn = document.getElementById('submit-prop-picks-btn');
if (submitPropBtn) submitPropBtn.addEventListener('click', submitPropPicks);
const exportBtn = document.getElementById('export-btn');
if (exportBtn) exportBtn.addEventListener('click', exportCSV);
const pickBackBtn = document.getElementById('pick-back-btn');
if (pickBackBtn) pickBackBtn.addEventListener('click', showSummary);
const propBackBtn = document.getElementById('prop-picks-back-btn');
if (propBackBtn) propBackBtn.addEventListener('click', showSummary);
const copyLinkBtn = document.getElementById('copy-link-btn');
if (copyLinkBtn) copyLinkBtn.addEventListener('click', function() { copyLink(this); });
const enterResultsBtn = document.getElementById('enter-results-btn');
if (enterResultsBtn) enterResultsBtn.addEventListener('click', showResultsEntry);
const saveResultsBtn = document.getElementById('save-results-btn');
if (saveResultsBtn) saveResultsBtn.addEventListener('click', saveResults);

// Input / form listeners
const pickSearch = document.getElementById('pick-search');
if (pickSearch) pickSearch.addEventListener('input', renderTiers);

// ── NAV TAB DELEGATION ────────────────────────────────────────────────────────

document.addEventListener('click', function(e) {
  var tab = e.target.closest('[data-nav]');
  if (!tab) return;
  var navMap = { leaderboard: showLeaderboard, summary: showSummary, fun: showFun };
  if (navMap[tab.dataset.nav]) navMap[tab.dataset.nav]();
});

// ── DYNAMIC CONTENT DELEGATION ────────────────────────────────────────────────

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

// ── BOOT ─────────────────────────────────────────────────────────────────────

initAuth();
document.addEventListener('pin-login', function() { init(); });

function restoreLastPage() {
  const lastPage = localStorage.getItem("last_page");
  const allowed = new Set(["pg-leaderboard", "pg-summary", "pg-fun", "pg-pick", "pg-prop-picks"]);
  if (!allowed.has(lastPage)) {
    showSummary();
    return;
  }
  if (lastPage === "pg-leaderboard") return showLeaderboard();
  if (lastPage === "pg-summary") return showSummary();
  if (lastPage === "pg-fun") return showFun();
  if (lastPage === "pg-pick") { renderPickPage(); return show('pg-pick'); }
  if (lastPage === "pg-prop-picks") return showPropPicks();
  showSummary();
}

async function loadPool(poolId) {
  // Run sequentially to avoid concurrent auth refresh lock contention.
  const rows = await getMyPicks(poolId);
  const propRows = await getMyPropPicks(poolId);
  const allPickRows = await getAllPicks(poolId);
  const allPropRows = await getAllPropPicks(poolId);
  const resultRows = await getPropResults(poolId);

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

let initInFlight = null;

async function init() {
  if (initInFlight) return initInFlight;
  initInFlight = (async () => {
    try {
      const urlPool = getParam('pool');
      if (urlPool) {
        localStorage.setItem('last_pool_token', urlPool);
      }
      const shareToken = urlPool || localStorage.getItem('last_pool_token');
      if (!urlPool && shareToken) {
        const u = new URL(window.location.href);
        u.searchParams.set("pool", shareToken);
        window.history.replaceState({}, "", u.toString());
      }

      if (shareToken) {
        state.shareToken = shareToken;
        const pool = await getPool(shareToken);
        state.poolId = pool.id;
        state.poolData = pool;

        const savedPoolId = localStorage.getItem('pin_pool_id');
        const savedUserId = localStorage.getItem('pin_user_id');
        const savedName = localStorage.getItem('pin_display_name');
        if (!savedUserId || savedPoolId !== pool.id) {
          showAuth();
          return;
        }

        state.userId = savedUserId;
        state.userEmail = null;
        state.displayName = savedName || null;

        const players = await getPoolPlayers(pool.id);
        state.players = players;
        const me = players.find(p => p.user_id === state.userId);

        if (me) {
          state.displayName = me.display_name || state.displayName;
          await loadPool(pool.id);
          if (!state.myPicksSubmitted) {
            startPicking();
          } else if (!state.myPropPicksSubmitted) {
            showPropPicks();
          } else {
            showSummary();
          }
        } else {
          localStorage.removeItem('pin_user_id');
          localStorage.removeItem('pin_display_name');
          localStorage.removeItem('pin_pool_id');
          showAuth();
        }
      } else {
        showAuth();
      }
    } catch(e) {
      console.error('init() failed:', e);
      show('pg-auth');
    }
  })();

  try {
    await initInFlight;
  } finally {
    initInFlight = null;
  }
}

init();
