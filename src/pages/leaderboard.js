import state from '../state.js';
import { TIERS, CUT_PENALTY } from '../constants.js';
import { show, fmtTime, normName } from '../utils.js';
import { getAllPicks, getPoolPlayers } from '../supabase.js';
import { fetchESPN, lookupScore } from '../espn.js';

export function showLeaderboard() {
  clearInterval(state.lbTimer);
  show("pg-leaderboard");
  loadLeaderboard(false);
  state.lbTimer = setInterval(function() { loadLeaderboard(false); }, 90000);
}

export function loadLeaderboard(manual) {

  var dbP = state.poolId ? getAllPicks(state.poolId).then(function(rows) {
    state.allPicks = {};
    rows.forEach(function(r) {
      if (!state.allPicks[r.user_id]) state.allPicks[r.user_id] = {};
      state.allPicks[r.user_id][r.tier] = r.golfer_name;
    });
  }).catch(function() {}) : Promise.resolve();

  var espnP = fetchESPN().catch(function() { return { status: "error", scores: {}, leader: null }; });

  Promise.all([dbP, espnP]).then(function(res) {
    var er = res[1];
    if (er && er.scores) state.espnScores = er.scores;
    document.getElementById("last-updated").textContent = "Updated " + fmtTime(Date.now());
    renderLeaderboard(er);
  });
}

export function scoreClass(s) {
  if (!s || s === "--" || s === "E") return "score-even";
  if (s.charAt(0) === "-") return "score-under";
  if (s.charAt(0) === "+") return "score-over";
  return "score-even";
}

export function renderLeaderboard(er) {
  var players = state.players || [];
  var pool = state.poolData || {};
  var n = players.length, pot = n * (pool.buyin || 20);
  var prize1 = Math.round(pot * .7), prize2 = Math.round(pot * .3);
  var tStatus = er ? er.status : "error", leader = er ? er.leader : null;
  var live = tStatus === "in" || tStatus === "post";

  var stHtml = "";
  if (tStatus === "in") stHtml = '<span class="live-dot"></span><strong style="color:var(--green)">LIVE</strong> &mdash; Masters Tournament';
  else if (tStatus === "post") stHtml = '<span class="badge badge-gray">Final</span>&nbsp;Masters Tournament';
  else if (tStatus === "pre") stHtml = '<span class="badge badge-gold">&#9201; Tee-off April 9</span>&nbsp;Scoring begins Thursday';
  else stHtml = '<span class="badge badge-gray">Scores unavailable</span>&nbsp;Use &#127381; Test to preview';
  document.getElementById("lb-status").innerHTML = stHtml;

  var lbHtml = "";
  if (live && leader) {
    lbHtml = '<div class="leader-banner"><div class="leader-left"><div class="leader-label">Masters leader</div><div class="leader-name">' + leader.rawName + '</div><div class="leader-thru">' + (leader.thru === "F" ? "Final" : leader.thru !== "--" ? "Thru " + leader.thru : "") + '</div></div><div class="leader-score">' + leader.score + '</div></div>';
  }
  document.getElementById("leader-banner").innerHTML = lbHtml;

  var poolScores = players.map(function(player) {
    var uid = player.user_id;
    var pp = state.allPicks[uid] || {};
    var isMe = uid === state.userId;
    var hasPicks = isMe ? state.myPicksSubmitted : Object.keys(pp).length >= 6;
    if (isMe && state.myPicksSubmitted) pp = state.myPicks; // use local copy for self
    var total = 0, details = [];
    TIERS.forEach(function(tier) {
      var pick = pp[tier.id];
      if (!pick) { details.push({ name: null, tier: tier.id }); return; }
      var s = lookupScore(pick); total += s ? s.posNum : 70;
      details.push({ name: pick, tier: tier.id, pos: s ? s.pos : "–", score: s ? s.score : "–", thru: s ? s.thru : "–", r1: s ? s.r1 : "–", r2: s ? s.r2 : "–", r3: s ? s.r3 : "–", r4: s ? s.r4 : "–", status: s ? s.status : "tbd", posNum: s ? s.posNum : 70 });
    });
    return { player: player.display_name, total: hasPicks ? total : null, details: details, hasPicks: hasPicks };
  });

  poolScores.sort(function(a, b) {
    if (a.total === null && b.total === null) return 0;
    if (a.total === null) return 1; if (b.total === null) return -1;
    return a.total - b.total;
  });

  var rankCls = ["gold-rank", "silver-rank", "bronze-rank"];
  var html = "";
  if (!poolScores.some(function(p) { return p.hasPicks; })) {
    html = '<div class="card" style="text-align:center;padding:28px;color:var(--muted);">&#127939; No picks submitted yet</div>';
  } else {
    poolScores.forEach(function(ps, i) {
      var rank = ps.hasPicks ? i + 1 : "-", rCls = i < 3 ? rankCls[i] : "";
      var prizeHtml = "";
      if (live && ps.hasPicks) {
        if (i === 0) prizeHtml = '<div class="pool-prize prize-1">&#127942; Proj. $' + prize1 + '</div>';
        else if (i === 1) prizeHtml = '<div class="pool-prize prize-2">&#129352; Proj. $' + prize2 + '</div>';
        else if (i === 2) prizeHtml = '<div class="pool-prize prize-3">&#129353; On the bubble</div>';
      }
      var scoreHtml = !ps.hasPicks ? '<div class="pool-total pending">Pending</div>' : !live ? '<div class="pool-total pending">Pending</div>' : '<div class="pool-total">' + ps.total + '</div>';
      html += '<div class="pool-card"><div class="pool-header"><span class="lb-rank ' + rCls + '">' + rank + '</span><div class="pool-name">' + ps.player + '</div><div class="pool-score-wrap">' + scoreHtml + prizeHtml + '</div></div>';
      html += '<div class="gt-wrap"><table class="gt"><thead><tr><th>Golfer</th><th>POS</th><th>TOT</th><th>THR</th><th>R1</th><th>R2</th><th>R3</th><th>R4</th></tr></thead><tbody>';
      ps.details.forEach(function(det) {
        if (!det.name) { html += '<tr><td colspan="8" style="color:#ccc;font-style:italic;padding-left:15px;">T' + det.tier + ': no pick</td></tr>'; return; }
        var isCut = det.status === "cut", cutCls = isCut ? " gt-cut" : "", cutBadge = isCut ? '<span class="gt-cut-badge">CUT</span>' : "";
        var thruCls = (det.thru !== "F" && det.thru !== "--" && !isCut) ? " thru-live" : "";
        html += '<tr class="' + cutCls.trim() + '"><td>' + det.name + cutBadge + '</td><td class="pos-num">' + (live ? det.pos : "--") + '</td><td class="' + scoreClass(live ? det.score : null) + '">' + (live ? det.score : "--") + '</td><td class="' + thruCls.trim() + '">' + (live ? det.thru : "--") + '</td><td>' + (live ? det.r1 : "--") + '</td><td>' + (live ? det.r2 : "--") + '</td><td>' + (live ? det.r3 : "--") + '</td><td>' + (live ? det.r4 : "--") + '</td></tr>';
      });
      html += '</tbody></table></div></div>';
    });
  }
  html += '<p style="font-size:12px;color:var(--muted);margin-top:8px;line-height:1.6;">Pool score = sum of finishing positions. Missed cut = +' + CUT_PENALTY + '. Auto-refreshes every 90s.</p>';
  document.getElementById("lb-content").innerHTML = html;
}

export function loadTestScores() {
  var names = ["Scottie Scheffler","Jon Rahm","Rory McIlroy","Bryson DeChambeau","Ludvig Aberg","Xander Schauffele","Cameron Young","Tommy Fleetwood","Matt Fitzpatrick","Collin Morikawa","Justin Rose","Jordan Spieth","Brooks Koepka","Hideki Matsuyama","Robert MacIntyre","Russell Henley","Chris Gotterup","Patrick Reed","Viktor Hovland","Si Woo Kim","Min Woo Lee","Justin Thomas","Patrick Cantlay","Adam Scott","Akshay Bhatia","Sepp Straka","Jason Day","Jake Knapp","Tyrrell Hatton","Shane Lowry","Sam Burns","Corey Conners","Nicolai Hojgaard","Kurt Kitayama","J.J. Spaun","Jacob Bridgeman","Maverick McNealy","Cameron Smith","Harris English","Gary Woodland","Ben Griffin","Daniel Berger","Max Homa","Sung-Jae Im","Rasmus Hojgaard","Keegan Bradley","Harry Hall","Marco Penge","Alex Noren","Ryan Gerard","Casey Jarvis","Carlos Ortiz","Dustin Johnson","Bubba Watson","Fred Couples","Vijay Singh","Jose Maria Olazabal","Mike Weir","Danny Willett","Zach Johnson","Charl Schwartzel","Davis Riley","Angel Cabrera","Brian Campbell","Ethan Fang","Mason Howell","Brandon Holtz","Aldrich Potgieter","Nick Taylor","Aaron Rai","Brian Harman","Sam Stevens","Sergio Garcia","Ryan Fox","Wyndham Clark","Max Greyserman"];
  var rs = [[66,68,67,69],[68,67,70,68],[69,67,69,70],[70,68,69,71],[67,70,69,71],[68,70,70,70],[69,70,70,70],[70,69,70,70],[70,70,69,70],[71,69,70,71],[70,70,71,70],[70,71,69,71],[71,70,70,71],[71,71,70,70],[72,70,70,70],[71,72,70,70],[72,71,70,70],[71,72,71,70],[72,71,71,70],[73,71,70,70],[72,72,71,70],[73,72,70,70],[74,71,71,70],[73,73,70,71],[74,72,71,71],[75,72,71,71],[74,74,71,71],[75,73,72,71],[76,73,72,72],[77,73,73,72],[76,75,73,72],[77,76,74,73],[76,77,74,73],[77,77,75,73],[78,77,76,74],[79,77,77,74],[78,79,77,75],[79,79,78,75],[80,79,78,76],[80,80,79,76],[81,80,79,77],[81,81,80,77],[82,81,80,78],[82,82,81,78],[83,82,81,79],[83,83,82,79],[84,83,82,80],[85,83,83,80],[84,85,83,81],[85,85,84,81],[80,80,0,0],[81,80,0,0],[79,82,0,0],[80,82,0,0],[81,83,0,0],[82,83,0,0],[83,84,0,0],[84,84,0,0],[83,85,0,0],[84,85,0,0],[80,81,0,0],[81,81,0,0],[82,82,0,0],[83,82,0,0],[84,83,0,0],[85,83,0,0],[86,84,0,0],[87,84,0,0],[85,86,0,0],[86,86,0,0],[87,87,0,0],[88,87,0,0],[89,88,0,0],[90,88,0,0],[91,89,0,0],[92,89,0,0]];
  var cutLine = 50, par = 72, ts = {};
  names.forEach(function(name, i) {
    var isCut = i >= cutLine, r = rs[i] || [72, 72, 0, 0];
    var r1 = r[0], r2 = r[1], r3 = r[2], r4 = r[3];
    var played = isCut ? 2 : (r4 > 0 ? 4 : r3 > 0 ? 3 : 2);
    var total = r1 + r2 + (r3 > 0 ? r3 : 0) + (r4 > 0 ? r4 : 0);
    var vp = total - (par * played);
    var scoreStr = vp < 0 ? String(vp) : (vp === 0 ? "E" : "+" + vp);
    ts[normName(name)] = { pos: isCut ? "CUT" : (i === 0 ? "1" : "T" + (i + 1)), score: isCut ? "CUT" : scoreStr, status: isCut ? "cut" : "active", posNum: isCut ? CUT_PENALTY : i + 1, rawName: name, thru: isCut ? "CUT" : (r4 > 0 ? "F" : r3 > 0 ? "F" : "9"), r1: String(r1), r2: String(r2), r3: r3 > 0 ? String(r3) : "--", r4: r4 > 0 ? String(r4) : "--" };
  });
  state.espnScores = ts;
  var top = ts[normName(names[0])];
  document.getElementById("lb-status").innerHTML = '<span style="background:#FEF3C7;color:#78350F;padding:3px 9px;border-radius:99px;font-size:12px;font-weight:700;">&#127381; TEST</span>&nbsp;Simulated R3 &mdash; live data pulls Thursday';
  document.getElementById("last-updated").textContent = "Test data loaded " + fmtTime(Date.now());
  renderLeaderboard({ status: "in", scores: ts, leader: top });
}
