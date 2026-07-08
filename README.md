# Imagination Infrastructure — M26 Studio · CEPT · 2026

A live studio website built as **static HTML/CSS/JS** — no build step, no framework runtime beyond a vendored React. The site is **one fixed screen — no page scroll, ever**: the living canvas (the 3D point-cloud of every submission) fills the middle of the viewport, and the sections are docked as labelled bars on the screen's edges. Clicking a bar slides its panel in over the canvas; the bar again, ✕, or Esc slides it home. Panels scroll internally.

- **The stage** — `canvas.html?embed` in a frameless iframe: the cloud opens directly on the settled iso structure (the title landing was removed) and the journey ends at the last submissions (the quote outro and embedded ledger were removed). Scroll to travel, drag to orbit, click a point.
- **01 · STUDIO** (left edge) — the brief, how the pipeline works, the 18-week calendar, one attributed voice per visit.
- **02 · WORK** (right edge) — every submission as a filterable wall (week / type / student); click a plate for a full-width detail fold with the media rendered in place.
- **03 · THE COHORT** (bottom edge) — the roster as an index; clicking a student opens WORK filtered to them.
- **Top strip** — brand, a ticker of the latest submissions, the week counter, SUBMIT.

Deep links: `#studio` / `#work` / `#cohort` open a panel; `#work=<slug>` opens WORK filtered to one student. On phones the side bars fold into a bottom tab row and every panel becomes a rising sheet.

Auxiliary pages: **`people.html`** keeps THE LEDGER (full register + dossiers, deep link `#<slug>`) as a plain page linked from the cohort panel; `canvas.html` is the cloud standalone; `archive.html`, `studio.html`, `work.html` are redirect stubs so old links keep working (`?sandbox` preserved).

Everything on the site derives from data. Until the CSVs are filled, the site is honestly empty (the cloud shows `PTS 000`, the ledger says "No students on the roster yet"). Nothing is fabricated.

---

## Run it locally

It's a static site — serve the `site/` folder over HTTP (fetch() won't run from `file://`):

```bash
cd site
python3 -m http.server 8000
# open http://localhost:8000/
```

Any static server works (`npx serve`, `caddy file-server`, VS Code Live Server, etc.).

## Deploy it

Push `site/` to any static host — **GitHub Pages**, Netlify, Vercel, Cloudflare Pages, S3. There is nothing to compile.

- **GitHub Pages:** put the contents of `site/` at the repo root (or set Pages → *Deploy from branch* → `/ (root)` or `/docs`), and it's live. All asset paths are relative (`./js/...`, `data/...`), so it works from any base path.
- The only external calls at runtime are Google Fonts (CSS), the Google **Form** (submissions in), and the Google **Apps Script** endpoint (discourse/comments). No server of your own is required.

---

## File map

```
site/
├── index.html            THE ONE-SCREEN SITE — canvas stage + edge bars + sliding panels (studio/work/cohort)
├── canvas.html           THE CANVAS — 3D experience (a Design Component; opens on the iso structure, ends at the last submissions; ?embed hides links that would navigate the stage iframe)
├── people.html           THE LEDGER — full register + dossiers, plain page (deep link #<slug>)
├── studio.html           redirect stub → ./#studio
├── work.html             redirect stub → ./#work
├── archive.html          redirect stub → people.html
├── css/
│   ├── site.css           Cloud/ledger chrome (skip link, sandbox badge, focus/expand panel, viewer)
│   └── aa.css             THE ONE-SCREEN INSTITUTION — top strip, edge bars, panels, grain, grids, index, calendar
├── js/
│   ├── m26-core.js        CONFIG + CSV parsing + row interpretation + the ?sandbox switch (window.M26). SHARED by every page.
│   ├── aa-app.js          The room: edge bars + sliding panels + hash routing + ticker + cohort + studio extras (window.AAApp).
│   ├── aa-work.js         The work wall: filters, plates, detail folds, filterStudent API (window.AAWork).
│   ├── archive-ledger.js  The ledger table + the dossier panel (window.M26ArchiveLedger). #slug deep link.
│   ├── discourse.js       Persistent comments via a Google-Sheet-backed Apps Script (window.M26Discourse).
│   └── viewer.js          Media rendering (image / video / audio / pdf) shared by every page.
├── vendor/               Vendored React + ReactDOM (production) and pdf.js — so there's no CDN runtime dependency.
├── support.js            Design-Component runtime (renders canvas.html's <x-dc>). Do not edit.
├── data/
│   ├── students.csv        THE ROSTER — one "Name" per row. (live)
│   ├── submissions.csv     THE SUBMISSIONS — ID,Student,Date,Time,Kind,Type,Image,Text. (live)
│   ├── profiles.json       OPTIONAL dossier profiles (bio / role / links / photo), keyed by student slug. (live)
│   └── sandbox/            Sample dataset (students.csv, submissions.csv, profiles.json) for ?sandbox.
└── uploads/              Submission media referenced by submissions.csv (and sandbox/ equivalents).
```

## The two views share one data model

Every page loads `js/m26-core.js` and reads `CONFIG.studentsCsv` + `CONFIG.submissionsCsv` identically (parsing, week assignment, colour-per-student, student glyph). Change the data and both views change together. There is deliberately **no fallback roster**.

- **Roster** (`data/students.csv`): one column, header `Name`, one student per row. Colours respace evenly across whoever is on the roster.
- **Submissions** (`data/submissions.csv`): header `ID,Student,Date,Time,Kind,Type,Image,Text`. `Student` must match a roster name exactly (unmatched rows are skipped with a console warning and, in the ledger, a footnote). `Date` places the dot on the week grid. `Type` drives media rendering (`image`/`video`/`audio`/`pdf`/`text`); `Image` is a path under `uploads/` or a URL.
- Both CSVs are **re-polled every 15s** while a page is open, so new submissions appear live (a freshly-arrived dot briefly pulses).

## `?sandbox` — same deploy, sample data

Append `?sandbox` to any page (`index.html?sandbox`, `archive.html?sandbox`) and the whole site runs against `data/sandbox/` instead of the live CSVs, with a visible SANDBOX badge and an "exit" link. The switch lives in `m26-core.js` (`SANDBOX` + `CONFIG`), and cross-page links preserve it. Use it to demo/stress-test before and during the semester without touching real data. (This replaces the old separate `sandbox-preview.html` / `sandbox-archive.html` staging files.)

---

## The dossier profiles — `data/profiles.json` (optional, additive)

The ledger's dossier pulls a student's portrait, role, bio, and links from `data/profiles.json`. It is **purely additive** — nothing here is derived from the CSVs, and every field is optional, so you can fill it in incrementally.

Key each entry by the student **slug**: the name lower-cased, accents stripped, spaces → hyphens (`Zoya` → `zoya`, `Zoë O'Brien` → `zo-o-brien`). Shape:

```json
{
  "jane-doe": {
    "photo": "uploads/portraits/jane-doe.jpg",
    "role": "Architecture · M26",
    "bio": "One or two sentences in the student's own voice.",
    "links": {
      "instagram": "https://instagram.com/…",
      "linkedin":  "https://linkedin.com/in/…",
      "behance":   "https://behance.net/…",
      "website":   "https://…",
      "email":     "jane@…"
    }
  }
}
```

- **Missing photo** → an auto-generated "constellation" is drawn instead: one dot per submission laid across the weeks in the student's colour, threaded together.
- **Missing bio / links / role** → graceful placeholders; only the links that exist render as chips.
- Links are validated (`http(s)` only, or a bare email → `mailto:`) before they become clickable. All CSV/profile text reaches the DOM via `textContent` (never `innerHTML`) — form input is untrusted.

Portraits are expected under `uploads/portraits/<slug>.jpg` (create the folder and drop images in), or any external image URL.

---

## The submission & discourse pipeline (Google-backed)

- **Submissions in:** `CONFIG.formUrl` is the public Google Form. A Google Apps Script appends form responses to `data/submissions.csv` and copies any uploaded media into `uploads/`. (This lives outside this repo — the studio's Apps Script project.)
- **Discourse (comments):** `CONFIG.discourseUrl` is an Apps Script web app backed by a Google Sheet. Visitors comment without accounts (a display name + a random owner-hash kept in `localStorage`). If `discourseUrl` is empty, comments are read-only. See `js/discourse.js` header for the request contract (POSTs use `text/plain` to stay a "simple" CORS request).

To point at your own backend, edit the three values in `CONFIG` (`m26-core.js`): `semesterStart`, `formUrl`, `discourseUrl` (and `weeks`).

---

## What changed in this session (the one-screen institution)

The site became a single fixed screen — no page scroll. `index.html` (the cloud) had already moved to `canvas.html`; the new `index.html` is a room: the cloud fills the middle as a frameless, always-on iframe stage, and STUDIO / WORK / THE COHORT are docked as bars on the left / right / bottom edges (top strip: brand, live ticker, week, SUBMIT). Clicking a bar slides its panel over the canvas (`js/aa-app.js` + `css/aa.css`); panels scroll internally; `#studio` / `#work` / `#cohort` / `#work=<slug>` deep-link. On phones the bars fold into a bottom tab row and panels rise as sheets.

The cloud itself was recut in `canvas.html`: it now opens directly on the settled iso structure (`minScroll()` — the title landing is unreachable) and the journey stops just short of the dive's dark run-out (`maxScroll() = cloudEnd() − 420`); the quote outro and the embedded end-of-dive ledger were removed along with their controller script. THE LEDGER survives as the plain `people.html` (linked from the cohort panel; `#<slug>` deep link).

The look: Archivo grotesque colliding with italic Spectral in panel titles, ghost outline numerals behind each page, film grain over the whole room, slow panel choreography. All data rules hold: strict 1:1 mirror of the CSVs, honest empty states, `textContent` only for untrusted values, `?sandbox` preserved everywhere.

---

## Previous session (visual overhaul)

**The cloud (`index.html`) — a new middle stage in the scroll journey.** Scrolling from the title now reads as: title disperses into ascii dust → the camera holds at a flat isometric view and **scales the whole structure to fit the screen** while the student route lines **grow in as directional dashes** → a beat to take in the structure whole → scrolling on releases the rotation and dives into the deep cloud. Also: the hold paper lifts to a lighter cream so the structure reads, breathing is preserved through the hold (perspective stays flat), points are larger throughout, and the cohort "settled" view is a clean flat-iso spread (no ring markers). Tuning constants live at the top of the `Component` class: `DISPERSE_LEN`, `GROW_LEN`, `ENTRY`, `ORTHO`, `_fitHold()`.

**The archive (`archive.html`) — rebuilt as the ledger + dossier** (`js/archive-ledger.js`), replacing the old week-by-week stream (`archive.js`, removed). The ledger is embedded at the end of the cloud dive too, so both entry points land on the same register.

---

## Notes for the next developer

- `canvas.html` is a **Design Component** (`<x-dc>` + `support.js`) — the cloud is authored as a `class Component extends DCLogic` at the bottom of the file. `support.js` is generated runtime; don't edit it by hand. Keep `Living Canvas 3D.dc.html` as a copy of `canvas.html` (editor tooling). All other pages are plain HTML/JS.
- Styling in `canvas.html` is intentionally **inline** (it streams/paints immediately); the cloud/ledger chrome is in `css/site.css`; the institution shell is in `css/aa.css`; the ledger injects its own `<style>` block once from `archive-ledger.js`.
- Fonts: Archivo (grotesque display, institution pages), Space Mono (display/mono), IBM Plex Mono (labels), Spectral (serif body). Palette: paper `#f3f1ea`, ink `#1d1b17`, rust accent `#8a5a34`, deep-space `#06060c`; per-student colours are generated in `m26-core.js` (`hueFor`).
- Keep the "nothing invented" contract: don't add fallback/sample data to the live path — use `?sandbox` for demos.
