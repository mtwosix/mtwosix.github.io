/* ============================================================================
   M26 shell — the institution's chrome  (js/aa-shell.js)

   One script mounts the shared skeleton on every page: masthead + mega
   navigation, the mobile overlay index, the marquee of the present tense,
   the footer, the live glyph field behind the page, and the scroll-reveal
   choreography.

   Depends on js/m26-core.js (window.M26) — all data shown anywhere in the
   chrome (marquee, counters) is a strict 1:1 mirror of the two CSVs; when
   they are empty the chrome says so instead of inventing content. Untrusted
   CSV values only ever reach the DOM via textContent.

   Usage (plain script, no build step):
     <div id="aa-mast"></div> … <div id="aa-foot"></div>
     <script>AAShell.mount({ active: 'work' });</script>
   ============================================================================ */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function frag() { return document.createDocumentFragment(); }
  function url(page, hash) { return M26.pageUrl(page, hash); }

  /* ------------------------------------------------------------------- nav
     The whole site, one model. `sup` is the index number the school prints
     beside its sections; megas are short — a blurb plus the room's contents. */
  var NAV = [
    { key: 'studio', label: 'Studio', page: 'studio.html', sup: '01',
      blurb: 'A design studio at CEPT for futures thinking & systems design.',
      links: [
        { t: 'The brief', d: 'what M26 is', page: 'studio.html', hash: '#brief' },
        { t: 'How it works', d: 'form → sheet → archive', page: 'studio.html', hash: '#how' },
        { t: 'Calendar', d: '18 weeks', page: 'studio.html', hash: '#calendar' }
      ] },
    { key: 'work', label: 'Work', page: 'work.html', sup: '02',
      blurb: 'Every submission, in the order it arrived. Nothing curated away.',
      links: [
        { t: 'All submissions', d: 'the full record', page: 'work.html' },
        { t: 'This week', d: 'newest first', page: 'work.html', hash: '#latest' }
      ] },
    { key: 'people', label: 'People', page: 'people.html', sup: '03',
      blurb: 'The cohort — one rule per student, one dossier per name.',
      links: [
        { t: 'The ledger', d: 'roster + activity', page: 'people.html' }
      ] },
    { key: 'canvas', label: 'Canvas', page: 'canvas.html', sup: '04',
      blurb: 'The whole semester as one field of points — the living archive.',
      links: [
        { t: 'Enter the canvas', d: 'full screen', page: 'canvas.html' }
      ] }
  ];

  /* ------------------------------------------------------------- masthead */
  function buildMast(active) {
    var mast = el('header', 'aa-mast');
    mast.setAttribute('role', 'banner');
    var inner = el('div', 'aa-wrap');
    var row = el('div', 'aa-mast-in');

    var brand = el('a', 'aa-brand');
    brand.href = url('index.html');
    brand.setAttribute('aria-label', 'M26 Studio — home');
    var block = el('div', 'aa-brand-block', 'M26');
    var word = el('div', 'aa-brand-word');
    word.appendChild(el('b', null, 'M26 Studio'));
    word.appendChild(el('span', null, 'Imagination Infrastructure · CEPT · 2026'));
    brand.appendChild(block); brand.appendChild(word);
    row.appendChild(brand);

    var nav = el('nav', 'aa-nav');
    nav.setAttribute('aria-label', 'Primary');
    NAV.forEach(function (item) {
      var li = el('div', 'aa-nav-item');
      var a = el('a', 'aa-nav-link');
      a.href = url(item.page);
      a.appendChild(document.createTextNode(item.label));
      var sup = el('sup', null, item.sup); a.appendChild(sup);
      if (item.key === active) a.setAttribute('aria-current', 'page');
      li.appendChild(a);

      var mega = el('div', 'aa-mega');
      var blurb = el('p', 'aa-mega-blurb', item.blurb);
      mega.appendChild(blurb);
      item.links.forEach(function (l) {
        var la = el('a');
        la.href = url(l.page, l.hash || '');
        la.appendChild(el('b', null, l.t));
        la.appendChild(el('span', null, l.d));
        mega.appendChild(la);
      });
      li.appendChild(mega);
      nav.appendChild(li);
    });
    row.appendChild(nav);

    var cta = el('a', 'aa-mast-cta', 'Submit ↗');
    cta.href = M26.CONFIG.formUrl;
    cta.target = '_blank'; cta.rel = 'noopener noreferrer';
    row.appendChild(cta);

    var burger = el('button', 'aa-burger');
    burger.type = 'button';
    burger.setAttribute('aria-label', 'Menu');
    burger.setAttribute('aria-expanded', 'false');
    burger.appendChild(el('i')); burger.appendChild(el('i')); burger.appendChild(el('i'));
    burger.addEventListener('click', function () {
      var open = document.body.classList.toggle('nav-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    row.appendChild(burger);

    inner.appendChild(row);
    mast.appendChild(inner);
    return mast;
  }

  /* ------------------------------------------------- mobile overlay index */
  function buildOverlay(active) {
    var ov = el('div', 'aa-overlay');
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-label', 'Site navigation');
    var list = el('ul', 'aa-overlay-list');
    NAV.forEach(function (item) {
      var li = el('li');
      var a = el('a');
      a.href = url(item.page);
      if (item.key === active) a.setAttribute('aria-current', 'page');
      a.appendChild(el('em', null, item.sup));
      a.appendChild(el('b', null, item.label));
      a.appendChild(el('span', null, '→'));
      li.appendChild(a);
      list.appendChild(li);
    });
    var sub = el('li');
    var sa = el('a');
    sa.href = M26.CONFIG.formUrl; sa.target = '_blank'; sa.rel = 'noopener noreferrer';
    sa.appendChild(el('em', null, '05'));
    sa.appendChild(el('b', null, 'Submit'));
    sa.appendChild(el('span', null, '↗'));
    sub.appendChild(sa);
    list.appendChild(sub);
    ov.appendChild(list);

    var foot = el('div', 'aa-overlay-foot');
    foot.appendChild(document.createTextNode('M26 Studio · CEPT · 2026 — a living archive. '));
    var d = el('a', null, 'data/submissions.csv');
    d.href = M26.CONFIG.submissionsCsv;
    foot.appendChild(d);
    ov.appendChild(foot);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('nav-open')) {
        document.body.classList.remove('nav-open');
        var b = $('.aa-burger'); if (b) b.setAttribute('aria-expanded', 'false');
      }
    });
    return ov;
  }

  /* -------------------------------------------------------------- marquee
     The present tense of the studio, from the CSVs only. Empty archive →
     the strip says the archive is empty; it never invents a feed. */
  function buildMarquee() {
    var m = el('div', 'aa-marquee');
    m.setAttribute('aria-hidden', 'true');
    var track = el('div', 'aa-marquee-track');
    m.appendChild(track);

    function seg(parts) {
      var s = el('span', 'aa-marquee-seg');
      parts.forEach(function (p) {
        if (p.sep) s.appendChild(el('span', 'sep', '·'));
        else if (p.b) s.appendChild(el('b', null, p.b));
        else if (p.dim) s.appendChild(el('span', 'dim', p.dim));
        else s.appendChild(document.createTextNode(p.t));
      });
      return s;
    }

    data().then(function (d) {
      var week = M26.weekOf(new Date());
      var head = [{ b: 'M26 STUDIO' }, { sep: 1 }, { dim: 'WEEK ' + week + ' OF ' + M26.CONFIG.weeks }];
      var segs = [];
      if (d.submissions.length) {
        var latest = d.submissions.slice().sort(function (a, b) { return b.t - a.t; }).slice(0, 12);
        latest.forEach(function (s) {
          segs.push(seg([
            { b: s.student }, { sep: 1 }, { t: s.kind }, { sep: 1 },
            { dim: s.type }, { sep: 1 }, { dim: s.dateStr + ' · W' + s.week }
          ]));
        });
      } else {
        segs.push(seg([{ dim: 'THE ARCHIVE IS EMPTY — AWAITING FIRST SUBMISSIONS' }]));
      }
      segs.unshift(seg(head));
      segs.push(seg([{ dim: d.roster.length + ' STUDENTS' }, { sep: 1 }, { dim: d.submissions.length + ' SUBMISSIONS ON RECORD' }]));

      // two copies -> seamless -50% loop; speed follows content length
      var half = frag();
      segs.forEach(function (s) { half.appendChild(s); });
      track.appendChild(half);
      segs.forEach(function (s) { track.appendChild(s.cloneNode(true)); });
      var t = Math.max(26, Math.min(140, track.scrollWidth / 60));
      track.style.setProperty('--marq-t', t + 's');
    }).catch(function () {
      track.appendChild(seg([{ dim: 'M26 STUDIO · CEPT · 2026' }]));
    });
    return m;
  }

  /* ---------------------------------------------------------------- footer */
  function buildFooter() {
    var f = el('footer', 'aa-footer');
    f.setAttribute('role', 'contentinfo');
    var wrap = el('div', 'aa-wrap');

    wrap.appendChild(el('p', 'aa-footer-word', 'M26 STUDIO'));

    var grid = el('div', 'aa-footer-grid');

    var c0 = el('div');
    c0.appendChild(el('h4', null, 'The studio'));
    var state = el('p', 'aa-footer-state',
      'A living archive of a semester at CEPT — every submission a point, every student a thread. Built on paper, ink, and two CSV files.');
    c0.appendChild(state);
    grid.appendChild(c0);

    var c1 = el('div');
    c1.appendChild(el('h4', null, 'Navigate'));
    var l1 = el('ul', 'aa-footer-links');
    NAV.forEach(function (item) {
      var li = el('li'); var a = el('a', null, item.label);
      a.href = url(item.page); li.appendChild(a); l1.appendChild(li);
    });
    c1.appendChild(l1);
    grid.appendChild(c1);

    var c2 = el('div');
    c2.appendChild(el('h4', null, 'Take part'));
    var l2 = el('ul', 'aa-footer-links');
    [['Submit work ↗', M26.CONFIG.formUrl, true],
     ['The canvas', url('canvas.html'), false],
     ['The ledger', url('people.html'), false]].forEach(function (r) {
      var li = el('li'); var a = el('a', null, r[0]);
      a.href = r[1];
      if (r[2]) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      li.appendChild(a); l2.appendChild(li);
    });
    c2.appendChild(l2);
    grid.appendChild(c2);

    var c3 = el('div');
    c3.appendChild(el('h4', null, 'The record'));
    var l3 = el('ul', 'aa-footer-links');
    [['submissions.csv', M26.CONFIG.submissionsCsv],
     ['students.csv', M26.CONFIG.studentsCsv]].forEach(function (r) {
      var li = el('li'); var a = el('a', null, r[0]);
      a.href = r[1]; li.appendChild(a); l3.appendChild(li);
    });
    c3.appendChild(l3);
    grid.appendChild(c3);

    wrap.appendChild(grid);

    var meta = el('div', 'aa-footer-meta');
    meta.appendChild(el('span', null, 'M26 Studio · CEPT University · 2026'));
    var mid = el('span');
    mid.appendChild(document.createTextNode('The site is a strict 1:1 mirror of '));
    var ma = el('a', null, 'the record'); ma.href = M26.CONFIG.submissionsCsv;
    mid.appendChild(ma);
    mid.appendChild(document.createTextNode(' — nothing shown is invented.'));
    meta.appendChild(mid);
    meta.appendChild(el('span', null, 'Imagination Infrastructure'));
    wrap.appendChild(meta);

    f.appendChild(wrap);
    return f;
  }

  /* --------------------------------------------- the field behind the page
     A sparse drift of the studio's structure-glyphs — the cloud's dust
     settling through the institutional pages. Nearly subliminal: low count,
     low alpha, slow. Off under prefers-reduced-motion (a still scatter). */
  function mountField() {
    if (document.getElementById('aa-field')) return;
    var cv = document.createElement('canvas');
    cv.id = 'aa-field';
    cv.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(cv, document.body.firstChild);
    var g = cv.getContext('2d');
    var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var GLYPHS = ['◆', '○', '■', '◇', '□', '┼', '╳', '▚', '▞', '·', '▁', '▂'];
    var pts = [], W = 0, H = 0, dpr = 1, raf = 0, running = false;

    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = innerWidth; H = innerHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      var want = Math.min(70, Math.round(W * H / 26000));
      while (pts.length < want) pts.push(spawn(true));
      pts.length = want;
    }
    function spawn(anywhere) {
      return {
        x: Math.random() * W,
        y: anywhere ? Math.random() * H : H + 20,
        vx: (Math.random() - .5) * .06,
        vy: -(.03 + Math.random() * .1),
        ch: GLYPHS[(Math.random() * GLYPHS.length) | 0],
        s: 9 + Math.random() * 8,
        a: .05 + Math.random() * .07,
        w: Math.random() * 6.283,
        wv: .002 + Math.random() * .004
      };
    }
    function draw() {
      g.clearRect(0, 0, W, H);
      g.fillStyle = '#1d1b17';
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        if (!reduced) {
          p.w += p.wv;
          p.x += p.vx + Math.sin(p.w) * .05;
          p.y += p.vy;
          if (p.y < -24 || p.x < -24 || p.x > W + 24) pts[i] = p = spawn(false);
        }
        g.globalAlpha = p.a;
        g.font = p.s + 'px "Space Mono", monospace';
        g.fillText(p.ch, p.x, p.y);
      }
      g.globalAlpha = 1;
      if (!reduced && running) raf = requestAnimationFrame(draw);
    }
    function start() { if (running || reduced) { draw(); return; } running = true; raf = requestAnimationFrame(draw); }
    function stop() { running = false; cancelAnimationFrame(raf); }
    addEventListener('resize', function () { size(); if (reduced) draw(); });
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
    size(); start();
  }

  /* ------------------------------------------------------ reveal choreography */
  function mountReveals() {
    var els = document.querySelectorAll('.aa-reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (n) { n.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .05 });
    els.forEach(function (n) { io.observe(n); });
  }

  /* ------------------------------------------------- shared data, one load */
  var _data = null;
  function data() { return _data || (_data = M26.loadAll()); }

  /* live counters — any element with [data-aa] gets its figure filled in */
  function fillCounters() {
    var nodes = document.querySelectorAll('[data-aa]');
    if (!nodes.length) return;
    var week = M26.weekOf(new Date());
    nodes.forEach(function (n) {
      var k = n.getAttribute('data-aa');
      if (k === 'week') { n.textContent = String(week).padStart ? String(week).padStart(2, '0') : ('0' + week).slice(-2); }
      if (k === 'weeks') n.textContent = M26.CONFIG.weeks;
    });
    data().then(function (d) {
      nodes.forEach(function (n) {
        var k = n.getAttribute('data-aa');
        if (k === 'students') n.textContent = d.roster.length;
        if (k === 'subs') n.textContent = d.submissions.length;
        if (k === 'active') {
          var seen = {};
          d.submissions.forEach(function (s) { seen[s.studentIndex] = 1; });
          n.textContent = Object.keys(seen).length;
        }
      });
    });
  }

  /* ------------------------------------------------------------------ mount */
  function mount(opts) {
    opts = opts || {};
    document.body.classList.add('aa-body');

    var mastSlot = document.getElementById('aa-mast');
    if (mastSlot) {
      mastSlot.appendChild(buildMast(opts.active));
      if (opts.marquee !== false) mastSlot.appendChild(buildMarquee());
      document.body.appendChild(buildOverlay(opts.active));
    }
    var footSlot = document.getElementById('aa-foot');
    if (footSlot) footSlot.appendChild(buildFooter());

    if (opts.field !== false) mountField();
    mountReveals();
    fillCounters();
  }

  window.AAShell = { mount: mount, data: data, NAV: NAV, el: el };
})();
