# Publishing submissions & managing the roster

Two CSV files run the whole site — both the 3D cloud and the archive read exactly these.
CSV opens directly in Excel, Numbers, or Google Sheets, and GitHub renders and edits CSV as a
table in the browser. Edit a file, commit, and the live site picks the change up on its own
(checked on load and every ~15 s while a visitor has the page open).

Normally you don't edit `submissions.csv` at all — the Google Form pipeline appends rows
automatically (see `../pipeline/README.md`). Hand-editing is for corrections and removals.

## `students.csv`

One column, one name per row:

```
Name
Kiara
Yuvan
...
```

Add a row for a new student, delete a row to remove one, edit a cell to rename someone. Colours
respace evenly across the roster and both views regenerate around whatever names are here.

⚠️ If you rename a student here, their existing rows in `submissions.csv` must be renamed to
match (matching is by exact name, case-insensitive), and the name list in the Google Form
should be updated too — otherwise new submissions arrive under a name that no longer matches.

## `submissions.csv`

One row per real submission. **The column names and order are fixed** — the Apps Script writes
this exact schema, so don't change them without updating the script:

```
ID, Student, Date, Time, Kind, Type, Image, Text
```

- **ID** — anything unique (the pipeline generates one). Leave blank and `Student+Date+Time`
  is used instead. Duplicate IDs: the first row wins, later ones are ignored.
- **Student** — must match a name in `students.csv` (case-insensitive). Rows with unknown
  names are not shown — the archive footer lists them so mistakes are visible, not silent.
- **Date** — `YYYY-MM-DD`. Places the work in its student's thread and week band. Impossible
  dates (e.g. `2026-02-31`) cause the row to be skipped.
- **Time** — optional, 24 h. `17:15`, `9:05`, and `09:05:30` are all accepted; blank means `12:00`.
- **Kind** — free label shown on the card (`note`, `sketch`, `reference`, `field note`, `project`…).
- **Type** — `image`, `text`, `video`, `audio`, or `pdf`. All five render in both views:
  images open in an in-site viewer (no jump to Drive), video/audio play embedded, and PDFs
  open in an in-site reader as a vertical chain of pages.
- **Image** — where the attached file lives. Any of these work:
  - a repo path, e.g. `uploads/kabir-model-02.jpg`
  - a **Google Drive link** (what the form pipeline writes) — shown inline; for `video`/`audio`
    the Drive player is embedded. **The Drive file must be shared "Anyone with the link — Viewer"**
    or visitors will get a fallback link instead of the picture; the pipeline script sets this
    automatically on upload.
  - a YouTube or Vimeo link (embedded player), or any direct file URL.
  - Leave blank for a text-only submission.
- **Text** — the caption / body text. Always displayed as plain text — HTML in a caption shows
  up as typed characters, it is never executed.

Commas or quotes inside a cell: wrap the cell in quotes — every spreadsheet app does this for
you automatically. Line endings (Windows/Mac/Excel/Sheets) don't matter; all are handled.

## Editing directly on GitHub

Open either file in the repo on github.com, click the pencil icon — GitHub shows a
spreadsheet-style editor — change rows, commit. The live site reflects it within a minute or so.

## Student portraits (optional)

The archive shows each student as a tile. The tile's image is chosen in this order:

1. `uploads/portraits/<slug>.jpg` — a portrait, if you add one. The slug is the name,
   lower-case, accents stripped, spaces → hyphens: *Kiara* → `kiara.jpg`,
   *Zoë O'Brien* → `zo-o-brien.jpg`.
2. Otherwise, the student's most recent image submission.
3. Otherwise, their real constellation — one dot per submission in their thread colour.

## Adding images by hand

Drop files into `uploads/` (e.g. `uploads/kabir-model-02.jpg`), reference that path in the
row's `Image` column, commit both together.
