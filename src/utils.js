import state from './state.js';
import { MASTERS_LOCK, PROPS_LOCK, NUM_PROPS } from './constants.js';

export function show(id) {
  document.querySelectorAll(".page").forEach(function(p) { p.classList.remove("on"); });
  document.getElementById(id).classList.add("on");
  window.scrollTo(0, 0);
}

export function getParam(k) { return new URLSearchParams(window.location.search).get(k); }

export function shareURL() {
  var u = new URL(window.location.href);
  u.searchParams.set("pool", state.shareToken);
  return u.toString();
}

export function mastersLocked() { return new Date() > MASTERS_LOCK; }
export function propsLocked() { return new Date() > PROPS_LOCK; }

export function normName(s) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

export function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function isCommissioner() {
  return state.players && state.players.some(function(p) {
    return p.user_id === state.userId && p.is_commissioner;
  });
}

export function perPropPot() {
  var n = (state.players && state.players.length) || 0;
  var pb = (state.poolData && state.poolData.prop_buyin) || 10;
  return Math.floor((n * pb) / NUM_PROPS);
}

export function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
