/* ============================================================================
   M26 archive — THE LEDGER (+ student dossier)

   The archive as the 1C ledger: one ruled register, a row per student, a
   per-week activity strip, a submission tally. Click a row and an almost-
   full-screen dossier opens over a dimmed page — the student's portrait, bio
   and links, a per-week activity graph, and every work they've filed, banded
   by week.

   A strict mirror of data/students.csv + data/submissions.csv (empty states
   stay empty), plus an OPTIONAL data/…/profiles.json for portrait / bio /
   links (missing = graceful placeholder). All CSV + profile values reach the
   DOM via textContent / validated href only. Depends on js/m26-core.js
   (window.M26) and js/viewer.js. Exposed as window.M26ArchiveLedger.
   ============================================================================ */
(function () {
  'use strict';

  var INK = '#1d1b17', PAPER = '#f3f1ea', RUST = '#8a5a34', MUTE = '#6c685f';
  var RAMP = ['·', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  var MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function w2(n) { return ('0' + n).slice(-2); }
  function weekRange(w) {
    var start = new Date(M26.semesterStartDate().getTime() + (w - 1) * 7 * 86400000);
    var end = new Date(start.getTime() + 6 * 86400000);
    var s = start.getDate() + (start.getMonth() === end.getMonth() ? '' : ' ' + MON[start.getMonth()]);
    return s + ' — ' + end.getDate() + ' ' + MON[end.getMonth()];
  }
  function safeUrl(u, allowMail) {
    u = String(u == null ? '' : u).trim();
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    if (allowMail && /^mailto:/i.test(u)) return u;
    if (allowMail && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(u)) return 'mailto:' + u;
    return '';
  }

  /* ---- student identity mark ----------------------------------------------
     Each student's mark is theirs — a chosen glyph or a small image (svg/png)
     they supply, set as `mark` in profiles.json. With none, it falls back to a
     filled dot in their colour — never an arbitrary stand-in symbol. */
  var MARK_IMG = /\.(svg|png|jpe?g|webp|gif|avif)(?:[?#]|$)/i;
  function markUrl(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (!s) return '';
    if (/^https?:\/\//i.test(s)) return s;
    if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return '';   // block javascript:, data:, …
    return s;                                         // repo-relative path (uploads/marks/…)
  }
  function markNode(student) {
    var m = student.mark;
    if (m && MARK_IMG.test(m)) {
      var u = markUrl(m);
      if (u) { var img = el('img', 'm26l-markimg'); img.src = u; img.alt = ''; img.loading = 'lazy'; return img; }
    }
    if (m) { var g = el('span', 'm26l-mark', m); g.style.color = student.color; return g; }
    var dot = el('span', 'm26l-dot'); dot.style.background = student.color;
    dot.setAttribute('aria-hidden', 'true'); return dot;
  }

  /* ---- one-time stylesheet ------------------------------------------------ */
  function injectStyles() {
    if (document.getElementById('m26l-styles')) return;
    var css = [
      '.m26l{background:' + PAPER + ';color:' + INK + ';min-height:100vh;',
        "font-family:'Space Mono',ui-monospace,monospace;-webkit-font-smoothing:antialiased}",
      '.m26l *{box-sizing:border-box}',
      '.m26l-wrap{max-width:1120px;margin:0 auto;padding:40px 28px 80px}',

      /* header */
      '.m26l-eyebrow{font:500 10px "IBM Plex Mono",monospace;letter-spacing:.3em;color:' + MUTE + ';margin:0 0 18px}',
      '.m26l-back{appearance:none;border:1px solid ' + INK + ';background:transparent;color:' + INK + ';',
        'font:700 10px "IBM Plex Mono",monospace;letter-spacing:.16em;padding:7px 12px;cursor:pointer;margin-bottom:18px}',
      '.m26l-back:hover{background:' + INK + ';color:' + PAPER + '}',

      /* ledger card */
      '.m26l-card{position:relative;background:' + PAPER + ';border:1px solid ' + INK + ';padding:26px 30px 30px}',
      '.m26l-dither{font:400 12px "Space Mono",monospace;color:rgba(29,27,23,.4);overflow:hidden;white-space:nowrap;user-select:none;line-height:1}',
      '.m26l-cardhead{display:flex;justify-content:space-between;align-items:baseline;gap:16px;margin:16px 0 4px;flex-wrap:wrap}',
      '.m26l-title{font:700 clamp(30px,4.6vw,46px) "Space Mono",monospace;letter-spacing:-.03em;margin:0}',
      '.m26l-source{font:400 9px "IBM Plex Mono",monospace;letter-spacing:.2em;color:' + MUTE + ';text-align:right}',

      /* stats + sort */
      '.m26l-strip{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap;margin:22px 0 8px}',
      '.m26l-stats{display:flex;gap:34px}',
      '.m26l-stat{display:flex;flex-direction:column;gap:2px}',
      '.m26l-stat b{font:700 30px "Space Mono",monospace;letter-spacing:-.02em;line-height:1}',
      '.m26l-stat span{font:700 8px "IBM Plex Mono",monospace;letter-spacing:.22em;color:' + MUTE + '}',
      '.m26l-sort{display:flex;align-items:center;gap:8px;font:700 8px "IBM Plex Mono",monospace;letter-spacing:.2em;color:' + MUTE + '}',
      '.m26l-sortbtn{appearance:none;border:1px solid rgba(29,27,23,.4);background:transparent;color:' + MUTE + ';',
        'font:700 9px "IBM Plex Mono",monospace;letter-spacing:.14em;padding:5px 9px;cursor:pointer}',
      '.m26l-sortbtn[aria-pressed="true"]{background:' + INK + ';color:' + PAPER + ';border-color:' + INK + '}',

      /* table */
      '.m26l-thead,.m26l-row{display:grid;grid-template-columns:46px 1fr minmax(180px,300px) 66px;gap:18px;align-items:center}',
      '.m26l-thead{padding:0 6px 8px;border-bottom:2px solid ' + INK + ';',
        'font:700 9px "IBM Plex Mono",monospace;letter-spacing:.22em;color:' + MUTE + '}',
      '.m26l-thead .r{text-align:right}',
      '.m26l-row{width:100%;text-align:left;appearance:none;border:0;border-bottom:1px dashed rgba(29,27,23,.3);',
        'background:transparent;color:' + INK + ';padding:12px 6px;cursor:pointer;transition:background .12s}',
      '.m26l-row:hover{background:rgba(138,90,52,.08)}',
      '.m26l-row:hover .m26l-name{color:' + RUST + '}',
      '.m26l-no{font:400 11px "IBM Plex Mono",monospace;color:' + RUST + '}',
      '.m26l-namecell{display:flex;align-items:center;gap:11px;min-width:0}',
      '.m26l-mark{font:700 16px "Space Mono",monospace;line-height:1;flex:none}',
      '.m26l-markimg{width:18px;height:18px;object-fit:contain;flex:none;display:block}',
      '.m26l-dot{width:11px;height:11px;border-radius:50%;flex:none;display:inline-block}',
      '.m26l-name{font:700 clamp(16px,1.7vw,21px) "Space Mono",monospace;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:color .12s}',
      '.m26l-namesub{font:400 9px "IBM Plex Mono",monospace;letter-spacing:.06em;color:' + MUTE + ';white-space:nowrap}',
      '.m26l-act{display:flex;align-items:flex-end;gap:0;line-height:1;font:400 15px "Space Mono",monospace;letter-spacing:1px}',
      '.m26l-act span{display:inline-block}',
      '.m26l-subs{text-align:right;font:400 12px "IBM Plex Mono",monospace;color:' + MUTE + '}',
      '.m26l-subs b{color:' + INK + ';font-weight:700}',
      '.m26l-open{display:inline-block;margin-left:8px;color:' + RUST + '}',

      /* subtitle + legend (orientation) */
      '.m26l-sub{font:italic 300 14px/1.6 Spectral,Georgia,serif;color:#3a382f;margin:8px 0 0;max-width:62ch}',
      '.m26l-legend{display:flex;flex-wrap:wrap;gap:8px 20px;margin:16px 0 2px;',
        'font:400 9px "IBM Plex Mono",monospace;letter-spacing:.1em;color:' + MUTE + '}',
      '.m26l-legend b{color:' + INK + ';font-weight:700}',

      /* newest work strip */
      '.m26l-latest{margin:20px 0 6px;border-top:1px solid rgba(29,27,23,.16);border-bottom:1px solid rgba(29,27,23,.16);padding:16px 0}',
      '.m26l-latest-tag{display:flex;align-items:baseline;gap:12px;margin-bottom:14px;flex-wrap:wrap}',
      '.m26l-latest-tag b{font:700 10px "IBM Plex Mono",monospace;letter-spacing:.24em;color:' + RUST + '}',
      '.m26l-latest-tag span{font:400 9px "IBM Plex Mono",monospace;letter-spacing:.14em;color:' + MUTE + '}',
      '.m26l-latest-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}',
      '.m26l-lcard{border:1px solid rgba(29,27,23,.2);background:#faf9f4;display:flex;flex-direction:column;',
        'overflow:hidden;cursor:pointer;transition:border-color .12s}',
      '.m26l-lcard:hover{border-color:' + RUST + '}',
      '.m26l-lcard:focus-visible{outline:2px solid ' + RUST + ';outline-offset:2px}',
      '.m26l-lmedia{background:#efece3;aspect-ratio:4/3;overflow:hidden;min-height:0;pointer-events:none;margin:0}',
      '.m26l-lmedia img,.m26l-lmedia video,.m26l-lmedia canvas,.m26l-lmedia iframe{width:100%;height:100%;object-fit:cover;display:block}',
      '.m26l-lbody{padding:9px 11px 11px;display:flex;flex-direction:column;gap:5px}',
      '.m26l-lname{display:flex;align-items:center;gap:7px;font:700 12px "Space Mono",monospace;color:' + INK + ';min-width:0}',
      '.m26l-lname .m26l-name{font-size:12px}',
      '.m26l-lmeta{font:700 8px "IBM Plex Mono",monospace;letter-spacing:.12em;color:' + MUTE + '}',

      '.m26l-foot{margin-top:20px;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;',
        'font:400 9px/1.9 "IBM Plex Mono",monospace;letter-spacing:.12em;color:' + MUTE + '}',
      '.m26l-link{color:' + INK + ';text-decoration:none;border-bottom:1px solid ' + RUST + '}',
      '.m26l-link:hover{color:' + RUST + '}',
      '.m26l-status{font:400 13px "IBM Plex Mono",monospace;color:' + MUTE + ';padding:40px 0}',
      '.m26l-warn{font:400 10px/1.7 "IBM Plex Mono",monospace;color:' + RUST + ';max-width:70ch}',

      /* ---- dossier ---- */
      '.m26l-backdrop{position:fixed;inset:0;z-index:4000;background:rgba(10,9,14,.62);backdrop-filter:blur(3px);',
        'opacity:0;transition:opacity .28s ease;display:flex}',
      '.m26l-backdrop.open{opacity:1}',
      '.m26l-panel{position:absolute;inset:3.2vh 3.2vw;background:' + PAPER + ';border:1.5px solid ' + INK + ';',
        'box-shadow:0 40px 120px rgba(0,0,0,.5);display:flex;flex-direction:column;overflow:hidden;',
        'transform:translateY(14px) scale(.985);opacity:0;transition:transform .3s cubic-bezier(.2,.7,.2,1),opacity .3s}',
      '.m26l-backdrop.open .m26l-panel{transform:none;opacity:1}',
      '.m26l-tick{position:absolute;width:15px;height:15px;z-index:3;pointer-events:none}',
      '.m26l-tick.tl{top:8px;left:8px;border-top:2px solid ' + RUST + ';border-left:2px solid ' + RUST + '}',
      '.m26l-tick.tr{top:8px;right:8px;border-top:2px solid ' + RUST + ';border-right:2px solid ' + RUST + '}',
      '.m26l-tick.bl{bottom:8px;left:8px;border-bottom:2px solid ' + RUST + ';border-left:2px solid ' + RUST + '}',
      '.m26l-tick.br{bottom:8px;right:8px;border-bottom:2px solid ' + RUST + ';border-right:2px solid ' + RUST + '}',
      '.m26l-d-bar{flex:none;display:flex;justify-content:space-between;align-items:center;gap:14px;',
        'padding:12px 20px;border-bottom:1px solid rgba(29,27,23,.16)}',
      '.m26l-d-bartag{font:700 9px "IBM Plex Mono",monospace;letter-spacing:.24em;color:' + RUST + '}',
      '.m26l-close{appearance:none;border:1px solid ' + INK + ';background:transparent;color:' + INK + ';',
        'font:700 10px "IBM Plex Mono",monospace;letter-spacing:.14em;padding:8px 13px;cursor:pointer}',
      '.m26l-close:hover{background:' + INK + ';color:' + PAPER + '}',
      '.m26l-scroll{flex:1;overflow:auto;overscroll-behavior:contain}',
      '.m26l-scroll::-webkit-scrollbar{width:10px}',
      '.m26l-scroll::-webkit-scrollbar-thumb{background:rgba(29,27,23,.28)}',

      /* dossier: identity */
      '.m26l-id{display:grid;grid-template-columns:210px 1fr;gap:34px;padding:34px 40px 30px}',
      '.m26l-portrait{position:relative;width:210px;height:250px;border:1px solid ' + INK + ';background:#fff;overflow:hidden}',
      '.m26l-portrait canvas,.m26l-portrait img{display:block;width:100%;height:100%;object-fit:cover}',
      '.m26l-portrait-tag{position:absolute;left:8px;bottom:8px;font:700 8px "IBM Plex Mono",monospace;',
        'letter-spacing:.2em;color:' + MUTE + ';background:rgba(243,241,234,.85);padding:3px 6px}',
      '.m26l-id-main{min-width:0;display:flex;flex-direction:column}',
      '.m26l-id-no{font:700 9px "IBM Plex Mono",monospace;letter-spacing:.22em;color:' + RUST + '}',
      '.m26l-id-name{font:700 clamp(30px,4vw,50px) "Space Mono",monospace;letter-spacing:-.03em;line-height:1.02;margin:6px 0 4px;text-transform:uppercase;display:flex;align-items:center;gap:.3em;flex-wrap:wrap}',
      '.m26l-id-name .m26l-mark{font-size:.82em}',
      '.m26l-id-name .m26l-markimg{width:.8em;height:.8em}',
      '.m26l-id-name .m26l-dot{width:.42em;height:.42em}',
      '.m26l-id-role{font:400 11px "IBM Plex Mono",monospace;letter-spacing:.12em;color:' + MUTE + '}',
      '.m26l-id-bio{font:300 17px/1.65 Spectral,Georgia,serif;max-width:56ch;margin:16px 0 0}',
      '.m26l-id-bio.empty{color:' + MUTE + ';font-style:italic}',
      '.m26l-links{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}',
      '.m26l-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(29,27,23,.4);',
        'padding:6px 11px;font:700 10px "IBM Plex Mono",monospace;letter-spacing:.1em;color:' + INK + ';',
        'text-decoration:none;transition:.12s}',
      '.m26l-chip:hover{background:' + INK + ';color:' + PAPER + ';border-color:' + INK + '}',
      '.m26l-chip .g{color:' + RUST + '}',
      '.m26l-chip:hover .g{color:' + PAPER + '}',
      '.m26l-nolinks{font:400 10px "IBM Plex Mono",monospace;letter-spacing:.1em;color:' + MUTE + ';margin-top:18px}',

      /* dossier: per-week graph */
      '.m26l-section{padding:8px 40px 4px}',
      '.m26l-sectag{display:flex;align-items:baseline;gap:12px;border-top:1px solid rgba(29,27,23,.16);padding-top:22px;margin-bottom:16px}',
      '.m26l-sectag b{font:700 10px "IBM Plex Mono",monospace;letter-spacing:.24em;color:' + RUST + '}',
      '.m26l-sectag span{font:400 9px "IBM Plex Mono",monospace;letter-spacing:.14em;color:' + MUTE + '}',
      '.m26l-graph{display:flex;align-items:flex-end;gap:4px;height:120px;padding:0 2px}',
      '.m26l-gcol{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:6px;cursor:default}',
      '.m26l-gbar{width:100%;max-width:26px;background:var(--sc);min-height:2px;transition:height .2s}',
      '.m26l-gbar.zero{background:rgba(29,27,23,.12)}',
      '.m26l-gcol.hit .m26l-gbar{outline:2px solid ' + INK + ';outline-offset:1px}',
      '.m26l-gwk{font:400 8px "IBM Plex Mono",monospace;color:' + MUTE + ';white-space:nowrap}',
      '.m26l-gcount{font:700 9px "Space Mono",monospace;color:' + INK + ';height:11px}',

      /* dossier: works */
      '.m26l-weekband{padding:4px 40px 6px}',
      '.m26l-weekhead{display:flex;align-items:baseline;gap:12px;margin:24px 0 14px}',
      '.m26l-weekno{font:700 13px "Space Mono",monospace;letter-spacing:.06em;background:' + INK + ';color:' + PAPER + ';padding:3px 8px}',
      '.m26l-weekdates{font:400 10px "IBM Plex Mono",monospace;letter-spacing:.14em;color:' + MUTE + '}',
      '.m26l-works{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:18px}',
      '.m26l-work{border:1px solid rgba(29,27,23,.22);background:#faf9f4;display:flex;flex-direction:column;overflow:hidden}',
      '.m26l-work-media{background:#efece3;border-bottom:1px solid rgba(29,27,23,.14);min-height:0}',
      '.m26l-work-media img,.m26l-work-media video,.m26l-work-media canvas,.m26l-work-media iframe{width:100%;display:block;max-height:230px;object-fit:cover}',
      '.m26l-work-media figure,.m26l-work-media .m26-media{margin:0}',
      '.m26l-work-body{padding:12px 14px 15px;display:flex;flex-direction:column;gap:7px}',
      '.m26l-work-meta{display:flex;flex-wrap:wrap;gap:8px;font:700 8px "IBM Plex Mono",monospace;letter-spacing:.14em;color:' + MUTE + '}',
      '.m26l-work-meta .k{color:' + RUST + '}',
      '.m26l-work-text{font:300 14px/1.55 Spectral,Georgia,serif;color:#2a2820;margin:0}',
      '.m26l-work-text.empty{color:' + MUTE + ';font-style:italic}',
      '.m26l-d-foot{padding:26px 40px 40px;font:400 9px "IBM Plex Mono",monospace;letter-spacing:.14em;color:' + MUTE + '}',

      '@media(max-width:720px){',
        '.m26l-thead,.m26l-row{grid-template-columns:34px 1fr 60px}',
        '.m26l-act{display:none}',
        /* keep the name on its own line so it never gets crushed by the role */
        '.m26l-namecell{flex-wrap:wrap}',
        '.m26l-namesub{flex-basis:100%;white-space:normal}',
        '.m26l-id{grid-template-columns:1fr;gap:22px}',
        '.m26l-portrait{width:160px;height:190px}',
        '.m26l-panel{inset:2vh 2vw}',
        '.m26l-id,.m26l-section,.m26l-weekband,.m26l-d-foot{padding-left:22px;padding-right:22px}',
      '}'
    ].join('');
    var st = document.createElement('style');
    st.id = 'm26l-styles';
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* ---- profiles (optional) ------------------------------------------------ */
  function profilesPath() {
    var s = (M26.CONFIG && M26.CONFIG.submissionsCsv) || '';
    if (/submissions\.csv$/i.test(s)) return s.replace(/submissions\.csv$/i, 'profiles.json');
    return 'data/profiles.json';
  }
  function loadProfiles() {
    var url = profilesPath();
    return fetch(url, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (j) { return (j && typeof j === 'object') ? j : {}; })
      .catch(function () { return {}; });
  }

  var DITHER = '▓▒░░▒▓▓▒░░▒▓▓▒░░▒▓▓▒░░▒▓▓▒░░▒▓▓▒░░▒▓▓▒░░▒▓▓▒░░▒▓▓▒░░▒▓▓▒░░▒▓▓▒░░▒▓▓▒░░▒▓▓▒░░▒▓';

  /* ======================================================================== */
  function render(container, opts) {
    opts = opts || {};
    injectStyles();
    container.className = 'm26l';
    container.textContent = '';
    var loading = el('div', 'm26l-wrap');
    loading.appendChild(el('p', 'm26l-status', 'reading the ledger…'));
    container.appendChild(loading);

    Promise.all([M26.loadAll(), loadProfiles()]).then(function (res) {
      container.textContent = '';
      build(container, res[0], res[1], opts);
    }).catch(function (err) {
      container.textContent = '';
      var w = el('div', 'm26l-wrap');
      w.appendChild(el('p', 'm26l-status', 'The ledger could not be loaded — ' + err.message + '.'));
      container.appendChild(w);
    });
  }

  function build(container, data, profiles, opts) {
    var roster = data.roster;
    var subs = data.submissions.slice().sort(function (a, b) { return a.t - b.t; });

    var wMax = 1;
    subs.forEach(function (r) { if (r.week > wMax) wMax = r.week; });
    var weeks = [];
    for (var w = 1; w <= wMax; w++) weeks.push(w);
    var weekTotal = {}, globalPeak = 1;
    subs.forEach(function (r) { weekTotal[r.week] = (weekTotal[r.week] || 0) + 1; });
    for (var k in weekTotal) if (weekTotal[k] > globalPeak) globalPeak = weekTotal[k];

    var students = roster.map(function (name, i) {
      var works = subs.filter(function (r) { return r.studentIndex === i; });
      var byWeek = {}, peak = 0;
      works.forEach(function (r) { byWeek[r.week] = (byWeek[r.week] || 0) + 1; });
      for (var wk in byWeek) if (byWeek[wk] > peak) peak = byWeek[wk];
      var activeWeeks = Object.keys(byWeek).length;
      var slug = M26.slugFor(name);
      var profile = profiles[slug] || null;
      return {
        name: name, index: i, works: works, byWeek: byWeek, peak: peak, activeWeeks: activeWeeks,
        slug: slug, mark: (profile && profile.mark && String(profile.mark).trim()) || '',
        color: M26.colorFor(i, roster.length, 46), colorSoft: M26.colorFor(i, roster.length, 66),
        count: works.length,
        profile: profile
      };
    });

    var sortMode = 'name';
    function sorted() {
      var a = students.slice();
      if (sortMode === 'activity') a.sort(function (x, y) { return y.count - x.count || x.name.localeCompare(y.name); });
      else a.sort(function (x, y) { return x.name.localeCompare(y.name, undefined, { sensitivity: 'base' }); });
      return a;
    }

    var wrap = el('div', 'm26l-wrap');

    /* header */
    if (opts.embedded && opts.onReturn) {
      var back = el('button', 'm26l-back', '↑ BACK INTO THE CLOUD');
      back.type = 'button';
      back.addEventListener('click', opts.onReturn);
      wrap.appendChild(back);
    } else {
      var toCloud = el('a', 'm26l-back', '← THE CLOUD — the whole semester as one field');
      toCloud.href = M26.pageUrl('index.html');
      toCloud.style.display = 'inline-block';
      toCloud.style.textDecoration = 'none';
      wrap.appendChild(toCloud);
    }
    wrap.appendChild(el('p', 'm26l-eyebrow', 'M26 STUDIO · CEPT · 2026 — THE LEDGER'));

    var card = el('div', 'm26l-card');
    card.appendChild(el('div', 'm26l-dither', DITHER));
    var ch = el('div', 'm26l-cardhead');
    ch.appendChild(el('h1', 'm26l-title', 'ARCHIVE / LEDGER'));
    card.appendChild(ch);

    /* stats + sort */
    var strip = el('div', 'm26l-strip');
    var stats = el('div', 'm26l-stats');
    function stat(n, l) { var s = el('div', 'm26l-stat'); s.appendChild(el('b', null, n)); s.appendChild(el('span', null, l)); return s; }
    stats.appendChild(stat(('00' + subs.length).slice(-3), 'ENTRIES'));
    stats.appendChild(stat(('00' + roster.length).slice(-2), 'STUDENTS'));
    stats.appendChild(stat(('00' + Object.keys(weekTotal).length).slice(-2), 'ACTIVE WEEKS'));
    strip.appendChild(stats);

    var sortWrap = el('div', 'm26l-sort');
    sortWrap.appendChild(el('span', null, 'SORT'));
    var bName = el('button', 'm26l-sortbtn', 'A–Z'); bName.type = 'button'; bName.setAttribute('aria-pressed', 'true');
    var bAct = el('button', 'm26l-sortbtn', 'MOST ACTIVE'); bAct.type = 'button'; bAct.setAttribute('aria-pressed', 'false');
    bName.addEventListener('click', function () { sortMode = 'name'; bName.setAttribute('aria-pressed', 'true'); bAct.setAttribute('aria-pressed', 'false'); paintRows(); });
    bAct.addEventListener('click', function () { sortMode = 'activity'; bName.setAttribute('aria-pressed', 'false'); bAct.setAttribute('aria-pressed', 'true'); paintRows(); });
    sortWrap.appendChild(bName); sortWrap.appendChild(bAct);
    strip.appendChild(sortWrap);
    card.appendChild(strip);

    /* legend — teach the marks so nothing needs decoding */
    var legend = el('div', 'm26l-legend');
    function leg(b, t) { var d = el('div', null); d.appendChild(el('b', null, b)); d.appendChild(document.createTextNode(' ' + t)); return d; }
    legend.appendChild(leg('MARK + COLOUR', '= one student'));
    legend.appendChild(leg('STRIP', '= submissions each week'));
    legend.appendChild(leg('ROW →', 'opens their dossier'));
    card.appendChild(legend);

    /* newest work — what the cohort just filed. Images only: this strip is a photo rail,
       so pdf/audio/text entries wait for the dossier instead of rendering as buttons. */
    var recent = subs.slice().sort(function (a, b) { return b.t - a.t; })
      .filter(function (r) { return M26.resolveMedia(r).mode === 'img'; })
      .slice(0, 6);
    if (recent.length) {
      var latestWk = 0;
      subs.forEach(function (r) { if (r.week > latestWk) latestWk = r.week; });
      var lat = el('div', 'm26l-latest');
      var lt = el('div', 'm26l-latest-tag');
      lt.appendChild(el('b', null, '◷ NEWEST WORK'));
      lt.appendChild(el('span', null, 'WEEK ' + w2(latestWk) + ' · WHAT THE COHORT JUST FILED'));
      lat.appendChild(lt);
      var lrow = el('div', 'm26l-latest-row');
      recent.forEach(function (row) { lrow.appendChild(buildLatestCard(row, students[row.studentIndex])); });
      lat.appendChild(lrow);
      card.appendChild(lat);
    }

    /* table head */
    var thead = el('div', 'm26l-thead');
    thead.appendChild(el('div', null, 'NO.'));
    thead.appendChild(el('div', null, 'STUDENT'));
    thead.appendChild(el('div', null, 'ACTIVITY · W01–W' + w2(wMax)));
    thead.appendChild(el('div', 'r', 'SUBS'));
    card.appendChild(thead);

    var rowsHost = el('div', 'm26l-rows');
    card.appendChild(rowsHost);

    function activityStrip(student) {
      var host = el('div', 'm26l-act');
      weeks.forEach(function (wk) {
        var c = student.byWeek[wk] || 0;
        var lvl = c === 0 ? 0 : Math.max(1, Math.round(c / globalPeak * 8));
        var g = el('span', null, RAMP[lvl]);
        g.style.color = c === 0 ? 'rgba(29,27,23,.20)' : student.color;
        g.title = 'W' + w2(wk) + ' · ' + c + (c === 1 ? ' entry' : ' entries');
        host.appendChild(g);
      });
      return host;
    }

    function paintRows() {
      rowsHost.textContent = '';
      if (!roster.length) { rowsHost.appendChild(el('p', 'm26l-status', 'The roster fills as the semester begins — this is week zero. Every student and every work will appear here as they arrive.')); return; }
      sorted().forEach(function (s, i) {
        var row = el('button', 'm26l-row');
        row.type = 'button';
        row.appendChild(el('div', 'm26l-no', w2(i + 1)));
        var nc = el('div', 'm26l-namecell');
        nc.appendChild(markNode(s));
        nc.appendChild(el('span', 'm26l-name', s.name));
        var role = s.profile && s.profile.role;
        if (role) nc.appendChild(el('span', 'm26l-namesub', '· ' + role));
        row.appendChild(nc);
        row.appendChild(activityStrip(s));
        var subs2 = el('div', 'm26l-subs');
        var b = el('b', null, ('00' + s.count).slice(-2)); subs2.appendChild(b);
        subs2.appendChild(document.createTextNode(s.count === 1 ? ' sub' : ' subs'));
        subs2.appendChild(el('span', 'm26l-open', '↗'));
        row.appendChild(subs2);
        row.addEventListener('click', function () { openDossier(s, i + 1); });
        rowsHost.appendChild(row);
      });
    }
    paintRows();

    card.appendChild(el('div', 'm26l-dither', DITHER));
    wrap.appendChild(card);

    /* foot */
    var foot = el('div', 'm26l-foot');
    foot.appendChild(el('div', null, 'ROW = STUDENT · STRIP = SUBMISSIONS PER WEEK · CLICK A ROW FOR THE DOSSIER'));
    var right = el('div', null, '');
    var formA = el('a', 'm26l-link', 'SUBMIT WORK →');
    formA.href = M26.CONFIG.formUrl; formA.target = '_blank'; formA.rel = 'noopener noreferrer';
    right.appendChild(formA);
    foot.appendChild(right);
    wrap.appendChild(foot);

    if (data.unmatched && data.unmatched.length) {
      var names = data.unmatched.map(function (r) { return r.student; })
        .filter(function (n, i, a) { return a.indexOf(n) === i; }).join(', ');
      wrap.appendChild(el('p', 'm26l-warn',
        data.unmatched.length + ' submission' + (data.unmatched.length === 1 ? ' is' : 's are')
        + ' on file but not shown — the Student name doesn’t match the roster: ' + names + '.'));
    }

    container.appendChild(wrap);

    /* ---------------------------------------------------------------- dossier */
    var openEl = null, prevOverflow = '';
    function closeDossier() {
      if (!openEl) return;
      var node = openEl; openEl = null;
      node.classList.remove('open');
      document.removeEventListener('keydown', onKey);
      document.documentElement.style.overflow = prevOverflow;
      setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 300);
    }
    function onKey(e) { if (e.key === 'Escape') closeDossier(); }

    function openDossier(student, no) {
      if (openEl) closeDossier();
      var backdrop = el('div', 'm26l-backdrop');
      backdrop.addEventListener('click', function (e) { if (e.target === backdrop) closeDossier(); });
      var panel = el('div', 'm26l-panel');
      panel.style.setProperty('--sc', student.color);
      ['tl', 'tr', 'bl', 'br'].forEach(function (c) { panel.appendChild(el('div', 'm26l-tick ' + c)); });
      backdrop.appendChild(panel);

      /* top bar */
      var bar = el('div', 'm26l-d-bar');
      bar.appendChild(el('div', 'm26l-d-bartag', 'DOSSIER · ' + w2(no) + ' / ' + w2(roster.length)));
      var closeB = el('button', 'm26l-close', '[ ✕ CLOSE ]'); closeB.type = 'button';
      closeB.addEventListener('click', closeDossier);
      bar.appendChild(closeB);
      panel.appendChild(bar);

      var scroll = el('div', 'm26l-scroll');
      panel.appendChild(scroll);

      /* identity */
      var id = el('div', 'm26l-id');
      var portrait = el('div', 'm26l-portrait');
      renderPortrait(portrait, student);
      id.appendChild(portrait);

      var main = el('div', 'm26l-id-main');
      main.appendChild(el('div', 'm26l-id-no', 'STUDENT ' + w2(no) + ' · ' + student.count + (student.count === 1 ? ' SUBMISSION' : ' SUBMISSIONS') + ' · ' + student.activeWeeks + ' ACTIVE WEEK' + (student.activeWeeks === 1 ? '' : 'S')));
      var nm = el('div', 'm26l-id-name');
      nm.appendChild(markNode(student));
      nm.appendChild(document.createTextNode(student.name));
      main.appendChild(nm);
      main.appendChild(el('div', 'm26l-id-role', (student.profile && student.profile.role) ? student.profile.role : 'M26 STUDIO · CEPT · 2026'));
      var bioText = student.profile && student.profile.bio && String(student.profile.bio).trim();
      var bio = el('p', 'm26l-id-bio' + (bioText ? '' : ' empty'), bioText || 'No profile written yet — add a bio in profiles.json.');
      main.appendChild(bio);
      main.appendChild(buildLinks(student));
      id.appendChild(main);
      scroll.appendChild(id);

      /* per-week graph */
      var gsec = el('div', 'm26l-section');
      var gtag = el('div', 'm26l-sectag');
      gtag.appendChild(el('b', null, '◈ ACTIVITY PER WEEK'));
      gtag.appendChild(el('span', null, 'W01–W' + w2(wMax) + ' · ' + student.count + ' TOTAL'));
      gsec.appendChild(gtag);
      gsec.appendChild(buildGraph(student));
      scroll.appendChild(gsec);

      /* works, banded by week */
      var wsec = el('div', 'm26l-section');
      var wtag = el('div', 'm26l-sectag');
      wtag.appendChild(el('b', null, '◍ THE WORKS'));
      wtag.appendChild(el('span', null, 'EVERY SUBMISSION, IN ORDER'));
      wsec.appendChild(wtag);
      scroll.appendChild(wsec);

      if (!student.works.length) {
        var band0 = el('div', 'm26l-weekband');
        band0.appendChild(el('p', 'm26l-status', 'No submissions filed yet.'));
        scroll.appendChild(band0);
      } else {
        var curWeek = null, band = null, grid = null;
        student.works.forEach(function (row) {
          if (row.week !== curWeek) {
            curWeek = row.week;
            band = el('div', 'm26l-weekband');
            var wh = el('div', 'm26l-weekhead');
            wh.appendChild(el('span', 'm26l-weekno', 'W' + w2(row.week)));
            wh.appendChild(el('span', 'm26l-weekdates', weekRange(row.week)));
            band.appendChild(wh);
            grid = el('div', 'm26l-works');
            band.appendChild(grid);
            scroll.appendChild(band);
          }
          grid.appendChild(buildWork(row));
        });
      }

      var dfoot = el('div', 'm26l-d-foot');
      dfoot.appendChild(document.createTextNode('CLOSE (ESC) TO RETURN TO THE LEDGER · ' + student.name.toUpperCase()));
      scroll.appendChild(dfoot);

      container.appendChild(backdrop);
      prevOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = 'hidden';
      openEl = backdrop;
      document.addEventListener('keydown', onKey);
      requestAnimationFrame(function () { requestAnimationFrame(function () { backdrop.classList.add('open'); }); });
    }

    function buildLinks(student) {
      var p = student.profile || {};
      var l = p.links || {};
      var defs = [
        ['instagram', 'Instagram', '◐'], ['linkedin', 'LinkedIn', '▤'],
        ['behance', 'Behance', '❖'], ['website', 'Website', '↗'], ['email', 'Email', '✉']
      ];
      var host = el('div', 'm26l-links');
      var any = false;
      defs.forEach(function (d) {
        var url = safeUrl(l[d[0]], d[0] === 'email');
        if (!url) return;
        any = true;
        var a = el('a', 'm26l-chip'); a.href = url;
        if (d[0] !== 'email') { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
        a.appendChild(el('span', 'g', d[2]));
        a.appendChild(el('span', null, d[1]));
        host.appendChild(a);
      });
      if (!any) { host.className = 'm26l-nolinks'; host.textContent = 'No links yet — add them in profiles.json (instagram · linkedin · behance · website · email).'; }
      return host;
    }

    function buildGraph(student) {
      var g = el('div', 'm26l-graph');
      g.style.setProperty('--sc', student.colorSoft);
      var peak = Math.max(1, student.peak);
      weeks.forEach(function (wk) {
        var c = student.byWeek[wk] || 0;
        var col = el('div', 'm26l-gcol');
        col.appendChild(el('div', 'm26l-gcount', c ? String(c) : ''));
        var bar = el('div', 'm26l-gbar' + (c ? '' : ' zero'));
        bar.style.height = (c ? Math.max(6, Math.round(c / peak * 96)) : 2) + 'px';
        if (c) bar.style.background = student.color;
        col.appendChild(bar);
        col.appendChild(el('div', 'm26l-gwk', w2(wk)));
        col.title = 'Week ' + w2(wk) + ' · ' + c + (c === 1 ? ' submission' : ' submissions');
        g.appendChild(col);
      });
      return g;
    }

    function buildLatestCard(row, student) {
      var c = el('div', 'm26l-lcard');
      c.setAttribute('role', 'button'); c.setAttribute('tabindex', '0');
      var who = student ? student.name : row.student;
      c.setAttribute('aria-label', who + ' — ' + (row.kind || 'entry') + ', week ' + w2(row.week) + '. Open dossier.');
      var fig = el('figure', 'm26l-lmedia');
      var hasMedia = M26.renderMediaInto(fig, row);
      if (hasMedia) c.appendChild(fig);
      var body = el('div', 'm26l-lbody');
      var nm = el('div', 'm26l-lname');
      if (student) nm.appendChild(markNode(student));
      nm.appendChild(el('span', 'm26l-name', who));
      body.appendChild(nm);
      body.appendChild(el('div', 'm26l-lmeta', 'W' + w2(row.week) + ' · ' + (row.kind || 'entry').toUpperCase() + ' · ' + row.dateStr));
      c.appendChild(body);
      if (student) {
        var open = function () { openDossier(student, student.index + 1); };
        c.addEventListener('click', open);
        c.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      }
      return c;
    }

    function buildWork(row) {
      var art = el('article', 'm26l-work');
      var fig = el('figure', 'm26l-work-media');
      var hasMedia = M26.renderMediaInto(fig, row);
      if (hasMedia) art.appendChild(fig);
      var body = el('div', 'm26l-work-body');
      var meta = el('div', 'm26l-work-meta');
      var kind = el('span', 'k', (row.kind || 'entry').toUpperCase()); meta.appendChild(kind);
      meta.appendChild(el('span', null, (row.type || '').toUpperCase()));
      meta.appendChild(el('span', null, row.dateStr));
      body.appendChild(meta);
      if (row.text) body.appendChild(el('p', 'm26l-work-text', row.text));
      else if (!hasMedia) body.appendChild(el('p', 'm26l-work-text empty', '(no caption)'));
      art.appendChild(body);
      return art;
    }

    /* portrait: profile.photo → a quiet default-person placeholder (the instagram kind) */
    function renderPortrait(box, student) {
      box.textContent = '';
      var photo = student.profile && safeUrl(student.profile.photo);
      if (photo) {
        var img = new Image();
        img.alt = student.name;
        img.onerror = function () { placeholderPortrait(box, student); };
        img.src = photo;
        box.appendChild(img);
        return;
      }
      placeholderPortrait(box, student);
    }
    function placeholderPortrait(box, student) {
      box.textContent = '';
      var cv = document.createElement('canvas');
      var W = 210, H = 250, dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = W * dpr; cv.height = H * dpr;
      var g = cv.getContext('2d'); g.scale(dpr, dpr);
      g.fillStyle = '#eceae2'; g.fillRect(0, 0, W, H);
      // grey silhouette: head + shoulders, clipped at the frame's bottom edge
      g.fillStyle = '#b9b5aa';
      g.beginPath(); g.arc(W / 2, H * 0.40, W * 0.185, 0, 6.2832); g.fill();
      g.beginPath(); g.ellipse(W / 2, H * 0.96, W * 0.34, H * 0.26, 0, Math.PI, 0); g.fill();
      box.appendChild(cv);
      box.appendChild(el('div', 'm26l-portrait-tag', 'NO PORTRAIT YET'));
    }
  }

  window.M26ArchiveLedger = { render: render };
})();
