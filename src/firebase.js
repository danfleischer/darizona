import state from './state.js';

function fbBase() { return state.fbUrl.replace(/\/$/, ""); }

function fbFetch(path, method, body) {
  var opts = { method: method || "GET", headers: { "Content-Type": "application/json" } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  return fetch(fbBase() + path + ".json", opts).then(function(r) {
    if (!r.ok) throw new Error("Firebase " + r.status + " on " + path);
    return r.json();
  });
}

export function fbGet(p) { return fbFetch(p, "GET"); }
export function fbPut(p, d) { return fbFetch(p, "PUT", d); }
export function fbPatch(p, d) { return fbFetch(p, "PATCH", d); }
export function fbPost(p, d) { return fbFetch(p, "POST", d); }
