import state from '../state.js';
import { PROPS } from '../constants.js';
import { show, propsLocked, perPropPot } from '../utils.js';
import { savePropPickDraft, submitPropPicks as dbSubmitPropPicks } from '../supabase.js';
import { showSummary } from './summary.js';

export function showPropPicks() {
  renderPropPickScreen();
  show("pg-prop-picks");
}

export function renderPropPickScreen() {
  var locked = propsLocked() || state.myPropPicksSubmitted;
  document.getElementById("prop-lock-banner").style.display = (propsLocked() ? "flex" : "none");
  var submitBtn = document.getElementById("submit-prop-picks-btn");
  var banner = document.getElementById("prop-picks-submitted-banner");
  if (state.myPropPicksSubmitted) {
    submitBtn.innerHTML = "Submitted &#10003;"; submitBtn.disabled = true;
    submitBtn.style.background = "var(--green2)";
    banner.style.display = "flex";
  } else {
    submitBtn.innerHTML = "Submit prop picks &#10003;"; submitBtn.disabled = propsLocked();
    submitBtn.style.background = "";
    banner.style.display = "none";
  }
  var players = (state.players || []).map(function(p) { return p.display_name; });
  var html = "";
  PROPS.forEach(function(prop) {
    var myVal = state.myPropPicks[prop.id];
    html += "<div class='prop-card'>";
    html += "<div class='prop-header'>";
    html += "<div><div class='prop-label'>" + prop.label + "</div><div class='prop-q'>" + prop.q + "</div></div>";
    html += "<div class='prop-pot'>$" + perPropPot() + " pot</div>";
    html += "</div>";
    html += "<div class='prop-body'>";
    if (prop.type === "player") {
      html += "<select id='pp-" + prop.id + "' " + (locked ? "disabled" : "") + " style='background:" + (myVal ? "#E8F3EC" : "var(--sand)") + ";border-color:" + (myVal ? "var(--green2)" : "var(--border)") + "'>";
      html += "<option value=''>-- Pick a donk --</option>";
      players.forEach(function(p) { html += "<option value='" + p.replace(/"/g, "&quot;") + "'" + (myVal === p ? " selected" : "") + ">" + p + "</option>"; });
      html += "</select>";
    } else if (prop.type === "number") {
      html += "<input type='number' id='pp-" + prop.id + "' placeholder='Enter your guess...' value='" + (myVal != null ? myVal : "") + "' min='1' max='150' " + (locked ? "disabled" : "") + " style='background:" + (myVal != null ? "#E8F3EC" : "var(--sand)") + ";border-color:" + (myVal != null ? "var(--green2)" : "var(--border)") + "' />";
    } else if (prop.type === "yes_no") {
      html += "<div style='display:flex;gap:8px;'>";
      html += "<button class='btn " + (myVal === "yes" ? "primary" : "secondary") + " full' data-action='setPropPick' data-prop-id='" + prop.id + "' data-val='yes' " + (locked ? "disabled" : "") + " style='flex:1;'>&#128077; Yes</button>";
      html += "<button class='btn " + (myVal === "no" ? "btn-gold" : "secondary") + " full' data-action='setPropPick' data-prop-id='" + prop.id + "' data-val='no' " + (locked ? "disabled" : "") + " style='flex:1;'>&#128078; No</button>";
      html += "</div>";
    }
    html += "</div></div>";
  });
  document.getElementById("prop-pick-list").innerHTML = html;
}

export function syncPropPicksFromDOM() {
  PROPS.forEach(function(prop) {
    if (prop.type === "player" || prop.type === "number") {
      var el = document.getElementById("pp-" + prop.id);
      if (el && el.value !== "") {
        state.myPropPicks[prop.id] = prop.type === "number" ? parseInt(el.value) : el.value;
      }
    }
  });
}

export function setPropPick(propId, val) {
  if (propsLocked() || state.myPropPicksSubmitted) return;
  syncPropPicksFromDOM();
  state.myPropPicks[propId] = state.myPropPicks[propId] === val ? null : val;
  renderPropPickScreen();
}

export async function submitPropPicks() {
  if (propsLocked()) { alert("Prop picks are locked!"); return; }
  if (state.myPropPicksSubmitted) { return; }
  syncPropPicksFromDOM();
  var answered = PROPS.filter(function(p) { return state.myPropPicks[p.id] != null; }).length;
  if (answered < PROPS.length) {
    if (!confirm("You've only answered " + answered + "/" + PROPS.length + " props. Submit anyway?")) return;
  } else {
    if (!confirm("Submit your prop picks? They'll be locked in permanently.")) return;
  }
  var btn = document.getElementById("submit-prop-picks-btn");
  btn.innerHTML = '<div class="spin"></div> Submitting...'; btn.disabled = true;
  try {
    for (var prop of PROPS) {
      var val = state.myPropPicks[prop.id];
      if (val != null) await savePropPickDraft(state.poolId, prop.id, val);
    }
    await dbSubmitPropPicks(state.poolId);
    state.myPropPicksSubmitted = true;
    // Auto-advance to all picks page
    showSummary();
  } catch(e) {
    btn.innerHTML = "Submit prop picks &#10003;"; btn.disabled = false;
    alert("Submit failed.\n\n" + e.message);
  }
}
