import state from '../state.js';
import { show } from '../utils.js';

export function doSetup() {
  var raw = document.getElementById("fb-input").value.trim().replace(/\/$/, "");
  if (raw.indexOf("firebaseio.com") === -1) { alert("URL should end with firebaseio.com"); return; }
  var btn = document.getElementById("setup-btn");
  btn.innerHTML = '<div class="spin"></div> Checking...'; btn.disabled = true;
  state.fbUrl = raw;
  fetch(state.fbUrl.replace(/\/$/, "") + "/ping.json").then(function(r) {
    if (r.status === 401 || r.status === 403) throw new Error("Permission denied. Choose \"Start in test mode\".");
    localStorage.setItem("fbUrl", state.fbUrl); show("pg-create");
  }).catch(function(e) {
    state.fbUrl = ""; btn.innerHTML = "Connect &amp; continue &rarr;"; btn.disabled = false;
    alert("Could not connect.\n\n" + e.message + "\n\nCheck:\n1. URL from Realtime Database page\n2. \"Start in test mode\" was selected");
  });
}
