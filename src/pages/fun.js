import state from '../state.js';
import { PROPS, NUM_PROPS } from '../constants.js';
import { show, isCommissioner, perPropPot, fmtTime } from '../utils.js';
import { getAllPropPicks, getPropResults, savePropResults } from '../supabase.js';

export async function showFun() {
  clearInterval(state.lbTimer);
  if (state.poolId) {
    try {
      const [propRows, resultRows] = await Promise.all([
        getAllPropPicks(state.poolId),
        getPropResults(state.poolId),
      ]);
      state.allPropPicks = {};
      propRows.forEach(function(r) {
        if (!state.allPropPicks[r.user_id]) state.allPropPicks[r.user_id] = {};
        state.allPropPicks[r.user_id][r.prop_id] = r.value;
      });
      state.propResults = {};
      resultRows.forEach(function(r) { state.propResults[r.prop_id] = r.value; });
    } catch(e) { console.error('showFun fetch failed:', e); }
  }
  show("pg-fun");
  showFunSection("props");
}

export function showFunSection(section) {
  ["props", "rules"].forEach(function(s) {
    document.getElementById("fun-" + s).style.display = s === section ? "block" : "none";
    var btn = document.getElementById("fsn-" + s);
    if (btn) btn.classList.toggle("active", s === section);
  });
  if (section === "props") renderPropsView();
}

export function renderPropsView() {
  var players = state.players || [];
  var results = state.propResults || {};
  var pot = perPropPot();
  var showAdmin = isCommissioner();
  document.getElementById("props-admin-btn").style.display = showAdmin ? "block" : "none";
  var totalPropPot = players.length * ((state.poolData && state.poolData.prop_buyin) || 10);
  document.getElementById("props-subtitle").textContent = "McDowell Mountain \u00b7 Saturday \u00b7 1 pt per correct answer \u00b7 90/10 payout \u00b7 $" + totalPropPot + " pot";

  var html = "";
  PROPS.forEach(function(prop) {
    var result = results[prop.id] != null ? results[prop.id] : null;
    html += '<div class="prop-card">';
    html += '<div class="prop-header"><div>';
    html += '<div class="prop-label">' + prop.label + '</div>';
    html += '<div class="prop-q">' + prop.q + '</div>';
    html += '</div></div>';
    html += '<div class="prop-body">';
    if (result != null) {
      html += '<div style="font-size:13px;font-weight:700;margin-bottom:8px;">Result: <span style="color:var(--green);">' + result + '</span></div>';
    }
    html += '<table class="prop-picks-table">';
    players.forEach(function(player) {
      var uid = player.user_id;
      var isMe = uid === state.userId;
      var myPickVal = isMe ? state.myPropPicks[prop.id] : (state.allPropPicks[uid] || {})[prop.id];
      var displayVal = myPickVal != null ? String(myPickVal) : "—";
      var indicator = "";
      if (result != null && myPickVal != null) {
        var correct = false;
        if (prop.type === "player" || prop.type === "yes_no") {
          correct = String(myPickVal) === String(result);
        } else if (prop.type === "number") {
          var bestDiff = Infinity, bestLow = Infinity;
          players.forEach(function(p2) {
            var p2pick = p2.user_id === state.userId ? state.myPropPicks[prop.id] : (state.allPropPicks[p2.user_id] || {})[prop.id];
            if (p2pick == null) return;
            var diff = Math.abs(parseInt(p2pick) - parseInt(result));
            if (diff < bestDiff || (diff === bestDiff && parseInt(p2pick) < bestLow)) { bestDiff = diff; bestLow = parseInt(p2pick); }
          });
          correct = Math.abs(parseInt(myPickVal) - parseInt(result)) === bestDiff && parseInt(myPickVal) === bestLow;
        }
        indicator = correct
          ? '<span style="color:#064E3B;font-weight:700;margin-left:6px;">&#10003;</span>'
          : '<span style="color:#881337;font-weight:500;margin-left:6px;">&#10005;</span>';
      }
      html += '<tr><td>' + player.display_name + (isMe ? ' <span class="prop-my-pick">you</span>' : '') + '</td><td>' + displayVal + indicator + '</td></tr>';
    });
    html += '</table></div></div>';
  });
  document.getElementById("props-container").innerHTML = html;
  if (Object.keys(results).length > 0) {
    calculateAndShowPayouts(results);
  }
}

export function showResultsEntry() {
  document.getElementById("results-entry").style.display = "block";
  document.getElementById("payout-section").style.display = "none";
  renderResultsForm();
  document.getElementById("results-entry").scrollIntoView({ behavior: "smooth", block: "start" });
}

export function renderResultsForm() {
  var golferNames = (state.players || []).map(function(p) { return p.display_name; });
  var existing = state.propResults || {};
  var html = "";
  PROPS.forEach(function(prop) {
    var val = existing[prop.id] != null ? existing[prop.id] : "";
    html += '<div class="result-field">';
    html += '<label>' + prop.label + '</label>';
    if (prop.type === "player") {
      html += '<select id="res-' + prop.id + '">';
      html += '<option value="">-- Select winner --</option>';
      golferNames.forEach(function(name) { html += '<option value="' + name.replace(/"/g, "&quot;") + '"' + (val === name ? " selected" : "") + '>' + name + '</option>'; });
      html += '</select>';
    } else if (prop.type === "number") {
      html += '<div class="hint">Enter the actual number</div>';
      html += '<input type="number" id="res-' + prop.id + '" value="' + (val !== "" ? val : "") + '" placeholder="Enter actual value..." min="1" max="200" />';
    } else if (prop.type === "yes_no") {
      html += '<div style="display:flex;gap:8px;">';
      var pendingVal = state.pendingResults && state.pendingResults[prop.id];
      var cur = pendingVal || val;
      html += '<button class="btn ' + (cur === "yes" ? "primary" : "secondary") + ' full" data-action="setResult" data-prop-id="' + prop.id + '" data-val="yes" style="flex:1;">&#128077; Yes</button>';
      html += '<button class="btn ' + (cur === "no" ? "btn-gold" : "secondary") + ' full" data-action="setResult" data-prop-id="' + prop.id + '" data-val="no" style="flex:1;">&#128078; No</button>';
      html += '</div>';
    }
    html += '</div>';
  });
  document.getElementById("results-form").innerHTML = html;
}

export function setResult(propId, val) {
  if (!state.pendingResults) state.pendingResults = {};
  state.pendingResults[propId] = state.pendingResults[propId] === val ? null : val;
  renderResultsForm();
}

export async function saveResults() {
  var results = {};
  PROPS.forEach(function(prop) {
    if (prop.type === "player" || prop.type === "number") {
      var el = document.getElementById("res-" + prop.id);
      if (el && el.value !== "") results[prop.id] = prop.type === "number" ? parseInt(el.value) : el.value;
    } else if (prop.type === "yes_no") {
      var v = (state.pendingResults && state.pendingResults[prop.id]) || (state.propResults && state.propResults[prop.id]);
      if (v) results[prop.id] = v;
    }
  });
  try {
    await savePropResults(state.poolId, results);
    state.propResults = results;
    state.pendingResults = {};
    document.getElementById("results-entry").style.display = "none";
    renderPropsView();
    alert("Results saved! Payouts calculated.");
  } catch(e) { alert("Save failed.\n\n" + e.message); }
}

function countCorrect(uid, results) {
  var picks = uid === state.userId ? state.myPropPicks : (state.allPropPicks[uid] || {});
  var correct = 0;
  PROPS.forEach(function(prop) {
    var result = results[prop.id]; if (result == null) return;
    var pick = picks[prop.id]; if (pick == null) return;
    if (prop.type === "player" || prop.type === "yes_no") {
      if (String(pick) === String(result)) correct++;
    } else if (prop.type === "number") {
      var bestDiff = Infinity, bestLow = Infinity;
      (state.players || []).forEach(function(p2) {
        var p2pick = p2.user_id === state.userId ? state.myPropPicks[prop.id] : (state.allPropPicks[p2.user_id] || {})[prop.id];
        if (p2pick == null) return;
        var diff = Math.abs(parseInt(p2pick) - parseInt(result));
        if (diff < bestDiff || (diff === bestDiff && parseInt(p2pick) < bestLow)) { bestDiff = diff; bestLow = parseInt(p2pick); }
      });
      var myDiff = Math.abs(parseInt(pick) - parseInt(result));
      if (myDiff === bestDiff && parseInt(pick) === bestLow) correct++;
    }
  });
  return correct;
}

function darrenScoreDiff(uid, results) {
  var actual = results["darren_score"]; if (actual == null) return 9999;
  var picks = uid === state.userId ? state.myPropPicks : (state.allPropPicks[uid] || {});
  var guess = picks["darren_score"]; if (guess == null) return 9999;
  return Math.abs(parseInt(guess) - parseInt(actual));
}

function calculateAndShowPayouts(results) {
  var players = state.players || [];
  var propBuyin = (state.poolData && state.poolData.prop_buyin) || 10;
  var totalPot = players.length * propBuyin;
  var prize1 = Math.round(totalPot * 0.9), prize2 = totalPot - prize1;
  var scores = {};
  players.forEach(function(p) { scores[p.user_id] = countCorrect(p.user_id, results); });
  var sorted = players.slice().sort(function(a, b) {
    if (scores[b.user_id] !== scores[a.user_id]) return scores[b.user_id] - scores[a.user_id];
    var da = darrenScoreDiff(a.user_id, results), db = darrenScoreDiff(b.user_id, results);
    if (da !== db) return da - db;
    var picks_a = a.user_id === state.userId ? state.myPropPicks : (state.allPropPicks[a.user_id] || {});
    var picks_b = b.user_id === state.userId ? state.myPropPicks : (state.allPropPicks[b.user_id] || {});
    return (parseInt(picks_a["darren_score"]) || 9999) - (parseInt(picks_b["darren_score"]) || 9999);
  });
  var answeredCount = Object.keys(results).length;
  var darrenActual = results["darren_score"];
  var tiebreakUsed = sorted.length > 1 && scores[sorted[0].user_id] === scores[sorted[1].user_id];
  var html = '<div style="font-size:13px;color:var(--muted);margin-bottom:12px;">' +
    answeredCount + ' of ' + NUM_PROPS + ' props scored &bull; $' + totalPot + ' total pot &bull; 1pt per correct answer';
  if (tiebreakUsed) html += ' &bull; <strong style="color:var(--gold);">Tiebreak: Darren\u0027s score</strong>';
  html += '</div>';
  sorted.forEach(function(player, rank) {
    var s = scores[player.user_id];
    var net = rank === 0 ? (prize1 - propBuyin) : rank === 1 ? (prize2 - propBuyin) : -propBuyin;
    var diff = darrenActual != null ? darrenScoreDiff(player.user_id, results) : null;
    html += '<div class="payout-row">';
    html += '<div><span style="font-weight:700;">' + player.display_name + '</span>';
    html += ' <span style="font-size:13px;color:var(--muted);">' + s + '/' + answeredCount + ' pts';
    if (tiebreakUsed && diff !== null && diff !== 9999) html += ' &bull; Darren diff: ' + diff;
    html += '</span>';
    if (rank === 0) html += ' <span class="prop-winner-badge">&#127942; 1st</span>';
    else if (rank === 1) html += ' <span style="background:#E5E7EB;color:#374151;font-size:11px;padding:2px 8px;border-radius:99px;font-weight:600;margin-left:6px;">&#129352; 2nd</span>';
    html += '</div>';
    if (net > 0) html += '<div class="payout-net-pos">+$' + net + '</div>';
    else if (net === 0) html += '<div style="color:var(--muted);font-size:14px;">Even</div>';
    else html += '<div class="payout-net-neg">-$' + Math.abs(net) + '</div>';
    html += '</div>';
  });
  document.getElementById("payout-table").innerHTML = html;
  document.getElementById("payout-section").style.display = "block";
}
