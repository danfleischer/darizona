import state from '../state.js';
import { TIERS } from '../constants.js';
import { show, mastersLocked } from '../utils.js';
import { savePickDraft, submitPicks as dbSubmitPicks } from '../supabase.js';
import { showPropPicks } from './propPicks.js';

export function startPicking() {
  renderPickPage();
  show("pg-pick");
}

export function startPropPicking() {
  showPropPicks();
}

export function renderPickPage() {
  document.getElementById("pick-heading").textContent = (state.displayName || "Your") + "'s picks";
  document.getElementById("pick-search").value = "";
  document.getElementById("pick-search").style.display = "";
  var locked = mastersLocked();
  document.getElementById("pick-lock-banner").style.display = locked ? "flex" : "none";
  var submitted = state.myPicksSubmitted;
  var submitBtn = document.getElementById("submit-picks-btn");
  var banner = document.getElementById("picks-submitted-banner");
  if (submitted) {
    submitBtn.innerHTML = "Submitted &#10003;"; submitBtn.disabled = true;
    submitBtn.style.background = "var(--green2)";
    banner.style.display = "flex";
  } else {
    submitBtn.innerHTML = "Submit picks &#10003;"; submitBtn.disabled = locked;
    submitBtn.style.background = "";
    banner.style.display = "none";
  }
  var done = TIERS.filter(function(t) { return state.myPicks[t.id]; }).length;
  document.getElementById("pick-bar").style.width = Math.round(done / 6 * 100) + "%";
  document.getElementById("pick-status").textContent = done + " of 6 tiers picked" + (done === 6 ? " \u2014 all done! \u2713" : "");
  renderTiers();
}

export function renderTiers() {
  var q = document.getElementById("pick-search").value.toLowerCase();
  var locked = mastersLocked() || state.myPicksSubmitted;
  var html = "";
  TIERS.forEach(function(tier) {
    var myPick = state.myPicks[tier.id];
    var filtered = tier.golfers.filter(function(g) { return !q || g.n.toLowerCase().indexOf(q) !== -1; });
    if (!filtered.length) return;
    var collapsed = state.tierCollapsed[tier.id] && !q;
    html += "<div class='tier-block'>";
    html += "<div class='tier-head-row' data-action='toggleTier' data-tier='" + tier.id + "'>";
    html += "<span class='tier-label " + tier.lc + "'>" + tier.label + "</span>";
    if (myPick) html += "<span style='font-size:12px;color:var(--green);margin-left:8px;font-weight:500;'>&#10003; " + myPick + "</span>";
    html += "<span class='tier-caret" + (collapsed ? "" : " open") + "'>&#9650;</span></div>";
    if (!collapsed) {
      html += "<div class='gg'>";
      filtered.forEach(function(gf) {
        var isSel = myPick === gf.n;
        html += "<button class='gcard" + (isSel ? " picked" : "") + "'" + (locked ? " disabled" : "") +
          " data-action='togglePick' data-tier='" + tier.id + "' data-name='" + gf.n.replace(/'/g, "&#39;") + "'>" +
          "<div class='gname'>" + gf.n + "</div><div class='godds'>" + gf.o + "</div></button>";
      });
      html += "</div>";
    }
    html += "</div>";
  });
  document.getElementById("tier-list").innerHTML = html;
}

export function toggleTier(id) { state.tierCollapsed[id] = !state.tierCollapsed[id]; renderTiers(); }

export function togglePick(tid, name) {
  if (mastersLocked() || state.myPicksSubmitted) return;
  state.myPicks[tid] = state.myPicks[tid] === name ? null : name;
  renderPickPage();
}

export async function submitPicks() {
  if (mastersLocked()) { alert("Masters picks are locked!"); return; }
  if (state.myPicksSubmitted) { return; }
  var done = TIERS.filter(function(t) { return state.myPicks[t.id]; }).length;
  if (done < 6) { alert("Pick one golfer from each tier first (" + done + "/6 done)."); return; }
  if (!confirm("Submit your picks? They'll be locked in permanently.")) return;
  var btn = document.getElementById("submit-picks-btn");
  btn.innerHTML = '<div class="spin"></div> Submitting...'; btn.disabled = true;
  try {
    for (var tier of TIERS) {
      await savePickDraft(state.poolId, tier.id, state.myPicks[tier.id] || null);
    }
    await dbSubmitPicks(state.poolId);
    state.myPicksSubmitted = true;
    // Auto-advance to prop picks
    showPropPicks();
  } catch(e) {
    btn.innerHTML = "Submit picks &#10003;"; btn.disabled = false;
    alert("Submit failed.\n\n" + e.message);
  }
}
