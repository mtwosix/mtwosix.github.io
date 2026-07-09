# M26 → Framer — the migration kit

Everything you need to rebuild the shell in Framer and keep working, without
losing the data pipeline or the canvas. Nothing in this folder affects the
live site — it's a toolbox.

## The shape of the move

**Framer takes over:** the pages/panels (Studio, Work, People), typography,
layout, navigation, and the CMS for people + submissions.

**GitHub keeps:** the point cloud (`canvas.html`) and the form → sheet →
`submissions.csv` pipeline. The cloud drops into Framer as an embed
(`code/CanvasEmbed.tsx`) — so this repo must stay deployed on Pages even
after the shell moves. You said you're trying something else for the middle
part; whenever that's ready, just point the embed at the new URL (or delete
the embed and place whatever you build instead). Nothing else depends on it.

**The middle part is untouched by this kit.**

## Order of operations (roughly an afternoon)

1. **Tokens first** — set up the Color and Text styles from `tokens.md`.
2. **CMS Collections** — create three collections and import the CSVs from `cms/`:
   - **People** ← `people.csv` (7 real entries; the Photo column carries live
     image URLs, Framer downloads them on import). Fields: Title, Slug, Role,
     Group (use it to split Studio leads / Guest lecturers in two filtered lists).
   - **Students** ← `students.csv` (headers only — the real roster is still
     empty; rows arrive when the semester starts). For layout testing import
     `students-SAMPLE-not-real.csv` into a *separate throwaway collection* and
     delete it before launch — the no-fake-data rule follows you to Framer.
   - **Submissions** ← `submissions.csv` (currently 1 real row). Same deal:
     `submissions-SAMPLE-not-real.csv` (75 rows) is for testing only.
3. **Pages** — rebuild the three panels as pages or overlays using `copy.md`
   verbatim. Framer overlays + slide transitions reproduce the edge-panel
   feel; native CMS lists + filters replace `aa-work.js` (filter by Week /
   Type / Student without code).
4. **Code components** — Assets → Code → paste `code/CanvasEmbed.tsx` and
   `code/Ticker.tsx`. CanvasEmbed = the middle part, pointing at
   `https://mtwosix.github.io/canvas.html`.
5. **Live data (optional but recommended)** — Framer can't read the CSV in
   this repo at runtime, but it reads JSON. Add `apps-script-live-feed.gs`
   to the existing Apps Script project, deploy as a web app ("Anyone"), and
   use that URL in the Ticker component and in Framer's **Fetch** for live
   counters. The Google Form pipeline then feeds BOTH the cloud (via CSV)
   and Framer (via JSON) from the same sheet.
6. **Keeping the CMS in sync** — two honest options:
   - *Manual:* re-import `submissions.csv` into the CMS every week or two
     (imports upsert by Slug). Fine for a semester.
   - *Automatic:* a small script that pushes new sheet rows to the Framer CMS
     API on a schedule. More moving parts; only worth it if the manual rhythm
     annoys you. Ask me and I'll build it.
7. **Domain** — when the Framer site is ready, point the domain at Framer and
   keep `mtwosix.github.io` as the canvas + data host. Old deep links
   (`#work=name`, `people.html#slug`) die unless you recreate slugs — the CSVs
   here carry the same slugs so CMS URLs can match.

## What doesn't translate (so you're not surprised)

- The one-screen no-scroll room: Framer pages scroll by default. Overlays
  get close; pixel-exact edge-bar behaviour would need heavy custom code —
  decide whether the AA-feel or Framer-native ergonomics win.
- The film grain / ghost numerals: rebuild as image layers (cheap) or skip.
- The in-site PDF reader and the comment system (discourse) — those live in
  this repo's JS. Keep linking media out, or keep those views on the GitHub
  side.

## Files

```
framer-kit/
├── README.md                        this guide
├── tokens.md                        colours + type styles to recreate
├── copy.md                          every word on the site, paste-ready
├── apps-script-live-feed.gs         JSON feed for Framer Fetch / Ticker
├── cms/
│   ├── people.csv                   REAL — leads + guests, live photo URLs
│   ├── students.csv                 headers only (roster is genuinely empty)
│   ├── students-SAMPLE-not-real.csv layout testing only — delete before launch
│   ├── submissions.csv              REAL — the record as of export
│   └── submissions-SAMPLE-not-real.csv  75 sandbox rows — delete before launch
└── code/
    ├── CanvasEmbed.tsx              the middle part, framed (don't restyle it here)
    └── Ticker.tsx                   live marquee fed by the JSON feed
```
