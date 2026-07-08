/* ============================================================================
   M26 home — the front page under the institution chrome  (js/aa-home.js)

   Fills the homepage from the two CSVs via window.M26 (strict 1:1 mirror,
   honest empty states) and mounts the fixed canvas window: a poster first,
   the real instrument (canvas.html in an iframe) only when switched on —
   the 3D runtime is heavy and shouldn't tax phones that never scroll here.

   Untrusted CSV values reach the DOM via textContent only.
   ============================================================================ */
(function () {
  'use strict';

  var el = function (tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  /* keep the sandbox switch alive across every internal link on the page */
  function fixLinks() {
    [['aa-canvas-full', 'canvas.html'], ['aa-canvas-full2', 'canvas.html'],
     ['aa-work-more', 'work.html'], ['aa-people-more', 'people.html'],
     ['aa-studio-more', 'studio.html']].forEach(function (r) {
      var a = document.getElementById(r[0]);
      if (a) a.href = M26.pageUrl(r[1]);
    });
    var s = document.getElementById('aa-submit-link');
    if (s) s.href = M26.CONFIG.formUrl;
  }

  /* ---- the fixed window: poster → iframe on demand ---- */
  function mountCanvasWindow() {
    var btn = document.getElementById('aa-canvas-on');
    var stage = document.getElementById('aa-canvas-stage');
    var poster = document.getElementById('aa-canvas-poster');
    if (!btn || !stage || !poster) return;
    btn.addEventListener('click', function () {
      var fr = document.createElement('iframe');
      fr.src = 'canvas.html?embed' + (M26.SANDBOX ? '&sandbox' : '');
      fr.title = 'The living canvas — the semester as a 3D point cloud';
      fr.loading = 'eager';
      fr.allow = 'autoplay';
      stage.insertBefore(fr, poster);
      poster.style.transition = 'opacity .6s';
      poster.style.opacity = '0';
      setTimeout(function () { if (poster.parentNode) poster.parentNode.removeChild(poster); }, 650);
    });
  }

  /* ---- latest work — newest eight entries as plates on a wall ---- */
  function cardFor(sub, d) {
    var card = el('a', 'aa-card');
    card.href = M26.pageUrl('work.html', '#' + encodeURIComponent(sub.key));
    card.style.textDecoration = 'none';

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
      ? M26.colorFor(sub.studentIndex, d.roster.length, 46) : '#9a958c';
    who.appendChild(dot);
    who.appendChild(el('b', null, sub.student));
    cap.appendChild(who);
    cap.appendChild(el('div', 'meta', sub.kind + ' · ' + sub.dateStr + ' · W' + sub.week));
    if (sub.text) cap.appendChild(el('div', 'note', sub.text));
    card.appendChild(cap);
    return card;
  }

  function emptyState(host, msgTop, msgSerif) {
    var e = el('div', 'aa-empty');
    e.appendChild(el('div', 'glyph', '◇ ◇ ◇'));
    e.appendChild(el('p', null, msgSerif));
    e.appendChild(el('span', 'aa-kicker', msgTop));
    host.appendChild(e);
  }

  function paintLatest(d) {
    var host = document.getElementById('aa-latest');
    if (!host) return;
    if (!d.submissions.length) {
      emptyState(host,
        'Week ' + M26.weekOf(new Date()) + ' · the record is live',
        'The archive is empty — it fills the moment the first submission is filed.');
      return;
    }
    var grid = el('div', 'aa-grid');
    d.submissions.slice().sort(function (a, b) { return b.t - a.t; })
      .slice(0, 8)
      .forEach(function (s) { grid.appendChild(cardFor(s, d)); });
    host.appendChild(grid);
  }

  /* ---- the cohort — an index, one row per student ---- */
  function paintCohort(d) {
    var host = document.getElementById('aa-cohort');
    if (!host) return;
    if (!d.roster.length) {
      emptyState(host,
        'Roster pending',
        'The cohort appears here as the roster is filled in — this is week zero.');
      return;
    }
    var counts = {};
    d.submissions.forEach(function (s) { counts[s.studentIndex] = (counts[s.studentIndex] || 0) + 1; });

    var index = el('div', 'aa-index');
    d.roster.forEach(function (name, i) {
      var row = el('a', 'aa-index-row');
      row.href = M26.pageUrl('people.html', '#' + M26.slugFor(name));
      var no = el('span', 'no', ('0' + (i + 1)).slice(-2));
      var mark = el('span', 'mark', M26.STU_GLYPH(i));
      mark.style.color = M26.colorFor(i, d.roster.length, 42);
      row.appendChild(no);
      row.appendChild(mark);
      row.appendChild(el('span', 'name', name));
      var tail = el('span', 'tail');
      var c = counts[i] || 0;
      tail.appendChild(el('span', null, c + (c === 1 ? ' submission' : ' submissions')));
      tail.appendChild(el('span', 'arrow', '→'));
      row.appendChild(tail);
      index.appendChild(row);
    });
    host.appendChild(index);
  }

  function init() {
    fixLinks();
    mountCanvasWindow();
    AAShell.data().then(function (d) {
      paintLatest(d);
      paintCohort(d);
    }).catch(function (err) {
      var host = document.getElementById('aa-latest');
      if (host) emptyState(host, 'Record unreachable', 'The record could not be read: ' + (err && err.message || err));
    });
  }

  window.AAHome = { init: init };
})();
