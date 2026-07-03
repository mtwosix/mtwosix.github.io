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

  /* ------------------------------------------------------------ the drawer
     Choosing a student opens their work IN PLACE, in a row of the same grid,
     directly under their tile — the page keeps its ordinary scroll. One
     drawer exists; it moves to whichever tile was chosen. No modal, no
     backdrop, no trapped focus: Esc or ✕ or re-tapping the tile closes it. */
  var drawerLi = null, drawerWrap = null, drawerBox = null, openedSlug = null, openerTile = null, escBound = false;
  var tileBySlug = {}; // rebuilt with each render

  function ensureDrawer() {
    if (drawerLi && document.contains(drawerLi)) return;
    drawerLi = el('li', 'm26-drawer-item');
    drawerWrap = el('div', 'm26-drawer');
    var inner = el('div', 'm26-drawer-inner');
    drawerBox = el('div', 'm26-drawer-box');
    drawerBox.setAttribute('role', 'region');
    inner.appendChild(drawerBox);
    drawerWrap.appendChild(inner);
    drawerLi.appendChild(drawerWrap);
    if (!escBound) {
      escBound = true;
      document.addEventListener('keydown', function (e) {
        if (openedSlug && e.key === 'Escape') closeDrawer();
      });
    }
  }

  function closeDrawer() {
    if (!openedSlug) return;
    openedSlug = null;
    drawerWrap.classList.remove('m26-open');
    if (openerTile) openerTile.setAttribute('aria-expanded', 'false');
    var returnTo = openerTile;
    openerTile = null;
    if (location.hash.indexOf('#s-') === 0) history.replaceState(null, '', location.pathname + location.search);
    if (returnTo && document.contains(returnTo)) returnTo.focus();
    setTimeout(function () { // lift out of the grid once the fold-up has run
      if (!openedSlug && drawerLi && drawerLi.parentNode) drawerLi.parentNode.removeChild(drawerLi);
    }, 750);
  }

  function openDrawer(students, slug, tileBtn) {
    var idx = -1;
    for (var i = 0; i < students.length; i++) if (students[i].slug === slug) { idx = i; break; }
    if (idx < 0) return;
    if (openedSlug === slug) { closeDrawer(); return; } // tapping the open tile folds it away
    ensureDrawer();
    if (openerTile) openerTile.setAttribute('aria-expanded', 'false');
    openedSlug = slug;
    openerTile = tileBtn || null;
    if (openerTile) openerTile.setAttribute('aria-expanded', 'true');
    history.replaceState(null, '', '#s-' + slug);
    fillDrawer(students, idx);
    var li = tileBtn && tileBtn.closest ? tileBtn.closest('li') : null;
    var grid = li ? li.parentNode : document.querySelector('.m26-grid');
    if (!grid) return;
    if (li && li.nextSibling) grid.insertBefore(drawerLi, li.nextSibling);
    else grid.appendChild(drawerLi);
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      drawerWrap.classList.add('m26-open');
      var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      drawerBox.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
    }); });
  }

  function fillDrawer(students, idx) {
    var s = students[idx];
    var filter = { kind: null, type: null }; // null = all
    drawerBox.textContent = '';
    drawerBox.setAttribute('aria-label', s.name);
    drawerBox.style.setProperty('--sc', s.color);
    drawerBox.style.setProperty('--sc-soft', s.colorSoft);

    /* head: name / prev / next / close */
    var head = el('header', 'm26-panel-head');
    var nav = el('div', 'm26-panel-nav');
    var prev = students[(idx - 1 + students.length) % students.length];
    var next = students[(idx + 1) % students.length];
    var go = function (target) {
      return function () {
        openedSlug = null; // bypass the toggle-close
        openDrawer(students, target.slug, tileBySlug[target.slug]);
      };
    };
    var prevBtn = el('button', 'm26-btn-link', '← ' + prev.name);
    prevBtn.type = 'button';
    prevBtn.addEventListener('click', go(prev));
    var nextBtn = el('button', 'm26-btn-link', next.name + ' →');
    nextBtn.type = 'button';
    nextBtn.addEventListener('click', go(next));
    nav.appendChild(prevBtn);
    nav.appendChild(nextBtn);
    var closeBtn = el('button', 'm26-panel-close', '✕');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.addEventListener('click', closeDrawer);
    var title = el('div', 'm26-panel-title');
    title.appendChild(el('h2', 'm26-student-name', s.name));
    title.appendChild(el('p', 'm26-student-meta',
      s.subs.length ? s.subs.length + (s.subs.length === 1 ? ' submission · ' : ' submissions · ')
        + s.subs[0].dateStr + (s.subs.length > 1 ? ' — ' + s.subs[s.subs.length - 1].dateStr : '')
        : 'no submissions yet'));
    head.appendChild(title);
    head.appendChild(nav);
    head.appendChild(closeBtn);
    drawerBox.appendChild(head);

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
      drawerBox.appendChild(filters);
    }
    drawerBox.appendChild(listHost);

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
    // a re-render rebuilds the grid — any open drawer went with it
    openedSlug = null; openerTile = null; drawerLi = null; tileBySlug = {};
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
      cloudLink.href = M26.pageUrl('index.html');
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
        tile.setAttribute('aria-expanded', 'false');
        tileBySlug[s.slug] = tile;
        tile.addEventListener('click', function () { openDrawer(students, s.slug, tile); });
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
      cl.href = M26.pageUrl('index.html');
      links.appendChild(cl);
    }
    foot.appendChild(links);
    container.appendChild(foot);

    /* deep link: #s-slug opens that student directly */
    var m = /^#s-(.+)$/.exec(location.hash);
    if (m && students.some(function (s) { return s.slug === m[1]; }) && !openedSlug) {
      openDrawer(students, m[1], tileBySlug[m[1]]);
    }
  }

  window.M26Archive = { render: render, closeDrawer: closeDrawer };
})();
