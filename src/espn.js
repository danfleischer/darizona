import state from './state.js';
import { CUT_PENALTY, NAME_ALIASES } from './constants.js';
import { normName } from './utils.js';

import { MASTERS_LOCK } from './constants.js';

export function fetchESPN() {
  // Don't hit ESPN before the tournament — just return pre status
  if (new Date() < MASTERS_LOCK) {
    return Promise.resolve({ status: "pre", scores: {}, leader: null });
  }
  return fetch("https://site.api.espn.com/apis/site/v2/sports/golf/pga/leaderboard")
    .then(function(r) { if (!r.ok) throw new Error("ESPN " + r.status); return r.json(); })
    .then(function(data) {
      var events = data.events || [], ev = null;
      for (var i = 0; i < events.length; i++) {
        if ((events[i].name || "").toLowerCase().indexOf("masters") !== -1) { ev = events[i]; break; }
      }
      if (!ev) ev = events[0];
      if (!ev) return { status: "notfound", scores: {}, leader: null };

      var rawStatus = (ev.status && ev.status.type && ev.status.type.name) || "";
      var status = "pre";
      if (rawStatus === "STATUS_IN_PROGRESS" || rawStatus === "in" || rawStatus.indexOf("PROGRESS") !== -1) status = "in";
      else if (rawStatus === "STATUS_FINAL" || rawStatus === "STATUS_COMPLETE" || rawStatus.indexOf("FINAL") !== -1 || rawStatus.indexOf("COMPLETE") !== -1) status = "post";

      var competitors = (ev.competitions && ev.competitions[0] && ev.competitions[0].competitors) || [];
      var scores = {}, leader = null;
      competitors.forEach(function(c) {
        var name = (c.athlete && c.athlete.displayName) || "";
        var pos = (c.status && c.status.position && c.status.position.displayName) || "--";
        var score = (c.score && c.score.displayValue) || "E";
        var cStatus = (c.status && c.status.type && c.status.type.name) || "active";
        var isCut = cStatus === "STATUS_CUT" || cStatus === "cut" || pos === "CUT" || cStatus.indexOf("CUT") !== -1 || cStatus.indexOf("WD") !== -1 || cStatus.indexOf("DQ") !== -1;
        var thru = (c.status && c.status.displayValue) || "--";
        var ls = c.linescores || [], rounds = ["--", "--", "--", "--"];
        for (var r = 0; r < Math.min(ls.length, 4); r++) rounds[r] = (ls[r].displayValue || ls[r].value || "--").toString();
        var posNum = 999;
        if (!isCut && pos !== "--") { var n = parseInt(pos.replace(/[^0-9]/g, "")); if (!isNaN(n)) posNum = n; }
        if (isCut) posNum = CUT_PENALTY;
        var entry = { pos: pos, score: score, status: isCut ? "cut" : "active", posNum: posNum, rawName: name, thru: thru, r1: rounds[0], r2: rounds[1], r3: rounds[2], r4: rounds[3] };
        scores[normName(name)] = entry;
        if (!isCut && (!leader || posNum < leader.posNum)) leader = entry;
      });
      return { status: status, scores: scores, leader: leader, eventName: ev.name };
    });
}

export function lookupScore(name) {
  if (!state.espnScores) return null;
  var norm = normName(name);
  if (state.espnScores[norm]) return state.espnScores[norm];
  var aliases = NAME_ALIASES[norm];
  if (aliases) {
    for (var i = 0; i < aliases.length; i++) {
      if (state.espnScores[normName(aliases[i])]) return state.espnScores[normName(aliases[i])];
    }
  }
  for (var k in state.espnScores) {
    if (k.indexOf(norm) !== -1 || norm.indexOf(k) !== -1) return state.espnScores[k];
  }
  return null;
}
