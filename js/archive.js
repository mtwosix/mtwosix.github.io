/* ============================================================================
   M26 archive — the ordinary, readable view of the same two CSVs.

   Renders a semantic, keyboard-navigable page: every student on the roster,
   each with their real submissions in chronological order. Used two ways:

     archive.html                       the standalone page
     index.html  (#m26-archive)        the section that surfaces at the end
                                        of the 3D dive

   Strictly a mirror of data/submissions.csv — a student with no submissions
   gets an honest "no submissions yet" line, never invented content. All data
   values reach the DOM via textContent (they come from a public form).
   Depends on js/m26-core.js (window.M26).
   ============================================================================ */
(function () {
  'use strict';

  /* tiny DOM helper — createElement + class + textContent only */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function render(container, opts) {
    opts = opts || {};
    container.classList.add('m26-arch');
    container.textContent = '';
    var loading = el('p', 'm26-arch-status', 'reading the archive…');
    container.appendChild(loading);

    M26.loadAll().then(function (data) {
      container.textContent = '';
      build(container, data, opts);
    }).catch(function (err) {
      container.textContent = '';
      var status = el('p', 'm26-arch-status', 'The archive could not be loaded — ' + err.message + '.');
      var retry = el('button', 'm26-btn', 'TRY AGAIN');
      retry.type = 'button';
      retry.addEventListener('click', function () { render(container, opts); });
      container.appendChild(status);
      container.appendChild(retry);
    });
  }

  function build(container, data, opts) {
    var roster = data.roster;             // roster order — fixes each student's colour
    var subs = data.submissions;          // already validated + deduplicated

    // group per student (roster order), then display alphabetically
    var byStudent = roster.map(function (name, i) {
      return {
        name: name,
        rosterIndex: i,
        color: M26.colorFor(i, roster.length, 46),
        colorSoft: M26.colorFor(i, roster.length, 66),
        slug: M26.slugFor(name),
        subs: subs.filter(function (s) { return s.studentIndex === i; })
                  .sort(function (a, b) { return a.t - b.t; })
      };
    });
    var students = byStudent.slice().sort(function (a, b) {
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    /* ---- header --------------------------------------------------------- */
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
    sub.appendChild(document.createTextNode('The archive — every submission, student by student, in the order it arrived. '));
    if (!opts.embedded) {
      var cloudLink = el('a', 'm26-link', 'Enter the cloud →');
      cloudLink.href = 'index.html';
      sub.appendChild(cloudLink);
    }
    head.appendChild(sub);
    container.appendChild(head);

    /* ---- student index (jump navigation) -------------------------------- */
    var withWork = students.filter(function (s) { return s.subs.length; });
    var nav = el('nav', 'm26-index');
    nav.setAttribute('aria-label', 'Students');
    nav.appendChild(el('h2', 'm26-label', 'STUDENTS — ' + roster.length));
    var navList = el('ol', 'm26-index-list');
    students.forEach(function (s) {
      var li = el('li');
      var a = el('a', 'm26-index-link');
      a.href = '#s-' + s.slug;
      var tick = el('span', 'm26-tick');
      tick.style.background = s.colorSoft;
      a.appendChild(tick);
      a.appendChild(el('span', 'm26-index-name', s.name));
      a.appendChild(el('span', 'm26-index-count', String(s.subs.length)));
      li.appendChild(a);
      navList.appendChild(li);
    });
    nav.appendChild(navList);
    container.appendChild(nav);

    /* ---- main: one section per student ---------------------------------- */
    var main = el('main', 'm26-arch-main');
    main.id = 'm26-main';

    if (!roster.length) {
      main.appendChild(el('p', 'm26-arch-status', 'No students on the roster yet.'));
    }

    students.forEach(function (s) {
      var section = el('section', 'm26-student');
      section.id = 's-' + s.slug;
      section.style.setProperty('--sc', s.color);
      section.style.setProperty('--sc-soft', s.colorSoft);

      var sh = el('header', 'm26-student-head');
      sh.appendChild(el('h2', 'm26-student-name', s.name));
      var meta = s.subs.length
        ? s.subs.length + (s.subs.length === 1 ? ' submission' : ' submissions')
          + ' · ' + s.subs[0].dateStr
          + (s.subs.length > 1 ? ' — ' + s.subs[s.subs.length - 1].dateStr : '')
        : 'no submissions yet';
      sh.appendChild(el('p', 'm26-student-meta', meta));
      section.appendChild(sh);

      if (s.subs.length) {
        var list = el('ol', 'm26-subs');
        s.subs.forEach(function (row) {
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
        section.appendChild(list);
      }
      main.appendChild(section);
    });
    container.appendChild(main);

    /* ---- footer ---------------------------------------------------------- */
    var foot = el('footer', 'm26-arch-foot');
    foot.appendChild(el('p', 'm26-arch-count',
      roster.length + (roster.length === 1 ? ' student' : ' students') + ' · '
      + subs.length + (subs.length === 1 ? ' submission' : ' submissions')
      + (withWork.length < students.length && subs.length
          ? ' · ' + withWork.length + ' with work so far' : '')));
    if (data.unmatched.length) {
      // be honest about anything on file that isn't shown
      var names = data.unmatched.map(function (r) { return r.student; })
        .filter(function (n, i, a) { return a.indexOf(n) === i; }).join(', ');
      foot.appendChild(el('p', 'm26-arch-warn',
        data.unmatched.length + ' submission' + (data.unmatched.length === 1 ? '' : 's')
        + ' on file ' + (data.unmatched.length === 1 ? 'is' : 'are') + ' not shown — the name '
        + (data.unmatched.length === 1 ? 'doesn’t' : names.indexOf(',') >= 0 ? 'don’t' : 'doesn’t')
        + ' match the roster: ' + names + '.'));
    }
    var links = el('p', 'm26-arch-links');
    var formA = el('a', 'm26-link', 'SUBMIT WORK →');
    formA.href = M26.CONFIG.formUrl; formA.target = '_blank'; formA.rel = 'noopener noreferrer';
    links.appendChild(formA);
    links.appendChild(document.createTextNode('  ·  '));
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
  }

  window.M26Archive = { render: render };
})();
