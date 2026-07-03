/* ============================================================================
   M26 archive — the register.

   The archive reads the way the cloud flies: along the semester. One
   continuous stream of every submission, banded week by week (the same time
   axis as the point cloud), newest week last. A sticky rail of student names
   runs above it: tap a name and the register filters to that one thread —
   their colour takes over the rules — tap again (or ALL) to release it.
   Kind/type chips narrow further. No tiles, no drawers, no modals: the page
   is just a page.

   Used by archive.html (standalone) and index.html (the section the 3D dive
   descends into). Strictly a mirror of data/submissions.csv — empty states
   stay empty. All CSV values reach the DOM via textContent (public form
   input). Depends on js/m26-core.js (window.M26).
   ============================================================================ */
(function () {
  'use strict';

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function weekRange(w) {
    var start = new Date(M26.semesterStartDate().getTime() + (w - 1) * 7 * 86400000);
    var end = new Date(start.getTime() + 6 * 86400000);
    var s = start.getDate() + (start.getMonth() === end.getMonth() ? '' : ' ' + MON[start.getMonth()]);
    return s + ' — ' + end.getDate() + ' ' + MON[end.getMonth()];
  }

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
    var subs = data.submissions.slice().sort(function (a, b) { return a.t - b.t; });

    var students = roster.map(function (name, i) {
      return {
        name: name, index: i,
        color: M26.colorFor(i, roster.length, 46),
        colorSoft: M26.colorFor(i, roster.length, 66),
        slug: M26.slugFor(name),
        count: subs.filter(function (r) { return r.studentIndex === i; }).length
      };
    }).sort(function (a, b) { return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }); });
    var bySlug = {};
    students.forEach(function (s) { bySlug[s.slug] = s; });

    var filter = { student: null, kind: null, type: null }; // slugs / values; null = all

    /* ---- head ------------------------------------------------------------ */
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
    sub.appendChild(document.createTextNode('The register — the whole semester, week by week. Pull one name to follow a single thread. '));
    if (!opts.embedded) {
      var cloudLink = el('a', 'm26-link', 'Enter the cloud →');
      cloudLink.href = M26.pageUrl('index.html');
      sub.appendChild(cloudLink);
    }
    head.appendChild(sub);
    container.appendChild(head);

    /* ---- the rail (sticky): students, then kind/type ---------------------- */
    var rail = el('nav', 'm26-rail');
    rail.setAttribute('aria-label', 'Filter the register');

    function chip(label, pressed) {
      var b = el('button', 'm26-chip', label);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(!!pressed));
      return b;
    }

    /* students row */
    var srow = el('div', 'm26-rail-row m26-rail-students');
    var sAll = chip('ALL', true);
    srow.appendChild(sAll);
    var studentChips = { '': sAll };
    students.forEach(function (s) {
      var b = el('button', 'm26-chip m26-chip-student', '');
      b.type = 'button';
      b.setAttribute('aria-pressed', 'false');
      var tick = el('span', 'm26-tick');
      tick.style.background = s.colorSoft;
      b.appendChild(tick);
      b.appendChild(el('span', null, s.name));
      b.appendChild(el('span', 'm26-chip-count', String(s.count)));
      b.addEventListener('click', function () { setStudent(filter.student === s.slug ? null : s.slug); });
      studentChips[s.slug] = b;
      srow.appendChild(b);
    });
    sAll.addEventListener('click', function () { setStudent(null); });
    rail.appendChild(srow);

    /* kind + type rows — built from what actually exists */
    var kinds = [], types = [];
    subs.forEach(function (r) {
      if (kinds.indexOf(r.kind) < 0) kinds.push(r.kind);
      if (types.indexOf(r.type) < 0) types.push(r.type);
    });
    function facetRow(label, options, key) {
      var row = el('div', 'm26-rail-row m26-rail-facets');
      row.appendChild(el('span', 'm26-label', label));
      var all = chip('all', true);
      row.appendChild(all);
      var btns = [all];
      options.forEach(function (opt) {
        var b = chip(opt, false);
        b.addEventListener('click', function () {
          filter[key] = filter[key] === opt ? null : opt;
          btns.forEach(function (x) { x.setAttribute('aria-pressed', String(x === (filter[key] ? b : all))); });
          renderRegister();
        });
        btns.push(b);
        row.appendChild(b);
      });
      all.addEventListener('click', function () {
        filter[key] = null;
        btns.forEach(function (x) { x.setAttribute('aria-pressed', String(x === all)); });
        renderRegister();
      });
      return row;
    }
    if (kinds.length > 1) rail.appendChild(facetRow('KIND', kinds, 'kind'));
    if (types.length > 1) rail.appendChild(facetRow('TYPE', types, 'type'));
    container.appendChild(rail);

    /* ---- the register ------------------------------------------------------ */
    var main = el('main', 'm26-register');
    main.id = 'm26-main';
    container.appendChild(main);

    function setStudent(slug) {
      filter.student = slug;
      for (var k in studentChips) {
        studentChips[k].setAttribute('aria-pressed', String(slug === null ? k === '' : k === slug));
      }
      if (slug) history.replaceState(null, '', '#s-' + slug);
      else if (location.hash.indexOf('#s-') === 0) history.replaceState(null, '', location.pathname + location.search);
      renderRegister();
    }

    function renderRegister() {
      main.textContent = '';
      var active = filter.student ? bySlug[filter.student] : null;
      main.classList.toggle('m26-register-thread', !!active);
      if (active) main.style.setProperty('--sc-soft', active.colorSoft);

      if (!roster.length) {
        main.appendChild(el('p', 'm26-arch-status', 'No students on the roster yet.'));
        return;
      }
      var rows = subs.filter(function (r) {
        return (!active || r.studentIndex === active.index)
          && (!filter.kind || r.kind === filter.kind)
          && (!filter.type || r.type === filter.type);
      });
      if (!subs.length) {
        main.appendChild(el('p', 'm26-arch-status', 'No submissions yet — the semester hasn’t started.'));
        return;
      }
      if (!rows.length) {
        main.appendChild(el('p', 'm26-arch-status', 'Nothing matches this filter.'));
        return;
      }

      /* group by week, ascending — the register reads like the semester happened */
      var currentWeek = null, list = null;
      rows.forEach(function (row) {
        if (row.week !== currentWeek) {
          currentWeek = row.week;
          var mark = el('h2', 'm26-week-mark');
          mark.id = 'w-' + row.week;
          mark.appendChild(el('span', 'm26-week-no', 'WEEK ' + ('0' + row.week).slice(-2)));
          mark.appendChild(el('span', 'm26-week-dates', weekRange(row.week)));
          main.appendChild(mark);
          list = el('ol', 'm26-subs');
          main.appendChild(list);
        }
        var li = el('li', 'm26-sub');
        var student = null;
        for (var i = 0; i < students.length; i++) if (students[i].index === row.studentIndex) { student = students[i]; break; }
        li.style.setProperty('--sc-soft', student ? student.colorSoft : 'var(--hairline)');

        var railCol = el('div', 'm26-sub-rail');
        var time = el('time', 'm26-sub-date', row.dateStr);
        time.setAttribute('datetime', row.date.getFullYear() + '-'
          + ('0' + (row.date.getMonth() + 1)).slice(-2) + '-'
          + ('0' + row.date.getDate()).slice(-2));
        railCol.appendChild(time);
        railCol.appendChild(el('span', 'm26-sub-kind', row.kind));
        railCol.appendChild(el('span', 'm26-sub-week', row.type));
        li.appendChild(railCol);

        var body = el('div', 'm26-sub-body');
        if (!active && student) {
          // in the full stream each entry is signed; the name pulls that thread
          var byline = el('button', 'm26-sub-student');
          byline.type = 'button';
          byline.title = 'follow ' + student.name + '’s thread';
          var tick = el('span', 'm26-tick');
          tick.style.background = student.colorSoft;
          byline.appendChild(tick);
          byline.appendChild(el('span', null, student.name));
          byline.addEventListener('click', function () {
            setStudent(student.slug);
            rail.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
          body.appendChild(byline);
        }
        var fig = el('figure', 'm26-media');
        if (M26.renderMediaInto(fig, row)) body.appendChild(fig);
        if (row.text) body.appendChild(el('p', 'm26-sub-text', row.text));
        if (!row.text && !fig.childNodes.length) body.appendChild(el('p', 'm26-sub-text m26-sub-empty', '(no caption)'));
        li.appendChild(body);
        list.appendChild(li);
      });

      var tally = el('p', 'm26-register-tally',
        rows.length + (rows.length === 1 ? ' submission' : ' submissions')
        + (active ? ' · ' + active.name : ' · ' + roster.length + ' students'));
      main.appendChild(tally);
    }

    /* ---- foot -------------------------------------------------------------- */
    var foot = el('footer', 'm26-arch-foot');
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

    /* deep link: #s-slug filters to that student */
    var m = /^#s-(.+)$/.exec(location.hash);
    if (m && bySlug[m[1]]) setStudent(m[1]);
    else renderRegister();
  }

  window.M26Archive = { render: render };
})();
