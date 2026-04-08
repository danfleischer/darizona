import state from '../state.js';
import { NUM_PROPS } from '../constants.js';
import { show } from '../utils.js';
import { createPool as dbCreatePool, addCommissioner, invitePlayer } from '../supabase.js';
import { renderPickPage } from './picks.js';

// Local golfer list before pool is created
var golfers = [];

export function addGolfer() {
  var nameInp = document.getElementById("in-golfer-name");
  var emailInp = document.getElementById("in-golfer-email");
  var name = nameInp.value.trim();
  var email = emailInp.value.trim();
  if (!name) return;
  if (golfers.find(function(g) { return g.name === name; })) {
    nameInp.value = ""; emailInp.value = ""; nameInp.focus(); return;
  }
  golfers.push({ name: name, email: email || null });
  nameInp.value = ""; emailInp.value = "";
  nameInp.focus();
  renderGolferTags();
  refreshPot();
}

export function removeGolfer(i) {
  golfers.splice(i, 1);
  renderGolferTags();
  refreshPot();
}

export function renderGolferTags() {
  var el = document.getElementById("golfer-tags");
  if (!golfers.length) { el.innerHTML = ""; return; }
  el.innerHTML = "<div style='display:flex;flex-direction:column;gap:6px;margin-top:8px;'>"
    + golfers.map(function(g, i) {
      return "<div style='display:flex;align-items:center;justify-content:space-between;padding:7px 10px;background:var(--sand);border-radius:8px;font-size:13px;'>"
        + "<span><strong>" + g.name + "</strong>"
        + (g.email ? " &nbsp;<span style='color:var(--muted);'>" + g.email + "</span>" : "")
        + "</span>"
        + "<span data-action='removeGolfer' data-index='" + i + "' style='cursor:pointer;color:var(--muted);font-size:12px;padding:2px 6px;'>&#x2715;</span>"
        + "</div>";
    }).join("")
    + "</div>";
}

export function refreshPot() {
  var b = parseInt(document.getElementById("in-buyin").value) || 0;
  var pb = parseInt(document.getElementById("in-prop-buyin").value) || 0;
  var n = golfers.length + 1; // golfers + commissioner
  var t = b * n, pt = pb * n;
  var perProp = n > 0 ? Math.floor(pt / NUM_PROPS) : 0;
  document.getElementById("per-prop-display").textContent = perProp;
  var card = document.getElementById("pot-preview");
  if (n >= 2) {
    card.style.display = "block";
    document.getElementById("pot-total").textContent = "$" + t;
    document.getElementById("prop-total").textContent = "$" + pt;
    document.getElementById("per-prop-pot").textContent = "$" + perProp;
  } else { card.style.display = "none"; }
}

export async function createPool() {
  var adminName = document.getElementById("in-admin").value.trim();
  var buyin = parseInt(document.getElementById("in-buyin").value) || 20;
  var propBuyin = parseInt(document.getElementById("in-prop-buyin").value) || 10;
  if (!adminName) { alert("Enter your name first"); return; }

  var btn = document.getElementById("create-btn");
  btn.innerHTML = '<div class="spin"></div> Creating...'; btn.disabled = true;

  try {
    console.log('[create] calling dbCreatePool');
    const pool = await dbCreatePool({ buyin, propBuyin, golfers });
    console.log('[create] pool created', pool);
    state.poolId = pool.id;
    state.poolData = pool;
    state.shareToken = pool.share_token;

    console.log('[create] calling addCommissioner');
    await addCommissioner(pool.id, adminName);
    console.log('[create] commissioner added');
    state.displayName = adminName;
    state.players = [{ display_name: adminName, user_id: state.userId, is_commissioner: true }];

    // Send invites to golfers who have emails
    const withEmails = golfers.filter(function(g) { return g.email; });
    if (withEmails.length) {
      btn.innerHTML = '<div class="spin"></div> Sending invites...';
      await Promise.allSettled(
        withEmails.map(function(g) { return invitePlayer(g.email, pool.share_token); })
      );
    }

    var u = new URL(window.location.href);
    u.searchParams.set("pool", pool.share_token);
    window.history.replaceState({}, "", u.toString());

    state.myPicks = {};
    state.myPropPicks = {};
    state.allPicks = {};
    state.allPropPicks = {};
    state.propResults = {};
    renderPickPage();
    show("pg-pick");
  } catch(e) {
    console.error('createPool failed:', e);
    btn.innerHTML = "Create pool &amp; get link &rarr;"; btn.disabled = false;
    alert("Could not create pool.\n\n" + (e.message || JSON.stringify(e)));
  }
}
