/* ============================================================================
   M26 archive — the readable lens on the same two CSVs.

   Not a long scroll of everyone's everything: a field of student tiles. Each
   tile carries the most real image available for that student — a portrait if
   one exists in uploads/portraits/<slug>.jpg, else their latest image
   submission, else their actual constellation (one dot per real submission,
   drawn in their thread colour from the cloud). Choosing a student opens a
   panel with their work in order, filterable by kind and type.

   Used by archive.html (standalone) and index.html (the section the 3D dive
   descends into). Strictly a mirror of data/submissions.csv — empty states
   stay empty. All CSV values reach the DOM via textContent.
   Depends on js/m26-core.js (window.M26).
   ============================================================================ */
(function () {
  'use strict';

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* deterministic 0..1 from a string — keeps each constellation stable across visits */
  function hashRnd(str, salt) {
    var h = 2166136261 ^ salt;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) / 4294967295;
  }

  var SVG = 'http://www.w3.org/2000/svg';

  /* the student's real thread, miniature: one dot per submission, joined in order */
  function constellation(student) {
    var svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('class', 'm26-tile-const');
    svg.setAttribute('aria-hidden', 'true');
    var subs = student.subs;
    if (!subs.length) return svg; // an honest blank
    var minW = subs[0].week, maxW = subs[0].week;
    subs.forEach(function (s) { minW = Math.min(minW, s.week); maxW = Math.max(maxW, s.week); });
    var span = Math.max(1, maxW - minW);
    var ptsAttr = [], coords = [];
    subs.forEach(function (s, i) {
      var x = 16 + ((s.week - minW) / span) * 68 + (hashRnd(s.key, 7) - 0.5) * 12;
      var y = 22 + (i / Math.max(1, subs.length - 1)) * 56 + (hashRnd(s.key, 13) - 0.5) * 16;
      if (subs.length === 1) { x = 50; y = 50; }
      coords.push([x, y]);
      ptsAttr.push(x.toFixed(1) + ',' + y.toFixed(1));
    });
    if (coords.length > 1) {
      var line = document.createElementNS(SVG, 'polyline');
      line.setAttribute('points', ptsAttr.join(' '));
      line.setAttribute('fill', 'none');
      line.setAttribute('stroke', student.colorSoft);
      line.setAttribute('stroke-width', '0.8');
      line.setAttribute('opacity', '0.55');
      svg.appendChild(line);
    }
    coords.forEach(function (c) {
      var dot = document.createElementNS(SVG, 'circle');
      dot.setAttribute('cx', c[0].toFixed(1));
      dot.setAttribute('cy', c[1].toFixed(1));
      dot.setAttribute('r', '2.1');
      dot.setAttribute('fill', student.color);
      svg.appendChild(dot);
    });
    return svg;
  }

  /* tile visual: portrait → latest image submission → constellation */
  function tileVisual(student) {
    var wrap = el('span', 'm26-tile-visual');
    var latest = null;
    for (var i = student.subs.length - 1; i >= 0; i--) {
      var m = M26.resolveMedia(student.subs[i]);
      if (m.mode === 'img') { latest = m; break; }
    }
    function useConstellation() { wrap.textContent = ''; wrap.appendChild(constellation(student)); }
    function tryImg(srcs, onFail) {
      var img = document.createElement('img');
      img.alt = ''; // decorative — the tile's button text names the student
      img.loading = 'lazy'; img.decoding = 'async';
      var si = 0;
      img.onerror = function () {
        si++;
        if (si < srcs.length) { img.src = srcs[si]; return; }
        if (img.parentNode === wrap) wrap.removeChild(img);
        onFail();
      };
      img.src = srcs[0];
      wrap.appendChild(img);
    }
    tryImg(['uploads/portraits/' + student.slug + '.jpg'], function () {
      if (latest) tryImg([latest.src].concat(latest.srcAlt || []), useConstellation);
      else useConstellation();
    });
    return wrap;
  }

  /* ------------------------------------------------------------ the panel
     One overlay for the whole page, created on demand, attached to <body>
     (never inside #m26-archive — that element is transformed during the
     threshold, which would break position:fixed). */
  var panel = null, backdrop = null, lastFocus = null, openedSlug = null;

  function ensurePanel() {
    if (panel) return;
    backdrop = el('div', 'm26-panel-backdrop');
    backdrop.addEventListener('click', closePanel);
    panel = el('div', 'm26-panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Student work');
    document.body.appendChild(backdrop);
    document.body.appendChild(panel);
    document.addEventListener('keydown', function (e) {
      if (!openedSlug) return;
      if (e.key === 'Escape') { e.stopPropagation(); closePanel(); }
      if (e.key === 'Tab') { // keep focus inside the dialog
        var focusables = panel.querySelectorAll('a[href], button:not([disabled])');
        if (!focusables.length) return;
        var first = focusables[0], last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }, true);
  }

  function closePanel() {
    if (!openedSlug) return;
    openedSlug = null;
    panel.classList.remove('m26-panel-open');
    backdrop.classList.remove('m26-panel-open');
    document.documentElement.classList.remove('m26-lock');
    if (location.hash.indexOf('#s-') === 0) history.replaceState(null, '', location.pathname + location.search);
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
    lastFocus = null;
  }

  function openPanel(students, slug, fromEl) {
    var idx = students.findIndex(function (s) { return s.slug === slug; });
    if (idx < 0) return;
    ensurePanel();
    if (fromEl) lastFocus = fromEl;
    openedSlug = slug;
    history.replaceState(null, '', '#s-' + slug);
    fillPanel(students, idx);
    panel.classList.add('m26-panel-open');
    backdrop.classList.add('m26-panel-open');
    document.documentElement.classList.add('m26-lock');
    var closeBtn = panel.querySelector('.m26-panel-close');
    if (closeBtn) closeBtn.focus();
  }

  function fillPanel(students, idx) {
    var s = students[idx];
    var filter = { kind: null, type: null }; // null = all
    panel.textContent = '';
    panel.style.setProperty('--sc', s.color);
    panel.style.setProperty('--sc-soft', s.colorSoft);
    panel.scrollTop = 0;

    /* head: prev / name / next / close */
    var head = el('header', 'm26-panel-head');
    var nav = el('div', 'm26-panel-nav');
    var prev = students[(idx - 1 + students.length) % students.length];
    var next = students[(idx + 1) % students.length];
    var prevBtn = el('button', 'm26-btn-link', '← ' + prev.name);
    prevBtn.type = 'button';
    prevBtn.addEventListener('click', function () { openedSlug = prev.slug; history.replaceState(null, '', '#s-' + prev.slug); fillPanel(students, (idx - 1 + students.length) % students.length); });
    var nextBtn = el('button', 'm26-btn-link', next.name + ' →');
    nextBtn.type = 'button';
    nextBtn.addEventListener('click', function () { openedSlug = next.slug; history.replaceState(null, '', '#s-' + next.slug); fillPanel(students, (idx + 1) % students.length); });
    nav.appendChild(prevBtn);
    nav.appendChild(nextBtn);
    var closeBtn = el('button', 'm26-panel-close', '✕');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.addEventListener('click', closePanel);
    var title = el('div', 'm26-panel-title');
    title.appendChild(el('h2', 'm26-student-name', s.name));
    title.appendChild(el('p', 'm26-student-meta',
      s.subs.length ? s.subs.length + (s.subs.length === 1 ? ' submission · ' : ' submissions · ')
        + s.subs[0].dateStr + (s.subs.length > 1 ? ' — ' + s.subs[s.subs.length - 1].dateStr : '')
        : 'no submissions yet'));
    head.appendChild(title);
    head.appendChild(nav);
    head.appendChild(closeBtn);
    panel.appendChild(head);

    /* filters — only the kinds/types this student actually has */
    var kinds = [], types = [];
    s.subs.forEach(function (r) {
      if (kinds.indexOf(r.kind) < 0) kinds.push(r.kind);
      if (types.indexOf(r.type) < 0) types.push(r.type);
    });
    var listHost = el('div', 'm26-panel-body');
    function chipRow(label, options, key) {
      var row = el('div', 'm26-chips');
      row.appendChild(el('span', 'm26-label', label));
      var all = el('button', 'm26-chip', 'all');
      all.type = 'button'; all.setAttribute('aria-pressed', 'true');
      row.appendChild(all);
      var btns = [all];
      options.forEach(function (opt) {
        var b = el('button', 'm26-chip', opt);
        b.type = 'button'; b.setAttribute('aria-pressed', 'false');
        b.addEventListener('click', function () {
          filter[key] = filter[key] === opt ? null : opt;
          btns.forEach(function (x) { x.setAttribute('aria-pressed', String(x === (filter[key] ? b : all))); });
          renderList();
        });
        btns.push(b);
        row.appendChild(b);
      });
      all.addEventListener('click', function () {
        filter[key] = null;
        btns.forEach(function (x) { x.setAttribute('aria-pressed', String(x === all)); });
        renderList();
      });
      return row;
    }
    if (s.subs.length && (kinds.length > 1 || types.length > 1)) {
      var filters = el('div', 'm26-panel-filters');
      if (kinds.length > 1) filters.appendChild(chipRow('KIND', kinds, 'kind'));
      if (types.length > 1) filters.appendChild(chipRow('TYPE', types, 'type'));
      panel.appendChild(filters);
    }
    panel.appendChild(listHost);

    function renderList() {
      listHost.textContent = '';
      var rows = s.subs.filter(function (r) {
        return (!filter.kind || r.kind === filter.kind) && (!filter.type || r.type === filter.type);
      });
      if (!s.subs.length) {
        listHost.appendChild(el('p', 'm26-arch-status', 'No submissions yet.'));
        return;
      }
      if (!rows.length) {
        listHost.appendChild(el('p', 'm26-arch-status', 'Nothing matches this filter.'));
        return;
      }
      var list = el('ol', 'm26-subs');
      rows.forEach(function (row) {
        var li = el('li', 'm26-sub');
        var rail = el('div', 'm26-sub-rail');
        var time = el('time', 'm26-sub-date', row.dateStr);
        time.setAttribute('datetime', row.date.getFullYear() + '-'
          + ('0' + (row.date.getMonth() + 1)).slice(-2) + '-'
          + ('0' + row.date.getDate()).slice(-2));
        rail.appendChild(time);
        rail.appendChild(el('span', 'm26-sub-week', 'W' + row.week));
        rail.appendChild(el('span', 'm26-sub-kind', row.kind));
        li.appendChild(rail);
        var body = el('div', 'm26-sub-body');
        var fig = el('figure', 'm26-media');
        if (M26.renderMediaInto(fig, row)) body.appendChild(fig);
        if (row.text) body.appendChild(el('p', 'm26-sub-text', row.text));
        if (!row.text && !fig.childNodes.length) body.appendChild(el('p', 'm26-sub-text m26-sub-empty', '(no caption)'));
        li.appendChild(body);
        list.appendChild(li);
      });
      listHost.appendChild(list);
    }
    renderList();
  }

  /* ------------------------------------------------------------- page build */
  function render(container, opts) {
    opts = opts || {};
    container.classList.add('m26-arch');
    container.textContent = '';
    container.appendChild(el('p', 'm26-arch-status', 'reading the archive…'));

    M26.loadAll().then(function (data) {
      container.textContent = '';
      build(container, data, opts);
    }).catch(function (err) {
      container.textContent = '';
      container.appendChild(el('p', 'm26-arch-status', 'The archive could not be loaded — ' + err.message + '.'));
      var retry = el('button', 'm26-btn', 'TRY AGAIN');
      retry.type = 'button';
      retry.addEventListener('click', function () { render(container, opts); });
      container.appendChild(retry);
    });
  }

  function build(container, data, opts) {
    var roster = data.roster;
    var subs = data.submissions;

    var students = roster.map(function (name, i) {
      return {
        name: name, rosterIndex: i,
        color: M26.colorFor(i, roster.length, 46),
        colorSoft: M26.colorFor(i, roster.length, 66),
        slug: M26.slugFor(name),
        subs: subs.filter(function (r) { return r.studentIndex === i; })
                  .sort(function (a, b) { return a.t - b.t; })
      };
    }).sort(function (a, b) { return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }); });

    /* head */
    var head = el('header', 'm26-arch-head');
    if (opts.embedded && opts.onReturn) {
      var ret = el('button', 'm26-btn m26-return', '↑ BACK INTO THE CLOUD');
      ret.type = 'button';
      ret.addEventListener('click', opts.onReturn);
      head.appendChild(ret);
    }
    head.appendChild(el('p', 'm26-eyebrow', 'M26 STUDIO · CEPT · 2026'));
    head.appendChild(el('h1', 'm26-arch-title', 'Imagination Infrastructure'));
    var sub = el('p', 'm26-arch-sub');
    sub.appendChild(document.createTextNode('The archive. Choose a student to open their semester. '));
    if (!opts.embedded) {
      var cloudLink = el('a', 'm26-link', 'Enter the cloud →');
      cloudLink.href = 'index.html';
      sub.appendChild(cloudLink);
    }
    head.appendChild(sub);
    container.appendChild(head);

    /* the field of students */
    var main = el('main', 'm26-arch-main');
    main.id = 'm26-main';
    if (!roster.length) {
      main.appendChild(el('p', 'm26-arch-status', 'No students on the roster yet.'));
    } else {
      var grid = el('ul', 'm26-grid');
      students.forEach(function (s) {
        var li = el('li');
        var tile = el('button', 'm26-tile');
        tile.type = 'button';
        tile.setAttribute('aria-haspopup', 'dialog');
        tile.style.setProperty('--sc', s.color);
        tile.style.setProperty('--sc-soft', s.colorSoft);
        tile.appendChild(tileVisual(s));
        var label = el('span', 'm26-tile-label');
        label.appendChild(el('span', 'm26-tile-name', s.name));
        var months = s.subs.length
          ? (s.subs[0].dateStr.slice(3) + (s.subs.length > 1 ? ' — ' + s.subs[s.subs.length - 1].dateStr.slice(3) : ''))
          : '';
        label.appendChild(el('span', 'm26-tile-meta',
          s.subs.length ? s.subs.length + (s.subs.length === 1 ? ' work · ' : ' works · ') + months
                        : 'no submissions yet'));
        tile.appendChild(label);
        tile.addEventListener('click', function () { openPanel(students, s.slug, tile); });
        li.appendChild(tile);
        grid.appendChild(li);
      });
      main.appendChild(grid);
    }
    container.appendChild(main);

    /* foot */
    var foot = el('footer', 'm26-arch-foot');
    foot.appendChild(el('p', 'm26-arch-count',
      roster.length + (roster.length === 1 ? ' student' : ' students') + ' · '
      + subs.length + (subs.length === 1 ? ' submission' : ' submissions')));
    if (data.unmatched.length) {
      var names = data.unmatched.map(function (r) { return r.student; })
        .filter(function (n, i, a) { return a.indexOf(n) === i; }).join(', ');
      foot.appendChild(el('p', 'm26-arch-warn',
        data.unmatched.length + ' submission' + (data.unmatched.length === 1 ? ' is' : 's are')
        + ' on file but not shown — the Student name doesn’t match the roster: ' + names + '.'));
    }
    var links = el('p', 'm26-arch-links');
    var formA = el('a', 'm26-link', 'SUBMIT WORK →');
    formA.href = M26.CONFIG.formUrl; formA.target = '_blank'; formA.rel = 'noopener noreferrer';
    links.appendChild(formA);
    if (opts.embedded && opts.onReturn) {
      var back = el('button', 'm26-btn-link', 'BACK INTO THE CLOUD ↑');
      back.type = 'button';
      back.addEventListener('click', function () { opts.onReturn(); });
      links.appendChild(back);
    } else {
      var cl = el('a', 'm26-link', 'THE CLOUD →');
      cl.href = 'index.html';
      links.appendChild(cl);
    }
    foot.appendChild(links);
    container.appendChild(foot);

    /* deep link: #s-slug opens that student directly */
    var m = /^#s-(.+)$/.exec(location.hash);
    if (m && students.some(function (s) { return s.slug === m[1]; }) && !openedSlug) {
      openPanel(students, m[1], null);
    }
  }

  window.M26Archive = { render: render, closePanel: closePanel };
})();
