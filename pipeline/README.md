# The submission pipeline — Google Form → GitHub → the live site

How a student's work travels, end to end:

```
student fills the Google Form
        │  (name, kind, type, file upload, caption)
        ▼
Google Sheet row  +  uploaded file in Google Drive
        │
        ▼  onFormSubmit trigger
Apps Script (apps-script-reference.gs, lives in the Sheet — NOT in this repo)
        │  1. makes the uploaded Drive file public ("anyone with the link — viewer")
        │  2. builds one CSV row in the exact schema below
        │  3. commits it to data/submissions.csv via the GitHub API
        ▼
GitHub Pages republishes (≈1 min) → both views show the new work automatically
```

The site itself is completely passive: it just reads `data/submissions.csv`. Everything
active happens in the Apps Script attached to the form's response Sheet.

## The contract the script must honour

1. **Exact column schema, in this order:**
   `ID,Student,Date,Time,Kind,Type,Image,Text`
2. **Student names must match `data/students.csv` exactly.** Make the form's name question a
   **dropdown** with the same names as the roster — never a free-text field — or typos will
   produce rows the site refuses to display. When the roster changes, update the dropdown.
3. **Uploaded Drive files must be shared "Anyone with the link — Viewer"**, otherwise
   visitors see a fallback link instead of the image/player. The reference script does this
   with `file.setSharing(...)` on every upload.
4. **CSV-quote any cell** that contains commas, quotes, or line breaks (the reference
   script's `csvCell()` does this correctly, including doubled quotes).

`apps-script-reference.gs` in this folder is a complete, working implementation of that
contract, commented line by line. If your current script already works, keep it — but compare
it against the reference for the four points above, especially the sharing step (point 3):
without it, images upload fine but won't display for anyone but you.

## Setting it up from scratch (≈10 minutes)

1. **Form** — questions, mapped by the script:
   - *Name* — dropdown, one option per roster name
   - *Kind* — dropdown or short text (`note`, `sketch`, `reference`, `field note`, `project`…)
   - *Type* — dropdown: `image`, `text`, `video`, `audio`
   - *Upload* — File upload question (optional), allow images/video/audio
   - *Caption* — paragraph text
2. **Sheet** — in the Form: Responses → link to a Sheet.
3. **Script** — in the Sheet: Extensions → Apps Script → paste `apps-script-reference.gs`,
   then edit the `FORM_FIELDS` mapping at the top so each entry matches your question titles
   exactly.
4. **Token** — GitHub → Settings → Developer settings → Fine-grained personal access token:
   repository `khapewie/M26_STUDIO` only, permission **Contents: Read & write**, nothing else.
   In Apps Script: Project Settings → Script Properties → add `GITHUB_TOKEN` = the token.
   (A script property is the right place — never paste the token into the code itself.)
5. **Trigger** — in Apps Script: Triggers → Add trigger → function `onFormSubmit`,
   event source *From spreadsheet*, event type *On form submit*.
6. **Test** — submit the form once; within a minute the commit appears in the repo and the
   dot appears on the live site.

## The discourse backend (persistent comments)

The site's discourse panel (comments on each submission in the 3D view) saves to a
**"Comments" sheet in the same spreadsheet**, through the `doGet`/`doPost` functions at the
bottom of `apps-script-reference.gs`. No accounts: each visitor's browser keeps a random
secret; the sheet stores only a hash of it, and only the matching secret can delete a comment.

To turn it on (≈3 minutes, one time):

1. Make sure the discourse functions from `apps-script-reference.gs` are in your Apps Script
   project (everything below "THE DISCOURSE BACKEND").
2. Deploy → **New deployment** → type **Web app** → *Execute as:* **Me** →
   *Who has access:* **Anyone** → Deploy. Copy the URL ending in `/exec`.
3. Paste that URL into `js/m26-core.js` → `CONFIG.discourseUrl` and commit.

Until step 3 is done the site says "discourse not connected yet" and refuses to pretend —
nothing is stored locally-only.

Moderation: you own the spreadsheet — deleting a row in the Comments sheet deletes the
comment for everyone. If a deployment URL ever leaks spam, re-deploy (new URL) and update
`discourseUrl`.

## Failure behaviour worth knowing

- If two submissions land in the same second, GitHub can reject the second commit (the file
  changed underneath it). The reference script retries once with fresh contents; on repeated
  failure it emails you (the Sheet owner) so nothing disappears silently — the response is
  still safe in the Sheet either way.
- The Sheet remains the permanent backup of every submission. If a commit ever fails, the row
  can be re-sent by re-running `onFormSubmit` for that response, or added by hand.
