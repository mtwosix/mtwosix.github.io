/* ============================================================================
   M26 viewer — media stays inside the site.

   One overlay for both pages:
     image → large view over an ink backdrop, caption + a quiet
             "open original ↗" link (no more jumping off to Drive)
     pdf   → a vertical chain of pages rendered with pdf.js
             (vendored in vendor/pdfjs/, loaded lazily on first use);
             Drive-hosted PDFs use Drive's reader in the same frame

   Esc, ✕, or a click on the backdrop closes. Focus returns where it was.
   ============================================================================ */
(function () {
  'use strict';

  var overlay = null, stage = null, capEl = null, metaEl = null, origEl = null;
  var lastFocus = null, openState = false, pdfjsLib = null;

  // site root derived from this script's own URL — safe under any subpath
  var SITE_BASE = (function () {
    var s = document.currentScript;
    return s && s.src ? s.src.replace(/js\/viewer\.js.*$/, '') : './';
  })();

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function ensure() {
    if (overlay) return;
    overlay = el('div', 'm26-viewer');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Media viewer');

    var closeBtn = el('button', 'm26-viewer-close', '✕');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close viewer');
    closeBtn.addEventListener('click', close);

    stage = el('div', 'm26-viewer-stage');
    var foot = el('div', 'm26-viewer-foot');
    metaEl = el('div', 'm26-viewer-meta');
    capEl = el('div', 'm26-viewer-caption');
    origEl = el('a', 'm26-viewer-orig', 'open original ↗');
    origEl.target = '_blank'; origEl.rel = 'noopener noreferrer';
    foot.appendChild(metaEl);
    foot.appendChild(capEl);
    foot.appendChild(origEl);

    overlay.appendChild(closeBtn);
    overlay.appendChild(stage);
    overlay.appendChild(foot);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay || e.target === stage) close();
    });
    document.addEventListener('keydown', function (e) {
      if (openState && e.key === 'Escape') { e.stopPropagation(); close(); }
    }, true);
    document.body.appendChild(overlay);
  }

  function close() {
    if (!openState) return;
    openState = false;
    overlay.classList.remove('m26-viewer-open');
    document.documentElement.classList.remove('m26-viewer-lock');
    stage.textContent = ''; // stop pdf rendering targets / drop large bitmaps
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
    lastFocus = null;
  }

  function open(opts) {
    ensure();
    lastFocus = document.activeElement;
    openState = true;
    stage.textContent = '';
    stage.scrollTop = 0;
    metaEl.textContent = opts.meta || '';
    capEl.textContent = opts.caption || '';
    if (opts.href) { origEl.href = opts.href; origEl.style.display = ''; }
    else origEl.style.display = 'none';
    overlay.classList.add('m26-viewer-open');
    document.documentElement.classList.add('m26-viewer-lock');
    overlay.querySelector('.m26-viewer-close').focus();

    if (opts.kind === 'image') {
      var img = el('img', 'm26-viewer-img');
      img.alt = opts.caption || 'submission image';
      img.src = opts.src;
      stage.appendChild(img);
    } else if (opts.kind === 'pdf') {
      if (opts.pdfSrc) renderPdfChain(opts.pdfSrc);
      else if (opts.embedSrc) {
        var fr = el('iframe', 'm26-viewer-pdfframe');
        fr.src = opts.embedSrc;
        fr.title = 'PDF reader';
        fr.setAttribute('allowfullscreen', '');
        stage.appendChild(fr);
      }
    }
  }

  /* pdf.js: every page rendered once, stacked vertically. Loaded on demand so
     visitors who never open a PDF never download the library. */
  function loadPdfjs() {
    if (pdfjsLib) return Promise.resolve(pdfjsLib);
    return import(SITE_BASE + 'vendor/pdfjs/pdf.min.mjs').then(function (mod) {
      mod.GlobalWorkerOptions.workerSrc = SITE_BASE + 'vendor/pdfjs/pdf.worker.min.mjs';
      pdfjsLib = mod;
      return mod;
    });
  }

  function renderPdfChain(url) {
    var status = el('p', 'm26-viewer-status', 'opening pdf…');
    stage.appendChild(status);
    var chain = el('div', 'm26-viewer-pages');
    stage.appendChild(chain);
    var mySession = {};
    stage._session = mySession; // a later open()/close() invalidates this one

    loadPdfjs().then(function (pdfjs) {
      return pdfjs.getDocument(url).promise;
    }).then(function (doc) {
      if (stage._session !== mySession) return;
      status.textContent = doc.numPages + (doc.numPages === 1 ? ' page' : ' pages');
      var width = Math.min(chain.clientWidth || 800, 1100);
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var seq = Promise.resolve();
      var render = function (i) {
        seq = seq.then(function () {
          if (stage._session !== mySession) return;
          return doc.getPage(i).then(function (page) {
            if (stage._session !== mySession) return;
            var base = page.getViewport({ scale: 1 });
            var scale = width / base.width;
            var vp = page.getViewport({ scale: scale * dpr });
            var canvas = el('canvas', 'm26-viewer-page');
            canvas.width = vp.width; canvas.height = vp.height;
            canvas.style.width = width + 'px';
            canvas.style.height = (vp.height / dpr) + 'px';
            chain.appendChild(canvas);
            return page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
          });
        });
      };
      for (var i = 1; i <= doc.numPages; i++) render(i);
      return seq;
    }).catch(function (err) {
      if (stage._session !== mySession) return;
      status.textContent = 'could not open this pdf — ' + err.message;
    });
  }

  window.M26Viewer = { open: open, close: close };
})();
