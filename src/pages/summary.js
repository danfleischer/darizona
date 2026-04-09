import state from '../state.js';
import { TIERS, PROPS } from '../constants.js';
import { show, isCommissioner } from '../utils.js';
import { getAllPicks, getAllPropPicks, getPropResults } from '../supabase.js';
import { lookupScore } from '../espn.js';

export async function showSummary() {
  clearInterval(state.lbTimer);
  if (state.poolId) {
    try {
      const [pickRows, propRows, resultRows] = await Promise.all([
        getAllPicks(state.poolId),
        getAllPropPicks(state.poolId),
        getPropResults(state.poolId),
      ]);
      state.allPicks = {};
      pickRows.forEach(function(r) {
        if (!state.allPicks[r.user_id]) state.allPicks[r.user_id] = {};
        state.allPicks[r.user_id][r.tier] = r.golfer_name;
      });
      state.allPropPicks = {};
      propRows.forEach(function(r) {
        if (!state.allPropPicks[r.user_id]) state.allPropPicks[r.user_id] = {};
        state.allPropPicks[r.user_id][r.prop_id] = r.value;
      });
      state.propResults = {};
      resultRows.forEach(function(r) { state.propResults[r.prop_id] = r.value; });
    } catch(e) { console.error('showSummary fetch failed:', e); }
  }
  renderSummary();
  show("pg-summary");
}

export function renderSummary() {
  var players = state.players || [];
  var pool = state.poolData || {};
  var n = players.length, t = n * (pool.buyin || 20);
  document.getElementById("sum-meta").textContent = n + " donks \u00b7 $" + (pool.buyin || 20) + " buy-in";
  document.getElementById("sum-total").textContent = "$" + t;
  document.getElementById("sum-1st").textContent = "$" + Math.round(t * .7);
  document.getElementById("sum-2nd").textContent = "$" + Math.round(t * .3);

  var chips = ["ch1", "ch2", "ch3", "ch4", "ch5", "ch6"];
  var html = "";
  players.forEach(function(player) {
    var uid = player.user_id;
    var isMe = uid === state.userId;
    var pp = isMe ? state.myPicks : (state.allPicks[uid] || {});
    var allDone = isMe ? state.myPicksSubmitted : Object.keys(pp).length >= 6;
    html += "<div class='sum-row'><div style='font-size:14px;font-weight:700;margin-bottom:6px;'>" + player.display_name;
    html += allDone ? " <span style='color:var(--green);font-size:12px;font-weight:400;'>\u2713 Submitted</span>" : " <span style='color:#bbb;font-size:12px;font-weight:400;'>(pending)</span>";
    html += "</div><div>";
    TIERS.forEach(function(tier, i) {
      var pick = pp[tier.id];
      html += pick ? "<span class='chip " + chips[i] + "'>" + pick + "</span>" : "<span class='dash-chip'>T" + tier.id + ": \u2014</span>";
    });
    html += "</div></div>";
  });
  document.getElementById("sum-picks").innerHTML = html;

  // Hide share box — share URL is available on the join page instead
  var shareBox = document.querySelector(".share-box");
  if (shareBox) shareBox.style.display = "none";

  // Show export only for commissioner
  var exportBtn = document.getElementById("export-btn");
  if (exportBtn) exportBtn.style.display = isCommissioner() ? "inline-flex" : "none";
}

export function copyLink(btn) {
  var url = window.location.origin + window.location.pathname + (state.shareToken ? '?pool=' + state.shareToken : '');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(function() { btn.textContent = "Copied! \u2713"; setTimeout(function() { btn.textContent = "Copy link"; }, 2000); });
  } else { prompt("Copy this link:", url); }
}

function csvCell(v) {
  var s = String(v == null ? "" : v);
  if (s.indexOf(",") !== -1 || s.indexOf('"') !== -1) { s = '"' + s.replace(/"/g, '""') + '"'; }
  return s;
}
function csvRow(arr) { return arr.map(csvCell).join(","); }

function countCorrectCSV(uid, results) {
  var pp = state.allPropPicks[uid] || {};
  var correct = 0;
  PROPS.forEach(function(prop) {
    var result = results[prop.id]; if (result == null) return;
    var pick = pp[prop.id]; if (pick == null) return;
    if (prop.type === "player" || prop.type === "yes_no") {
      if (String(pick) === String(result)) correct++;
    } else if (prop.type === "number") {
      var bestDiff = Infinity, bestLow = Infinity;
      (state.players || []).forEach(function(p2) {
        var p2pick = (state.allPropPicks[p2.user_id] || {})[prop.id];
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

export function exportCSV() {
  var pool = state.poolData || {}, players = state.players || [];
  var results = state.propResults || null;
  var ts = new Date().toLocaleString();
  var lines = [];

  lines.push(csvRow(["=== MASTERS PICKS === Exported: " + ts]));
  var mh = ["Donk"]; TIERS.forEach(function(t) { mh.push(t.label); });
  if (state.espnScores) mh.push("Pool Score");
  lines.push(csvRow(mh));
  players.forEach(function(player) {
    var pp = state.allPicks[player.user_id] || {}, total = 0, hasPicks = false;
    var row = [player.display_name];
    TIERS.forEach(function(t) {
      var pick = pp[t.id] || ""; row.push(pick);
      if (pick) { hasPicks = true; var s = lookupScore(pick); total += s ? s.posNum : 70; }
    });
    if (state.espnScores) row.push(hasPicks ? total : "no picks");
    lines.push(csvRow(row));
  });

  lines.push(""); lines.push("");
  lines.push(csvRow(["=== PROP PICKS === McDowell Mountain Saturday"]));
  var ph = ["Donk"]; PROPS.forEach(function(pr) { ph.push(pr.label); }); ph.push("Points");
  lines.push(csvRow(ph));
  players.forEach(function(player) {
    var pp = state.allPropPicks[player.user_id] || {};
    var row = [player.display_name];
    PROPS.forEach(function(pr) { var v = pp[pr.id]; row.push(v != null ? String(v) : ""); });
    row.push(results ? countCorrectCSV(player.user_id, results) : "");
    lines.push(csvRow(row));
  });
  if (results) {
    var rr = ["ACTUAL RESULTS"];
    PROPS.forEach(function(pr) { var v = results[pr.id]; rr.push(v != null ? String(v) : ""); });
    rr.push(""); lines.push(""); lines.push(csvRow(rr));
  }

  lines.push(""); lines.push("");
  lines.push(csvRow(["=== MONEY SUMMARY ==="]));
  var mp = players.length * (pool.buyin || 20), pp2 = players.length * (pool.prop_buyin || 10);
  lines.push(csvRow(["Masters pot", "$" + mp, "1st (70%)", "$" + Math.round(mp * .7), "2nd (30%)", "$" + Math.round(mp * .3)]));
  lines.push(csvRow(["Props pot", "$" + pp2, "1st (90%)", "$" + Math.round(pp2 * .9), "2nd (10%)", "$" + Math.round(pp2 * .1)]));

  var blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url; a.download = "darizona-" + new Date().toISOString().slice(0, 10) + ".csv";
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
