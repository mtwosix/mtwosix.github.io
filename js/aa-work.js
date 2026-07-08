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
      host.appendChild(c);
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
    if (sub.studentIndex >= 0) {
      var dossier = el('a', 'aa-btn', 'Dossier →');
      dossier.href = M26.pageUrl('people.html', '#' + M26.slugFor(sub.student));
      row.appendChild(dossier);
    }
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

  /* -------------------------------------------------------------------- paint */
  function paint() {
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
    AAShell.data().then(function (d) {
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

  window.AAWork = { init: init };
})();
