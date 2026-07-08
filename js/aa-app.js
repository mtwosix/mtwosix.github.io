/* ============================================================================
   M26 app — the one-screen institution  (js/aa-app.js)

   No page scroll, ever. The viewport is a room: the living canvas fills the
   middle, and the site's sections are docked as labelled bars on the edges —
   STUDIO on the left, WORK on the right, THE COHORT along the bottom, the
   masthead strip (with the ticker of the present tense) on top. Clicking a
   bar slides that panel in over the canvas; the bar again, ✕, or Esc slides
   it home. Panels scroll internally; the page never does.

   Deep links: #studio / #work / #cohort open a panel;
               #work=<slug> opens WORK filtered to one student.

   Data (ticker, counters, cohort, work) is a strict 1:1 mirror of the two
   CSVs via window.M26 — honest empty states, textContent only for untrusted
   values. Depends on m26-core.js, viewer.js, aa-work.js.
   ============================================================================ */
(function () {
  'use strict';

  var el = function (tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  var PANELS = ['studio', 'work', 'cohort'];
  var openKey = null;
  var _data = null;
  function data() { return _data || (_data = M26.loadAll()); }

  /* ------------------------------------------------------------ the panels */
  function barOf(key) { return document.querySelector('[data-bar="' + key + '"]'); }
  function panelOf(key) { return document.getElementById('panel-' + key); }

  function open(key, keepHash) {
    if (openKey === key) return;
    if (openKey) shut(openKey);
    openKey = key;
    var p = panelOf(key), b = barOf(key);
    if (p) { p.classList.add('open'); p.setAttribute('aria-hidden', 'false'); }
    if (b) b.setAttribute('aria-expanded', 'true');
    document.body.classList.add('panel-open');
    if (!keepHash && ('#' + key) !== location.hash) {
      try { history.replaceState(null, '', '#' + key); } catch (e) { location.hash = key; }
    }
  }
  function shut(key) {
    var p = panelOf(key), b = barOf(key);
    if (p) { p.classList.remove('open'); p.setAttribute('aria-hidden', 'true'); }
    if (b) b.setAttribute('aria-expanded', 'false');
    if (openKey === key) {
      openKey = null;
      document.body.classList.remove('panel-open');
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { location.hash = ''; }
    }
  }
  function toggle(key) { openKey === key ? shut(key) : open(key); }

  function mountPanels() {
    PANELS.forEach(function (key) {
      var b = barOf(key);
      if (b) b.addEventListener('click', function () { toggle(key); });
      var p = panelOf(key);
      if (p) {
        var x = p.querySelector('.aa-pclose');
        if (x) x.addEventListener('click', function () { shut(key); });
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && openKey) shut(openKey);
    });
    // hash routing — #work=zoya opens the work panel filtered to a student
    function route() {
      var h = decodeURIComponent(location.hash.slice(1));
      if (!h) return;
      var m = /^(studio|work|cohort)(?:=(.+))?$/.exec(h);
      if (!m) return;
      open(m[1], true);
      if (m[1] === 'work' && m[2]) {
        data().then(function (d) {
          for (var i = 0; i < d.roster.length; i++) {
            if (M26.slugFor(d.roster[i]) === m[2]) { AAWork.filterStudent(i); break; }
          }
        });
      }
    }
    window.addEventListener('hashchange', route);
    route();
  }

  /* -------------------------------------------------------------- the stage */
  function mountStage() {
    var stage = document.getElementById('aa-stage');
    if (!stage) return;
    var fr = document.createElement('iframe');
    fr.src = 'canvas.html?embed' + (M26.SANDBOX ? '&sandbox' : '');
    fr.title = 'The living canvas — every submission a point, every student a thread. Scroll to travel, drag to orbit.';
    fr.allow = 'autoplay';
    stage.appendChild(fr);
  }

  /* ------------------------------------------------------------- the ticker */
  function mountTicker() {
    var host = document.getElementById('aa-tick');
    if (!host) return;
    var track = el('div', 'aa-tick-track');
    host.appendChild(track);

    function seg(parts) {
      var s = el('span', 'aa-tick-seg');
      parts.forEach(function (p) {
        if (p.sep) s.appendChild(el('span', 'sep', '·'));
        else if (p.b) s.appendChild(el('b', null, p.b));
        else s.appendChild(el('span', 'dim', p.t));
      });
      return s;
    }

    data().then(function (d) {
      var segs = [];
      if (d.submissions.length) {
        d.submissions.slice().sort(function (a, b) { return b.t - a.t; }).slice(0, 14)
          .forEach(function (s) {
            segs.push(seg([{ b: s.student }, { sep: 1 }, { t: s.kind }, { sep: 1 }, { t: s.dateStr + ' · W' + s.week }]));
          });
        segs.push(seg([{ t: d.submissions.length + ' SUBMISSIONS ON RECORD' }]));
      } else {
        segs.push(seg([{ t: 'WEEK ' + M26.weekOf(new Date()) + ' OF ' + M26.CONFIG.weeks + ' — THE ARCHIVE IS EMPTY, AWAITING FIRST SUBMISSIONS' }]));
      }
      segs.forEach(function (s) { track.appendChild(s); });
      segs.forEach(function (s) { track.appendChild(s.cloneNode(true)); });
      var t = Math.max(24, Math.min(150, track.scrollWidth / 55));
      track.style.setProperty('--marq-t', t + 's');
    }).catch(function () {
      track.appendChild(seg([{ t: 'M26 STUDIO · CEPT · 2026' }]));
    });
  }

  /* ------------------------------------------------------------ the cohort */
  function paintCohort(d) {
    var host = document.getElementById('aa-cohort-host');
    if (!host) return;
    if (!d.roster.length) {
      var e = el('div', 'aa-empty');
      e.appendChild(el('div', 'glyph', '◇ ◇ ◇'));
      e.appendChild(el('p', null, 'The cohort appears here as the roster is filled in — this is week zero.'));
      e.appendChild(el('span', 'aa-kicker', 'Roster pending'));
      host.appendChild(e);
      return;
    }
    var counts = {};
    d.submissions.forEach(function (s) { counts[s.studentIndex] = (counts[s.studentIndex] || 0) + 1; });

    var index = el('div', 'aa-index');
    d.roster.forEach(function (name, i) {
      var row = el('button', 'aa-index-row');
      row.type = 'button';
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
      row.addEventListener('click', function () {
        open('work');
        AAWork.filterStudent(i);
        try { history.replaceState(null, '', '#work=' + M26.slugFor(name)); } catch (e) {}
      });
      index.appendChild(row);
    });
    host.appendChild(index);
  }

  /* --------------------------------------------------- studio panel extras */
  function mountStudio() {
    var host = document.getElementById('aa-weeks-host');
    if (host) {
      var strip = el('div', 'aa-weeks');
      var now = M26.weekOf(new Date());
      var start = M26.semesterStartDate();
      var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      for (var w = 1; w <= M26.CONFIG.weeks; w++) {
        var cell = el('div', 'aa-week' + (w === now ? ' now' : (w < now ? ' past' : '')));
        cell.appendChild(el('b', null, ('0' + w).slice(-2)));
        var d = new Date(start.getTime() + (w - 1) * 7 * 86400000);
        cell.appendChild(el('span', null, d.getDate() + ' ' + MON[d.getMonth()]));
        cell.appendChild(el('span', 'tick', w === now ? '● NOW' : (w < now ? '—' : '·')));
        strip.appendChild(cell);
      }
      host.appendChild(strip);
    }
    var q = M26.QUOTES[Math.floor(Math.random() * M26.QUOTES.length)];
    var qEl = document.getElementById('aa-quote'), qN = document.getElementById('aa-quote-name');
    if (qEl) qEl.textContent = '“' + q.text + '”';
    if (qN) qN.textContent = '— ' + q.name;
  }

  /* ------------------------------------------------------- counters + links */
  function fillCounters() {
    var week = M26.weekOf(new Date());
    document.querySelectorAll('[data-aa]').forEach(function (n) {
      var k = n.getAttribute('data-aa');
      if (k === 'week') n.textContent = ('0' + week).slice(-2);
      if (k === 'weeks') n.textContent = M26.CONFIG.weeks;
    });
    data().then(function (d) {
      document.querySelectorAll('[data-aa]').forEach(function (n) {
        var k = n.getAttribute('data-aa');
        if (k === 'students') n.textContent = d.roster.length;
        if (k === 'subs') n.textContent = d.submissions.length;
      });
    });
  }
  function fixLinks() {
    document.querySelectorAll('[data-form-link]').forEach(function (a) { a.href = M26.CONFIG.formUrl; });
    document.querySelectorAll('[data-page-link]').forEach(function (a) {
      a.href = M26.pageUrl(a.getAttribute('data-page-link'));
    });
  }

  /* ------------------------------------------------------------- the grain
     A whisper of film over everything — SVG turbulence tiled at low alpha. */
  function mountGrain() {
    if (document.getElementById('aa-grain')) return;
    var g = document.createElement('div');
    g.id = 'aa-grain';
    g.setAttribute('aria-hidden', 'true');
    document.body.appendChild(g);
  }

  function init() {
    document.body.classList.add('aa-body', 'aa-appb');
    mountStage();
    mountGrain();
    mountTicker();
    mountStudio();
    fillCounters();
    fixLinks();
    AAWork.init();
    data().then(paintCohort);
    mountPanels();
  }

  window.AAApp = { init: init, open: open, shut: shut };
})();
