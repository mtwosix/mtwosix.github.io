# Imagination Infrastructure — M26 Studio · CEPT · 2026

One dataset, two lenses:

- **The cloud** (`index.html`) — a living 3D point-cloud of the semester. Each thread is a
  student, each point a real piece of submitted work, coloured by student and arranged in time.
  Scroll to travel from the isometric overview down into the cloud and through everyone's work.
  Keep scrolling past the last submission and the site surfaces into…
- **The archive** (`archive.html`, and the end of the scroll on the main page) — the same
  submissions as an ordinary, readable page: every student, their work in chronological order,
  images/video/audio inline, a student index to jump around. Semantic HTML, keyboard-navigable,
  fine on phones.

Both views read the same two CSV files and show **only** what's in them — a student with no
submissions has an empty section and zero dots. Nothing is invented, ever.

## Hosting (GitHub Pages — no build step)

The site is plain static files served straight from the `main` branch root. Push to `main`,
GitHub Pages republishes within a minute or two. There is nothing to build, bundle, or configure.

Everything the site needs ships in the repo — including its two runtime libraries in `vendor/`
— so it has **no dependency on any third-party CDN** being up.

Setup (only needed once): repo **Settings → Pages → Deploy from a branch → `main` / root**.

## The sandbox (test the site without touching real data)

Add `?sandbox` to either page's URL and the whole site runs against the sample dataset in
`data/sandbox/` — 15 dummy students with five submissions each (text, image, video, audio,
pdf) — with a visible **SANDBOX — sample data** badge. The real site at the plain URL is
completely unaffected, so you can stress-test while the real site is live:

- `…/M26_STUDIO/?sandbox` — the cloud with sample data
- `…/M26_STUDIO/archive.html?sandbox` — the archive with sample data

To simulate "a submission arrives and a point pops in": keep a sandbox tab open, edit
`data/sandbox/submissions.csv` on github.com, add a row, commit — the new dot pulses in
within ~15 s, exactly as a real pipeline commit would on the real site.

## Updating the content

You never touch code to publish work. See **`data/README.md`** for the field-by-field guide:

- **`data/students.csv`** — the roster. One name per row.
- **`data/submissions.csv`** — the submitted work. One row per piece. Normally written by the
  Google Form → Apps Script pipeline (see `pipeline/`), but can also be edited by hand on
  github.com.
- **`uploads/`** — images referenced by relative path from submissions.csv. Submissions from
  the form pipeline reference Google Drive links instead — both work.

The live site re-reads the CSVs every ~15 seconds while someone has the page open, so new
submissions appear on their own (with a brief arrival pulse in the cloud).

## The submission pipeline

Students submit through a Google Form; an Apps Script commits each response as a new row of
`data/submissions.csv`. The script, its setup, and the rules it must follow (exact column
schema, Drive sharing for uploaded files) are documented in **`pipeline/README.md`**.

**Do not change the column names or order of `submissions.csv`** —
`ID,Student,Date,Time,Kind,Type,Image,Text` — without updating the Apps Script to match.

## File structure

```
index.html                    the 3D cloud + the archive section at the end of the scroll
archive.html                  the archive as a standalone, ordinary page
support.js                    runtime the 3D page depends on — keep alongside index.html
js/
  m26-core.js                 shared data layer: CSV parsing, dates, colours, media links
  archive.js                  renders the archive (used by both pages)
css/
  site.css                    the shared design system (type, palette, motion)
vendor/                       React runtime files, vendored so no CDN is needed
data/
  students.csv                roster — add/remove/rename students here
  submissions.csv             the submitted work — written by the form pipeline
  README.md                   field-by-field guide for both CSVs
pipeline/                     Google Form → GitHub pipeline: reference script + setup guide
uploads/                      images referenced from submissions.csv
Living Canvas 3D.dc.html      source copy of index.html used for editor tooling — keep in sync
```

## Things worth knowing

- Everything here is client-side and static — no login, no server. Anyone with push access can
  edit the CSVs; anyone on the web can read them (that's how static hosting works).
- Caption/kind/name text from the form is treated as untrusted input and is always rendered as
  plain text, never as HTML.
- The CSVs are parsed tolerantly: CRLF or LF line endings, quoted commas, stray quotes, odd
  times like `9:05` are all fine. Rows with an unparseable date, or a Student not on the
  roster, are skipped — and the archive footer says so out loud rather than hiding it.
