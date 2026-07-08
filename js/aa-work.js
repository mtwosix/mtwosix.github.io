/* ============================================================================
   M26 work — the full record as a filterable wall  (js/aa-work.js)

   Renders every row of data/submissions.csv as a plate on a ruled grid,
   filterable by week / type / student. Clicking a plate folds open a
   full-width detail — the media rendered in place (via M26.renderMediaInto,
   which owns all URL hygiene), the note, and a link into the student's
   dossier. Deep link: work.html#<submission-key> opens that entry.

   Strict 1:1 mirror of the CSVs; untrusted values reach the DOM via
   textContent only.
   ============================================================================ */
(function () {
  'use strict';

  var el = function (tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  var state = { week: 'all', type: 'all', student: 'all' };
  var D = null, grid = null, openX = null;

  /* ---------------------------------------------------------------- filters */
  function chipRow(host, label, key, values, names) {
    var lab = el('span', 'lab', label);
    host.appendChild(lab);
    values.forEach(function (v, i) {
      var c = el('button', 'aa-chip', names ? names[i] : String(v).toUpperCase());
      c.type = 'button';
      c.setAttribute('aria-pressed', state[key] === v ? 'true' : 'false');
      c.addEventListener('click', function () {
        state[key] = v;
        host.parentNode.querySelectorAll('[data-g="' + key + '"]').forEach(function (b) {
          b.setAttribute('aria-pressed', 'false');
        });
        c.setAttribute('aria-pressed', 'true');
        paint();
      });
      c.setAttribute('data-g', key);
      c.setAttribute('data-v', String(v));
      host.appendChild(c);
    });
  }

  /* re-sync every chip's pressed state to the current filter state */
  function syncChips() {
    var host = document.getElementById('aa-work-filters');
    if (!host) return;
    host.querySelectorAll('.aa-chip').forEach(function (c) {
      var k = c.getAttribute('data-g');
      c.setAttribute('aria-pressed', String(state[k]) === c.getAttribute('data-v') ? 'true' : 'false');
    });
  }

  function buildFilters() {
    var host = document.getElementById('aa-work-filters');
    if (!host || !D.submissions.length) return;

    var weeks = {}, types = {}, students = {};
    D.submissions.forEach(function (s) {
      weeks[s.week] = 1; types[s.type] = 1;
      if (s.studentIndex >= 0) students[s.studentIndex] = 1;
    });

    var r1 = el('div', 'aa-filters');
    chipRow(r1, 'Week', 'week',
      ['all'].concat(Object.keys(weeks).map(Number).sort(function (a, b) { return a - b; })),
      ['ALL'].concat(Object.keys(weeks).map(Number).sort(function (a, b) { return a - b; })
        .map(function (w) { return 'W' + ('0' + w).slice(-2); })));
    host.appendChild(r1);

    var r2 = el('div', 'aa-filters');
    chipRow(r2, 'Type', 'type', ['all'].concat(Object.keys(types).sort()));
    host.appendChild(r2);

    var sIdx = Object.keys(students).map(Number).sort(function (a, b) {
      return D.roster[a].localeCompare(D.roster[b]);
    });
    if (sIdx.length > 1) {
      var r3 = el('div', 'aa-filters');
      chipRow(r3, 'Student', 'student', ['all'].concat(sIdx),
        ['ALL'].concat(sIdx.map(function (i) { return D.roster[i]; })));
      host.appendChild(r3);
    }
  }

  /* ------------------------------------------------------------------ plates */
  function matches(s) {
    if (state.week !== 'all' && s.week !== state.week) return false;
    if (state.type !== 'all' && s.type !== state.type) return false;
    if (state.student !== 'all' && s.studentIndex !== state.student) return false;
    return true;
  }

  function cardFor(sub) {
    var card = el('button', 'aa-card');
    card.type = 'button';
    card.id = 'sub-' + sub.key;

    var media = el('div', 'aa-card-media');
    var m = M26.resolveMedia(sub);
    if (m.mode === 'img') {
      var img = document.createElement('img');
      img.loading = 'lazy'; img.decoding = 'async';
      img.alt = sub.text || (sub.student + ' — ' + sub.kind);
      var srcs = [m.src].concat(m.srcAlt || []), si = 0;
      img.onerror = function () {
        si++;
        if (si < srcs.length) { img.src = srcs[si]; return; }
        if (img.parentNode) img.parentNode.removeChild(img);
        media.appendChild(el('span', 'textmark', '◇'));
      };
      img.src = srcs[0];
      media.appendChild(img);
    } else {
      var marks = { pdf: '▤', video: '▶', audio: '◉', text: '❝', link: '↗' };
      media.appendChild(el('span', 'textmark', marks[m.kind] || '◇'));
    }
    media.appendChild(el('span', 'typechip', sub.type));
    card.appendChild(media);

    var cap = el('div', 'aa-card-cap');
    var who = el('div', 'who');
    var dot = el('span', 'dot');
    dot.style.background = sub.studentIndex >= 0
      ? M26.colorFor(sub.studentIndex, D.roster.length, 46) : '#9a958c';
    who.appendChild(dot);
    who.appendChild(el('b', null, sub.student));
    cap.appendChild(who);
    cap.appendChild(el('div', 'meta', sub.kind + ' · ' + sub.longDate + ' · ' + sub.time + ' · W' + sub.week));
    if (sub.text) cap.appendChild(el('div', 'note', sub.text));
    card.appendChild(cap);

    card.addEventListener('click', function () { toggleDetail(card, sub); });
    return card;
  }

  /* ------------------------------------------------------------- detail fold */
  function closeDetail() {
    if (openX && openX.parentNode) openX.parentNode.removeChild(openX);
    openX = null;
  }

  function toggleDetail(card, sub) {
    var was = openX && openX.getAttribute('data-key') === sub.key;
    closeDetail();
    if (was) return;

    var x = el('div', 'aa-workx');
    x.setAttribute('data-key', sub.key);

    var mediaBox = el('div', 'aa-workx-media');
    var had = M26.renderMediaInto(mediaBox, sub);
    if (!had) {
      var q = el('div', 'aa-empty');
      q.appendChild(el('div', 'glyph', '❝'));
      q.appendChild(el('p', null, 'A written entry — the note is the work.'));
      mediaBox.appendChild(q);
    }
    x.appendChild(mediaBox);

    var side = el('div', 'aa-workx-side');
    side.appendChild(el('h3', null, sub.student));
    var meta = el('div', 'meta');
    [sub.kind + ' · ' + sub.type,
     sub.longDate + ' · ' + sub.time,
     'Week ' + sub.week + ' of ' + M26.CONFIG.weeks,
     'ID ' + sub.id].forEach(function (line) {
      meta.appendChild(el('div', null, line));
    });
    side.appendChild(meta);
    if (sub.text) side.appendChild(el('p', 'note', sub.text));

    var row = el('div', 'row');
    var close = el('button', 'aa-btn', 'Close ✕');
    close.type = 'button';
    close.addEventListener('click', function (e) { e.stopPropagation(); closeDetail(); });
    row.appendChild(close);
    side.appendChild(row);
    x.appendChild(side);

    card.insertAdjacentElement('afterend', x);
    x.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    openX = x;
  }

  /* ------------------------------------------------- student workspace header
     When the wall is filtered to one student, their headshot (a quiet grey
     placeholder until real portraits arrive) and name sit above the filters. */
  function silhouette(W, H) {
    var cv = document.createElement('canvas');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = W * dpr; cv.height = H * dpr;
    var g = cv.getContext('2d'); g.scale(dpr, dpr);
    g.fillStyle = '#eceae2'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#b9b5aa';
    g.beginPath(); g.arc(W / 2, H * 0.40, W * 0.20, 0, 6.2832); g.fill();
    g.beginPath(); g.ellipse(W / 2, H * 1.02, W * 0.36, H * 0.30, 0, Math.PI, 0); g.fill();
    return cv;
  }
  /* optional student profiles (bio / links / photo) — same file the ledger reads */
  var _profiles = null;
  function profiles() {
    if (_profiles) return _profiles;
    var url = M26.SANDBOX ? 'data/sandbox/profiles.json' : 'data/profiles.json';
    _profiles = fetch(url, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; });
    return _profiles;
  }
  function safeHttp(u) {
    u = String(u == null ? '' : u).trim();
    return /^https?:\/\//i.test(u) ? u : '';
  }

  function studentHeader() {
    var host = document.getElementById('aa-work-student');
    if (!host) return;
    host.textContent = '';
    if (!D || state.student === 'all' || !D.roster[state.student]) return;
    var i = state.student, name = D.roster[i];
    var mine = D.submissions.filter(function (s) { return s.studentIndex === i; })
      .sort(function (a, b) { return a.t - b.t; });

    var box = el('div', 'aa-workstu');

    var head = el('div', 'head');
    var ph = el('span', 'ph');
    ph.style.borderLeftColor = M26.colorFor(i, D.roster.length, 46);
    ph.appendChild(silhouette(76, 92));
    head.appendChild(ph);
    var side = el('div', 'who');
    side.appendChild(el('b', null, name));
    side.appendChild(el('span', null, 'Student ' + ('0' + (i + 1)).slice(-2) + ' · M26 · CEPT · 2026'));
    head.appendChild(side);
    box.appendChild(head);

    /* the about — a casual page for the student: their bio when they write one,
       and an honest reading of their record meanwhile */
    var about = el('div', 'about');
    var bioP = el('p', 'bio');
    about.appendChild(bioP);

    var facts = el('p', 'facts');
    if (!mine.length) {
      facts.textContent = 'Nothing on the record yet — this page fills up the moment ' + name + ' files their first work.';
    } else {
      var weeks = {};
      mine.forEach(function (s) { weeks[s.week] = 1; });
      var kinds = {};
      mine.forEach(function (s) { kinds[s.kind] = (kinds[s.kind] || 0) + 1; });
      var top = Object.keys(kinds).sort(function (a, b) { return kinds[b] - kinds[a]; })[0];
      facts.textContent = mine.length + (mine.length === 1 ? ' work' : ' works') + ' filed across '
        + Object.keys(weeks).length + (Object.keys(weeks).length === 1 ? ' week' : ' weeks')
        + ' — first on ' + mine[0].longDate + ', latest on ' + mine[mine.length - 1].longDate
        + (top ? '. Mostly ' + top + 's.' : '.');
    }
    about.appendChild(facts);
    var links = el('p', 'links');
    about.appendChild(links);
    box.appendChild(about);

    profiles().then(function (pf) {
      var p = pf && pf[M26.slugFor(name)];
      bioP.textContent = p && p.role ? p.role : '';
      if (p && p.bio) { bioP.textContent = (p.role ? p.role + ' — ' : '') + p.bio; }
      else if (!p || !p.role) { bioP.textContent = 'No bio yet — this space is ' + name + '’s to write.'; }
      if (p && p.links) {
        Object.keys(p.links).forEach(function (k) {
          var u = safeHttp(p.links[k]);
          if (!u) return;
          var a = el('a', null, k + ' ↗');
          a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer';
          links.appendChild(a);
        });
      }
      if (p && p.photo) {
        var u2 = String(p.photo).trim();
        if (u2 && !/^[a-z][a-z0-9+.-]*:/i.test(u2) || /^https?:\/\//i.test(u2)) {
          var img = document.createElement('img');
          img.alt = name; img.loading = 'lazy';
          img.onload = function () { ph.textContent = ''; ph.appendChild(img); };
          img.src = u2;
        }
      }
    });

    host.appendChild(box);
  }

  /* -------------------------------------------------------------------- paint */
  function paint() {
    studentHeader();
    var host = document.getElementById('aa-work-grid');
    if (!host) return;
    host.textContent = '';
    closeDetail();

    if (!D.submissions.length) {
      var e = el('div', 'aa-empty');
      e.appendChild(el('div', 'glyph', '◇ ◇ ◇'));
      e.appendChild(el('p', null, 'The record is empty — it fills the moment the first submission is filed.'));
      e.appendChild(el('span', 'aa-kicker', 'Week ' + M26.weekOf(new Date()) + ' · the record is live'));
      host.appendChild(e);
      return;
    }

    var rows = D.submissions.filter(matches).sort(function (a, b) { return b.t - a.t; });
    if (!rows.length) {
      var e2 = el('div', 'aa-empty');
      e2.appendChild(el('div', 'glyph', '·'));
      e2.appendChild(el('p', null, 'Nothing on record under this filter — yet.'));
      host.appendChild(e2);
      return;
    }
    grid = el('div', 'aa-grid');
    rows.forEach(function (s) { grid.appendChild(cardFor(s)); });
    host.appendChild(grid);
  }

  /* deep link: work.html#<key> opens that entry */
  function openFromHash() {
    var key = decodeURIComponent(location.hash.slice(1));
    if (!key) return;
    var sub = null;
    for (var i = 0; i < D.submissions.length; i++) {
      if (D.submissions[i].key === key) { sub = D.submissions[i]; break; }
    }
    if (!sub) return;
    var card = document.getElementById('sub-' + sub.key);
    if (card) {
      toggleDetail(card, sub);
      setTimeout(function () { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60);
    }
  }

  function init() {
    M26.loadAll().then(function (d) {
      D = d;
      buildFilters();
      paint();
      openFromHash();
    }).catch(function (err) {
      var host = document.getElementById('aa-work-grid');
      if (host) {
        var e = el('div', 'aa-empty');
        e.appendChild(el('p', null, 'The record could not be read: ' + (err && err.message || err)));
        host.appendChild(e);
      }
    });
  }

  /* the cohort index drives this: show one student's record (or 'all') */
  function filterStudent(idx) {
    if (!D) return;
    state.student = idx;
    state.week = 'all'; state.type = 'all';
    syncChips();
    paint();
    var host = document.getElementById('aa-work-grid');
    if (host && host.closest('.aa-panel')) host.closest('.aa-panel').scrollTop = 0;
  }

  window.AAWork = { init: init, filterStudent: filterStudent };
})();
