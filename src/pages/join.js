import state from '../state.js';
import { TIERS, PROPS } from '../constants.js';
import { show } from '../utils.js';
import { getPoolPlayers, joinPool, getMyPicks, getMyPropPicks } from '../supabase.js';

export function renderJoinPage() {
  var pool = state.poolData;
  var players = state.players || [];
  var n = players.length;
  var t = n * (pool.buyin || 20);

  document.getElementById("name-list").innerHTML = players.map(function(p) {
    var isMe = p.user_id === state.userId;
    var hasMasters = state.allPicks && (state.allPicks[p.user_id] || {}).submitted;
    var hasProps = state.allPropPicks && (state.allPropPicks[p.user_id] || {}).submitted;
    if (isMe) {
      hasMasters = state.myPicksSubmitted;
      hasProps = state.myPropPicksSubmitted;
    }
    var mastersCls = hasMasters ? "primary" : "secondary";
    var propsCls = hasProps ? "btn-gold" : "secondary";
    var mastersLabel = hasMasters ? "&#9971; Masters &#10003;" : "&#9971; Masters picks";
    var propsLabel = hasProps ? "&#127922; Props &#10003;" : "&#127922; Prop bets";
    var nameHtml = "<strong>" + p.display_name + "</strong>";
    if (isMe) nameHtml += " <span style='font-size:11px;color:var(--muted);font-weight:400;'>(you)</span>";
    return "<div style='margin-bottom:10px;'>"
      + "<div style='font-size:15px;font-weight:700;padding:0 2px 7px;'>" + nameHtml + "</div>"
      + "<div style='display:flex;gap:6px;'>"
      + "<button class='btn " + mastersCls + "' style='flex:1;font-size:13px;padding:11px 10px;'"
      + (isMe ? " data-action='startPicking' data-name='" + p.display_name.replace(/'/g, "&#39;") + "'" : " disabled") + ">"
      + mastersLabel + "</button>"
      + "<button class='btn " + propsCls + "' style='flex:1;font-size:13px;padding:11px 10px;'"
      + (isMe ? " data-action='startPropPicking' data-name='" + p.display_name.replace(/'/g, "&#39;") + "'" : " disabled") + ">"
      + propsLabel + "</button>"
      + "</div></div>";
  }).join("");

  document.getElementById("pot-join").innerHTML =
    "<div class='pot-box'><div class='pot-val'>$" + t + "</div><div class='pot-lbl'>Masters pot</div></div>"
    + "<div class='pot-box'><div class='pot-val'>$" + Math.round(t * .7) + "</div><div class='pot-lbl'>1st place</div></div>"
    + "<div class='pot-box'><div class='pot-val'>$" + (n * (pool.prop_buyin || 10)) + "</div><div class='pot-lbl'>Props pot</div></div>";

  // Show share card for commissioner
  var shareCard = document.getElementById("share-card");
  if (shareCard) {
    if (state.shareToken) {
      var url = window.location.origin + window.location.pathname + "?pool=" + state.shareToken;
      shareCard.style.display = "block";
      document.getElementById("share-url-display").textContent = url;
    } else {
      shareCard.style.display = "none";
    }
  }
}

export async function showJoin() {
  clearInterval(state.lbTimer);
  try {
    const players = await getPoolPlayers(state.poolId);
    state.players = players;
  } catch(e) {
    console.error('showJoin refresh failed:', e);
  }
  renderJoinPage();
  show("pg-join");
}

export async function joinPoolFlow() {
  var nameInp = document.getElementById("in-join-name");
  var name = nameInp ? nameInp.value.trim() : "";
  if (!name) { alert("Enter your name"); return; }
  var btn = document.getElementById("join-btn");
  btn.innerHTML = '<div class="spin"></div> Joining...'; btn.disabled = true;
  try {
    await joinPool(state.poolId, name);
    state.displayName = name;
    const players = await getPoolPlayers(state.poolId);
    state.players = players;
    const rows = await getMyPicks(state.poolId);
    state.myPicks = {};
    state.myPicksSubmitted = rows.length === 6 && rows.every(r => r.submitted);
    rows.forEach(r => { state.myPicks[r.tier] = r.golfer_name; });
    const propRows = await getMyPropPicks(state.poolId);
    state.myPropPicks = {};
    state.myPropPicksSubmitted = propRows.length > 0 && propRows.every(r => r.submitted);
    propRows.forEach(r => { state.myPropPicks[r.prop_id] = r.value; });
    renderJoinPage();
    show("pg-join");
  } catch(e) {
    console.error('joinPool failed:', e);
    btn.innerHTML = "Join pool &rarr;"; btn.disabled = false;
    alert("Could not join pool.\n\n" + (e.message || JSON.stringify(e)));
  }
}
