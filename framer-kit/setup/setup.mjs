/* ============================================================================
   M26 → Framer — one-shot project setup  (framer-kit/setup/setup.mjs)

   Connects to a Framer project through the official Server API (open beta)
   and builds the working base:
     · three CMS collections — People / Students / Submissions — with fields
       and the real data from ../cms (sample files are NOT imported)
     · the two code components from ../code (CanvasEmbed, Ticker)
     · a preview publish at the end so there's a link to look at

   Run:
     cd framer-kit/setup
     npm install
     FRAMER_PROJECT_URL="https://framer.com/projects/<id>" \
     FRAMER_API_KEY="<key from Site Settings → General>" \
     npm run setup

   Written against framer-api's typed surface: createCollection(name),
   collection.addFields(CreateField[]), collection.addItems([{ slug,
   fieldData: { [fieldId]: { type, value } } }]), createCodeFile(name, code),
   publish(). Safe to re-run — collections, fields, items and code files are
   matched by name/slug and updated instead of duplicated.
   ============================================================================ */

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const here = dirname(fileURLToPath(import.meta.url))
const PROJECT = process.env.FRAMER_PROJECT_URL
const KEY = process.env.FRAMER_API_KEY

if (!PROJECT || !KEY) {
  console.error("Set FRAMER_PROJECT_URL and FRAMER_API_KEY. See the header comment.")
  process.exit(1)
}

/* ---------------------------------------------------------------- helpers */

function parseCsv(text) {
  const rows = []
  let row = [], cell = "", q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') q = false
      else cell += c
    } else if (c === '"') q = true
    else if (c === ",") { row.push(cell); cell = "" }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++
      row.push(cell); cell = ""
      if (row.length > 1 || row[0] !== "") rows.push(row)
      row = []
    } else cell += c
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row) }
  const head = rows.shift()
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])))
}

const csv = (name) => parseCsv(readFileSync(join(here, "..", "cms", name), "utf8"))
const code = (name) => readFileSync(join(here, "..", "code", name), "utf8")

const report = []
const ok = (m) => { report.push(["✓", m]); console.log("✓", m) }
const skip = (m) => { report.push(["–", m]); console.log("–", m) }
const bad = (m, e) => { report.push(["✗", `${m} — ${(e && e.message) || e}`]); console.error("✗", m, "\n   ", (e && e.message) || e) }

/* value → typed fieldData entry, by field type */
function typedValue(field, raw) {
  const v = String(raw ?? "").trim()
  if (!v) return undefined
  switch (field.type) {
    case "string": return { type: "string", value: v }
    case "formattedText": return { type: "formattedText", value: v }
    case "link": return { type: "link", value: v }
    case "image": return { type: "image", value: v }
    case "date": return { type: "date", value: v }
    case "number": return { type: "number", value: Number(v) }
    case "enum": {
      const c = (field.cases || []).find((x) => x.name === v)
      return c ? { type: "enum", value: c.id ?? c.name } : { type: "enum", value: v }
    }
    default: return { type: "string", value: v }
  }
}

/* ------------------------------------------------------------- the plan */

const COLLECTIONS = [
  {
    name: "People",
    fields: [
      { type: "string", name: "Role" },
      { type: "enum", name: "Group", cases: [{ name: "Studio lead" }, { name: "Guest lecturer" }] },
      { type: "image", name: "Photo" },
    ],
    csv: "people.csv",
    map: (r) => ({ Role: r.Role, Group: r.Group, Photo: r.Photo }),
  },
  {
    name: "Students",
    fields: [
      { type: "formattedText", name: "Bio" },
      { type: "string", name: "Role" },
      { type: "image", name: "Photo" },
      { type: "link", name: "Instagram" },
      { type: "link", name: "Website" },
      { type: "string", name: "Email" },
    ],
    csv: "students.csv",
    map: (r) => ({ Bio: r.Bio, Role: r.Role, Photo: r.Photo, Instagram: r.Instagram, Website: r.Website, Email: r.Email }),
  },
  {
    name: "Submissions",
    fields: [
      { type: "string", name: "Student" },
      { type: "date", name: "Date" },
      { type: "string", name: "Time" },
      { type: "string", name: "Kind" },
      { type: "enum", name: "Type", cases: [{ name: "image" }, { name: "video" }, { name: "audio" }, { name: "pdf" }, { name: "text" }, { name: "link" }] },
      { type: "link", name: "Media" },
      { type: "formattedText", name: "Text" },
    ],
    csv: "submissions.csv",
    map: (r) => ({ Student: r.Student, Date: r.Date, Time: r.Time, Kind: r.Kind, Type: r.Type, Media: r.Media, Text: r.Text }),
  },
]

const CODE_FILES = ["CanvasEmbed.tsx", "Ticker.tsx"]

/* -------------------------------------------------------------- execute */

const { connect } = await import("framer-api")
const framer = await connect(PROJECT, KEY)
console.log("Connected.\n")

try {
  try {
    const info = await framer.getProjectInfo()
    ok(`Project: ${info?.name ?? "(unnamed)"}`)
  } catch { skip("getProjectInfo unavailable") }

  /* ---- CMS ---- */
  const existing = await framer.getCollections()
  const byName = new Map(existing.map((c) => [c.name, c]))

  for (const spec of COLLECTIONS) {
    try {
      let col = byName.get(spec.name)
      if (col) ok(`Collection exists: ${spec.name}`)
      else { col = await framer.createCollection(spec.name); ok(`Collection created: ${spec.name}`) }

      /* fields — add the ones that don't exist yet */
      let fields = await col.getFields()
      const have = new Set(fields.map((f) => f.name))
      const missing = spec.fields.filter((f) => !have.has(f.name))
      if (missing.length) {
        const created = await col.addFields(missing)
        fields = fields.concat(created)
        ok(`  fields +${missing.map((f) => f.name).join(", ")}`)
      } else ok("  fields all present")
      const fieldByName = new Map(fields.map((f) => [f.name, f]))

      /* items — upsert by slug, real data only */
      const rows = csv(spec.csv)
      if (!rows.length) { skip(`  ${spec.name}: 0 rows (the real record is empty — honest empty state)`); continue }
      const current = await col.getItems()
      const idBySlug = new Map(current.map((it) => [it.slug, it.id]))
      const items = rows.map((r) => {
        const fieldData = {}
        const mapped = spec.map(r)
        for (const [name, raw] of Object.entries(mapped)) {
          const f = fieldByName.get(name)
          if (!f) continue
          const tv = typedValue(f, raw)
          if (tv !== undefined) fieldData[f.id] = tv
        }
        const item = { slug: r.Slug, fieldData }
        if (r.Title && fieldByName.has("Title")) {
          const tf = fieldByName.get("Title")
          fieldData[tf.id] = { type: "string", value: r.Title }
        }
        const prev = idBySlug.get(r.Slug)
        if (prev) item.id = prev
        return item
      })
      await col.addItems(items)
      ok(`  items: ${items.length} upserted`)
    } catch (e) { bad(`Collection ${spec.name}`, e) }
  }

  /* ---- code components ---- */
  try {
    const files = await framer.getCodeFiles()
    for (const name of CODE_FILES) {
      const content = code(name)
      const prev = files.find((f) => f.name === name || f.name === name.replace(/\.tsx$/, ""))
      if (prev) { await prev.setFileContent(content); ok(`Code updated: ${name}`) }
      else { await framer.createCodeFile(name, content); ok(`Code created: ${name}`) }
    }
  } catch (e) { bad("Code files", e) }

  /* ---- publish a preview ---- */
  try {
    const dep = await framer.publish()
    ok(`Preview published: ${dep?.url ?? JSON.stringify(dep)}`)
  } catch (e) { skip(`publish: ${(e && e.message) || e}`) }
} finally {
  await framer.disconnect()
}

console.log("\n──── summary ────")
for (const [s, m] of report) console.log(s, m)
console.log("\nNext: open the project in Framer — CMS and code components are in.")
console.log("Build the pages with ../copy.md and ../tokens.md; the middle part is CanvasEmbed.")
