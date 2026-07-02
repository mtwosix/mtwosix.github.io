/* ============================================================================
   M26 discourse — persistent comments, no accounts.

   Comments live in a Google Sheet behind an Apps Script web app (same pattern
   as the submission pipeline; see pipeline/README.md § "The discourse
   backend"). The web-app URL goes in M26.CONFIG.discourseUrl.

   Identity, without login: the browser keeps a display name and a random
   secret in localStorage. The server stores only a hash of the secret with
   each comment; whoever holds the secret — and no one else — can delete that
   comment. Clearing browser data forfeits that power but never the comments.

   POSTs use Content-Type text/plain so the request stays a "simple" CORS
   request (Apps Script cannot answer preflights). Bodies are JSON strings.
   ============================================================================ */
(function () {
  'use strict';

  var state = {
    list: [],        // all comments: {id, sub, parent, author, ts, text, ownerHash, mine}
    bySub: {},       // grouped by submission key
    connected: !!(window.M26 && M26.CONFIG.discourseUrl),
    loaded: false,
    error: null
  };
  var myHashValue = null;

  function secret() {
    var s = null;
    try { s = localStorage.getItem('m26_secret'); } catch (e) {}
    if (!s) {
      s = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
        : String(Math.random()).slice(2) + Date.now();
      try { localStorage.setItem('m26_secret', s); } catch (e) {}
    }
    return s;
  }

  /* SHA-256(secret) base64 — must match the server's Utilities.computeDigest */
  function myHash() {
    if (myHashValue) return Promise.resolve(myHashValue);
    var data = new TextEncoder().encode(secret());
    if (!(window.crypto && crypto.subtle)) return Promise.resolve(null); // http w/o webcrypto
    return crypto.subtle.digest('SHA-256', data).then(function (buf) {
      myHashValue = btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
      return myHashValue;
    });
  }

  function regroup() {
    var by = {};
    state.list.forEach(function (c) {
      (by[c.sub] = by[c.sub] || []).push(c);
    });
    state.bySub = by;
  }

  function markMine() {
    return myHash().then(function (h) {
      state.list.forEach(function (c) { c.mine = !!h && c.ownerHash === h; });
    });
  }

  function api(payload) {
    return fetch(M26.CONFIG.discourseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // simple request — no preflight
      body: JSON.stringify(payload)
    }).then(function (res) {
      if (!res.ok) throw new Error('discourse backend → HTTP ' + res.status);
      return res.json();
    }).then(function (json) {
      if (!json.ok) throw new Error(json.error || 'discourse backend error');
      return json;
    });
  }

  function load() {
    if (!state.connected) { state.loaded = true; return Promise.resolve(state); }
    return fetch(M26.CONFIG.discourseUrl, { method: 'GET' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (json) {
        state.list = (json.comments || []).map(function (c) {
          return { id: String(c.id), sub: String(c.sub), parent: String(c.parent || ''),
                   author: String(c.author || '—'), ts: String(c.ts || ''),
                   text: String(c.text || ''), ownerHash: String(c.ownerHash || ''), mine: false };
        });
        return markMine();
      })
      .then(function () { regroup(); state.loaded = true; state.error = null; return state; })
      .catch(function (err) { state.loaded = true; state.error = err.message; return state; });
  }

  function post(opts) { // {sub, parent, author, text} → resolves with the stored comment
    if (!state.connected) return Promise.reject(new Error('discourse is not connected yet'));
    return api({
      action: 'add', sub: opts.sub, parent: opts.parent || '',
      author: opts.author, text: opts.text, secret: secret()
    }).then(function (json) {
      return markMine().then(function () {
        var c = { id: String(json.id), sub: opts.sub, parent: opts.parent || '',
                  author: opts.author, ts: json.ts || new Date().toISOString(),
                  text: opts.text, ownerHash: myHashValue || '', mine: true };
        state.list.push(c);
        regroup();
        return c;
      });
    });
  }

  function remove(id) {
    if (!state.connected) return Promise.reject(new Error('discourse is not connected yet'));
    return api({ action: 'delete', id: id, secret: secret() }).then(function () {
      state.list = state.list.filter(function (c) { return c.id !== id && c.parent !== id; });
      regroup();
    });
  }

  function forSub(subKey) { return state.bySub[subKey] || []; }

  window.M26Discourse = {
    state: state,
    load: load,
    post: post,
    remove: remove,
    forSub: forSub
  };
})();
