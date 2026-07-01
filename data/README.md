# Publishing new submissions & managing the roster

Two CSV files run the whole thing. CSV opens directly in Excel, Numbers, or Google Sheets (just
double-click / "Open with" — no import step), and GitHub itself renders and edits CSV as a table
in the browser. Edit either file, save/commit, and the live site picks up the change on its own
(checked on load and every 15s while a visitor has the page open) — nothing needs to be regenerated
or sent to anyone.

## `students.csv`

One column, one name per row:

```
Name
Aarav
Diya
...
```

Add a row for a new student, delete a row to remove one, edit a cell to rename someone. The point
cloud's colour wheel and every student's thread regenerates around whatever names are here.

## `submissions.csv`

One row per real submission, columns: `ID, Student, Date, Time, Kind, Type, Image, Text`.

- **ID** — anything unique (e.g. `ananya-2026-11-19-a`). Leave blank and `Student+Date+Time` is
  used instead.
- **Student** — must match a name in `students.csv` exactly (case-insensitive). Unknown names are
  skipped.
- **Date** — `YYYY-MM-DD`. Places the dot along that student's thread (and in the shared week band
  with everyone else's work from the same week). Dates can extend past the current span — the
  cloud keeps growing.
- **Time** — optional, `HH:MM`, 24h, defaults to `12:00`.
- **Kind** — free text label shown on the dot's card (e.g. `note`, `sketch`, `reference`,
  `field note`, `project`).
- **Type** — `image`, `text`, `video`, or `audio`. Only `image` actually renders a picture right
  now (`video`/`audio` show as a plain caption box — ask if you want those wired up too).
- **Image** — relative path to the file, e.g. `uploads/ananya-sketch-01.jpg`. Leave blank for a
  text-only submission.
- **Text** — the caption / body text shown in the expanded panel.

If a cell needs a comma or a quote inside it, just wrap the whole cell in quotes — every spreadsheet
app does this for you automatically when you type a comma into a cell; you don't need to think
about it.

Reload the page (or wait ~15s) and the new dot appears in its student's colour, in the right week
band, with a brief pulsing ring so it reads as freshly arrived.

## Editing directly on GitHub (no local software needed)

Open `data/students.csv` or `data/submissions.csv` in the repo on github.com, click the pencil
(Edit) icon — GitHub shows a spreadsheet-style table editor for CSV — add/edit/delete rows, and
commit. GitHub Pages rebuilds automatically within about a minute and the live site reflects it.
This is the most direct path: no Excel, no re-export, no sending anything to anyone.

## Adding images

Drop new image files into `uploads/` (any name, e.g. `uploads/kabir-model-02.jpg`), reference that
path in a submission row's `Image` column, commit both together.
