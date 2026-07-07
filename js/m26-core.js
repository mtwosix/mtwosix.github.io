/* ============================================================================
   M26 core — shared data + media layer for both views of the site.

   Loaded as a plain script (no build step); everything lives on window.M26.
   Both the 3D cloud (index.html) and the archive (archive.html / the section
   at the end of the cloud) read the two CSVs through THIS file only, so the
   data is interpreted exactly one way:

     data/students.csv     one column, "Name" — the roster
     data/submissions.csv  ID,Student,Date,Time,Kind,Type,Image,Text
                           (written by the Google Form → Apps Script pipeline;
                            do NOT change this schema without updating the
                            Apps Script too)

   Rules this file enforces everywhere:
   - the site is a strict 1:1 mirror of submissions.csv — nothing is invented,
     no placeholder points, no sample content
   - Text/Kind/Student are untrusted public input (typed into a public form):
     they are only ever written to the DOM via textContent, never as HTML
   - CSVs may arrive with CRLF / LF / mixed line endings — the parser accepts all
   ============================================================================ */
(function () {
  'use strict';

  /* ---------------------------------------------------------------- sandbox
     Add ?sandbox to any page URL and the whole site runs against the sample
     dataset in data/sandbox/ (15 dummy students, five submission types each)
     with a visible SANDBOX badge. The real site — same deploy, same code —
     stays untouched at the plain URL. For stress-testing before and during
     the semester; never mixes with real data. */
  var SANDBOX = /[?&]sandbox\b/.test(location.search);

  /* ------------------------------------------------------------------ config
     The only numbers on the site that are calendar facts rather than data:
     the studio's start date and planned length. Everything else (student
     count, submission count, how deep the cloud goes) derives from the CSVs. */
  var CONFIG = {
    semesterStart: '2026-07-06', // Monday of week 1 — must match the studio calendar
    weeks: 18,                   // planned semester length (data past this still shows)
    studentsCsv: SANDBOX ? 'data/sandbox/students.csv' : 'data/students.csv',
    submissionsCsv: SANDBOX ? 'data/sandbox/submissions.csv' : 'data/submissions.csv',
    // Public link to the submission form ("Send" link from Google Forms).
    formUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSfSj-YF6bUyYf6mrEWTHaxbfp3SfdeQHwdyXPlodjP_l64Z3A/viewform',
    // Apps Script web-app URL for the discourse (comments) backend — see
    // pipeline/README.md § "The discourse backend". Empty = discourse read-only.
    discourseUrl: 'https://script.google.com/macros/s/AKfycbxdM8eXg0Gq6vcVC75m71gIpIR2dAFY4vKLAXj12KzlOQbk_lmKJdbcIOBqXa7sgxP6/exec'
  };

  /* Cross-page links must keep the sandbox switch alive (index ↔ archive). */
  function pageUrl(page, hash) {
    return page + (SANDBOX ? '?sandbox' : '') + (hash || '');
  }

  /* Visible tell that none of this is real — injected on both pages. */
  function sandboxBadge() {
    if (!SANDBOX) return;
    var b = document.createElement('a');
    b.id = 'm26-sandbox-badge';
    b.href = location.pathname; // same page, sandbox off
    b.textContent = 'SANDBOX — sample data · exit';
    b.title = 'This is the test dataset. Click to return to the real site.';
    document.body.appendChild(b);
  }
  if (document.readyState !== 'loading') sandboxBadge();
  else document.addEventListener('DOMContentLoaded', sandboxBadge);

  /* One is shown per visit, white against the dark, on the threshold between
     the cloud and the archive. Real, attributed quotes only. */
  var QUOTES = [
    { text: 'Cities have the capability of providing something for everybody, only because, and only when, they are created by everybody.', name: 'Jane Jacobs' },
    { text: 'The details are not the details. They make the design.', name: 'Charles Eames' },
    { text: 'We shape our buildings; thereafter they shape us.', name: 'Winston Churchill' },
    { text: 'First life, then spaces, then buildings — the other way around never works.', name: 'Jan Gehl' },
    { text: 'Imagination is more important than knowledge. For knowledge is limited, whereas imagination embraces the entire world.', name: 'Albert Einstein' },
    { text: 'Whatever space and time mean, place and occasion mean more.', name: 'Aldo van Eyck' },
    { text: 'You never change things by fighting the existing reality. To change something, build a new model that makes the existing model obsolete.', name: 'Buckminster Fuller' },
    { text: 'The society which scorns excellence in plumbing as a humble activity and tolerates shoddiness in philosophy because it is an exalted activity will have neither good plumbing nor good philosophy.', name: 'John W. Gardner' },
    { text: 'The street is the river of life of the city, the place where we come together.', name: 'William H. Whyte' },
    { text: 'There is no logic that can be superimposed on the city; people make it, and it is to them, not buildings, that we must fit our plans.', name: 'Jane Jacobs' }
  ];

  /* ------------------------------------------------------------- CSV parsing
     Handles quoted fields, embedded commas/newlines, doubled-quote escaping,
     and any mix of \r\n / \n / \r line endings. */
  function parseCSV(text) {
    var rows = [], row = [], field = '', inQuotes = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQuotes) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
        else field += c;
      } else {
        // a quote only opens a quoted field at the field's start; a stray quote
        // mid-field (hand-typed CSV) is kept as a literal character
        if (c === '"' && field === '') inQuotes = true;
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n' || c === '\r') {
          if (c === '\r' && text[i + 1] === '\n') i++;   // CRLF counts once
          row.push(field); rows.push(row); row = []; field = '';
        }
        else field += c;
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return !(r.length === 1 && r[0].trim() === ''); });
  }

  /* rows -> array of {header: value} objects, matched by lower-cased header */
  function csvToObjects(rows) {
    if (!rows.length) return [];
    var headers = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    return rows.slice(1).map(function (r) {
      var o = {};
      headers.forEach(function (h, i) { o[h] = (r[i] || '').trim(); });
      return o;
    });
  }

  /* --------------------------------------------------------- date handling
     Manual parsing — `new Date("2026-07-01T1:10:00")` is invalid in Safari,
     and the pipeline / Excel can emit single-digit hours or stray seconds. */
  function parseDateTime(dateStr, timeStr) {
    var dm = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(dateStr || '').trim());
    if (!dm) return null;
    var tm = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(timeStr || '').trim());
    var d = new Date(+dm[1], +dm[2] - 1, +dm[3],
      tm ? Math.min(23, +tm[1]) : 12, tm ? Math.min(59, +tm[2]) : 0, 0);
    // reject impossible dates like 2026-02-31 (Date would silently roll over)
    if (d.getFullYear() !== +dm[1] || d.getMonth() !== +dm[2] - 1 || d.getDate() !== +dm[3]) return null;
    return d;
  }

  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function shortDate(d) { return ('0' + d.getDate()).slice(-2) + ' ' + MON[d.getMonth()]; }
  function longDate(d) { return ('0' + d.getDate()).slice(-2) + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); }

  function semesterStartDate() {
    return parseDateTime(CONFIG.semesterStart, '00:00') || new Date();
  }
  /* 1-based semester week for a date; dates before the start clamp to week 1,
     dates past CONFIG.weeks keep counting — the cloud keeps growing. */
  function weekOf(d) {
    return Math.max(1, Math.floor((d - semesterStartDate()) / (7 * 86400000)) + 1);
  }

  /* ------------------------------------------------------- student identity
     One colour per student, spaced evenly around the wheel from their ROSTER
     position — the same formula in both views, so a student's thread in the
     cloud and their rule in the archive are the same colour. */
  function hueFor(rosterIndex, rosterCount) {
    return Math.round((rosterIndex * 360) / Math.max(1, rosterCount));
  }
  function colorFor(rosterIndex, rosterCount, lightness) {
    return 'hsl(' + hueFor(rosterIndex, rosterCount) + ', 78%, ' + (lightness || 66) + '%)';
  }
  // one stable glyph per student — a pixel/structure alphabet (nodes, blocks, lattices),
  // the studio's visual language: imagination infrastructure, not math notation
  var STU_SYMBOLS = ['◆','○','■','◇','●','□','▲','△','┼','╳','▚','▞','▌','▐','╱','╲','▀','▄','▙','▜'];
  function STU_GLYPH(i) { i = i | 0; return STU_SYMBOLS[((i % STU_SYMBOLS.length) + STU_SYMBOLS.length) % STU_SYMBOLS.length]; }
  function slugFor(name) {
    return String(name).toLowerCase().normalize('NFKD')
      .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'student';
  }

  /* ---------------------------------------------------------- data loading */
  function fetchCsv(url) {
    return fetch(url, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error(url + ' → HTTP ' + res.status);
      return res.text();
    });
  }

  function loadRosterNames() {
    return fetchCsv(CONFIG.studentsCsv).then(function (text) {
      return csvToObjects(parseCSV(text))
        .map(function (o) { return (o.name || '').trim(); })
        .filter(Boolean);
    });
  }

  /* Interprets submissions.csv against a roster. Returns
       { matched:   [row, …]   one per real, valid, in-roster submission
         unmatched: [row, …]   valid rows whose Student isn't on the roster
         invalid:   n          rows dropped for a missing/bad date or student }
     Each row: { key, id, studentIndex, student (roster spelling), date (Date),
                 t (ms), week, dateStr, time, kind, type, image, text }        */
  function normalizeSubmissions(csvText, rosterNames) {
    var lower = rosterNames.map(function (n) { return n.toLowerCase(); });
    var objs = csvToObjects(parseCSV(csvText));
    var seen = {}, matched = [], unmatched = [], invalid = 0;
    objs.forEach(function (o) {
      var student = (o.student || '').trim();
      if (!student || !o.date) { invalid++; return; }
      var d = parseDateTime(o.date, o.time);
      if (!d) { invalid++; return; }
      var key = o.id || (student + '|' + o.date + '|' + (o.time || ''));
      if (seen[key]) return; // duplicate row in the file — first one wins
      seen[key] = true;
      var si = lower.indexOf(student.toLowerCase());
      var row = {
        key: key, id: o.id || key,
        studentIndex: si, student: si >= 0 ? rosterNames[si] : student,
        date: d, t: d.getTime(), week: weekOf(d),
        dateStr: shortDate(d), longDate: longDate(d),
        time: (o.time || '').trim() || '12:00',
        kind: (o.kind || '').trim() || 'submission',
        type: (o.type || '').trim().toLowerCase() || ((o.image || '').trim() ? 'image' : 'text'),
        image: (o.image || '').trim(), text: (o.text || '').trim()
      };
      (si >= 0 ? matched : unmatched).push(row);
    });
    return { matched: matched, unmatched: unmatched, invalid: invalid };
  }

  /* Everything the archive needs in one call. */
  function loadAll() {
    return Promise.all([loadRosterNames(), fetchCsv(CONFIG.submissionsCsv)])
      .then(function (r) {
        var names = r[0];
        var subs = normalizeSubmissions(r[1], names);
        return { roster: names, submissions: subs.matched, unmatched: subs.unmatched, invalid: subs.invalid };
      });
  }

  /* ---------------------------------------------------------- media urls
     The Image column may hold: a repo-relative path (uploads/…), a direct
     file URL, or — from the Google Form pipeline — a Google Drive link.
     resolveMedia decides how a submission's attachment can be shown.

     Returns { mode, kind, src, href, label }
       mode 'img'    → <img src>, click opens the in-site image viewer
            'video'  → <video controls src>      (direct files)
            'audio'  → <audio controls src>      (direct files)
            'iframe' → <iframe src>              (Drive player, YouTube, Vimeo)
            'pdf'    → card that opens the in-site page-chain reader
                       (pdfSrc = direct file for pdf.js, or embedSrc = Drive preview)
            'link'   → can't inline — offer the original link
            'none'   → no attachment (text-only submission)                    */
  function safeUrl(raw) {
    var s = String(raw || '').trim();
    if (!s) return null;
    if (/^(https?:)?\/\//i.test(s)) return s.charAt(0) === '/' ? 'https:' + s : s;
    if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return null;   // javascript:, data:, … — rejected
    return s;                                          // repo-relative path (uploads/…)
  }
  function driveId(url) {
    var m = /drive\.google\.com\/(?:open\?id=|file\/d\/|uc\?(?:export=\w+&)?id=)([\w-]{10,})/.exec(url)
      || /docs\.google\.com\/uc\?(?:export=\w+&)?id=([\w-]{10,})/.exec(url);
    return m ? m[1] : null;
  }
  function extOf(url) {
    var m = /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(url);
    return m ? m[1].toLowerCase() : '';
  }
  var IMG_EXT = { jpg: 1, jpeg: 1, png: 1, gif: 1, webp: 1, avif: 1, svg: 1 };
  var VID_EXT = { mp4: 1, webm: 1, mov: 1, m4v: 1 };
  var AUD_EXT = { mp3: 1, wav: 1, m4a: 1, ogg: 1, oga: 1, aac: 1, flac: 1 };

  function resolveMedia(sub) {
    var url = safeUrl(sub.image);
    var type = (sub.type || '').toLowerCase();
    if (!url) return { mode: 'none', kind: 'text' };

    var id = driveId(url);
    if (id) {
      // Drive files must be shared "anyone with the link" for these to work —
      // the pipeline's Apps Script sets that on upload (see pipeline/README).
      if (type === 'video' || type === 'audio') {
        return { mode: 'iframe', kind: type, src: 'https://drive.google.com/file/d/' + id + '/preview', href: url, label: type };
      }
      if (type === 'pdf') {
        // cross-origin Drive files can't reach pdf.js — use Drive's own reader in the viewer
        return { mode: 'pdf', kind: 'pdf', embedSrc: 'https://drive.google.com/file/d/' + id + '/preview', href: url, label: 'pdf' };
      }
      // two public Drive image hosts — the thumbnail endpoint rate-limits
      // occasionally, so a googleusercontent mirror is tried before giving up
      return { mode: 'img', kind: 'image',
        src: 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1600',
        srcAlt: ['https://lh3.googleusercontent.com/d/' + id + '=w1600'],
        href: url, label: 'image' };
    }
    var yt = /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{6,})/.exec(url);
    if (yt) return { mode: 'iframe', kind: 'video', src: 'https://www.youtube-nocookie.com/embed/' + yt[1], href: url, label: 'video' };
    var vm = /vimeo\.com\/(\d{6,})/.exec(url);
    if (vm) return { mode: 'iframe', kind: 'video', src: 'https://player.vimeo.com/video/' + vm[1], href: url, label: 'video' };

    var ext = extOf(url);
    if (type === 'pdf' || ext === 'pdf') return { mode: 'pdf', kind: 'pdf', pdfSrc: url, href: url, label: 'pdf' };
    if (type === 'image' || IMG_EXT[ext]) return { mode: 'img', kind: 'image', src: url, href: url, label: 'image' };
    if (type === 'video' || VID_EXT[ext]) return { mode: 'video', kind: 'video', src: url, href: url, label: 'video' };
    if (type === 'audio' || AUD_EXT[ext]) return { mode: 'audio', kind: 'audio', src: url, href: url, label: 'audio' };
    return { mode: 'link', kind: type || 'link', href: url, label: type || 'attachment' };
  }

  /* Build the DOM for a submission's attachment inside `el` (cleared first).
     Everything is created with createElement/textContent — no HTML injection
     path for CSV values. Returns true if something was rendered.            */
  function renderMediaInto(el, sub) {
    el.textContent = '';
    var media = resolveMedia(sub);
    if (media.mode === 'none') return false;

    function linkCard(text) {
      var a = document.createElement('a');
      a.className = 'm26-media-link';
      a.href = media.href; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.textContent = text;
      el.appendChild(a);
      return a;
    }

    if (media.mode === 'img') {
      var img = document.createElement('img');
      img.className = 'm26-media-img';
      img.loading = 'lazy'; img.decoding = 'async';
      img.alt = sub.text ? sub.text : (sub.student + ' — ' + (sub.kind || 'submission'));
      // clicking opens the in-site viewer — never a jump to Drive
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'm26-media-imgbtn';
      btn.title = 'view larger';
      btn.appendChild(img);
      // if a host fails (rate limit, sharing off), walk the alternates, then a plain link
      var srcs = [media.src].concat(media.srcAlt || []);
      var si = 0;
      img.onerror = function () {
        si++;
        if (si < srcs.length) { img.src = srcs[si]; return; }
        if (btn.parentNode === el) { el.removeChild(btn); linkCard('open ' + media.label + ' ↗'); }
      };
      btn.addEventListener('click', function () {
        if (window.M26Viewer) M26Viewer.open({
          kind: 'image', src: img.currentSrc || img.src, href: media.href,
          caption: sub.text || '', meta: (sub.student || '') + (sub.kind ? ' · ' + sub.kind : '')
        });
      });
      img.src = srcs[0];
      el.appendChild(btn);
    } else if (media.mode === 'pdf') {
      var pbtn = document.createElement('button');
      pbtn.type = 'button';
      pbtn.className = 'm26-media-pdfbtn';
      pbtn.textContent = 'READ PDF — opens here';
      pbtn.addEventListener('click', function () {
        if (window.M26Viewer) M26Viewer.open({
          kind: 'pdf', pdfSrc: media.pdfSrc || null, embedSrc: media.embedSrc || null, href: media.href,
          caption: sub.text || '', meta: (sub.student || '') + (sub.kind ? ' · ' + sub.kind : '')
        });
      });
      el.appendChild(pbtn);
    } else if (media.mode === 'video' || media.mode === 'audio') {
      var mel = document.createElement(media.mode);
      mel.className = 'm26-media-' + media.mode;
      mel.controls = true; mel.preload = 'metadata';
      mel.src = media.src;
      mel.addEventListener('error', function () {
        if (el.contains(mel)) { el.removeChild(mel); linkCard('open ' + media.label + ' ↗'); }
      });
      el.appendChild(mel);
    } else if (media.mode === 'iframe') {
      var fr = document.createElement('iframe');
      fr.className = 'm26-media-frame' + (media.kind === 'audio' ? ' m26-media-frame-audio' : '');
      fr.src = media.src;
      fr.loading = 'lazy';
      fr.allow = 'autoplay; encrypted-media; picture-in-picture';
      // YouTube refuses embeds without a referrer (player error 153) — send origin only
      fr.referrerPolicy = 'origin';
      fr.setAttribute('allowfullscreen', '');
      fr.title = (sub.student || 'submission') + ' — ' + media.label;
      el.appendChild(fr);
    } else {
      linkCard('open ' + media.label + ' ↗');
    }
    return true;
  }

  window.M26 = {
    CONFIG: CONFIG,
    QUOTES: QUOTES,
    SANDBOX: SANDBOX,
    pageUrl: pageUrl,
    parseCSV: parseCSV,
    csvToObjects: csvToObjects,
    parseDateTime: parseDateTime,
    shortDate: shortDate,
    longDate: longDate,
    semesterStartDate: semesterStartDate,
    weekOf: weekOf,
    hueFor: hueFor,
    colorFor: colorFor,
    STU_GLYPH: STU_GLYPH,
    slugFor: slugFor,
    loadRosterNames: loadRosterNames,
    fetchCsv: fetchCsv,
    normalizeSubmissions: normalizeSubmissions,
    loadAll: loadAll,
    resolveMedia: resolveMedia,
    renderMediaInto: renderMediaInto
  };
})();
