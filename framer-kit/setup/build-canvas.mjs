/* ============================================================================
   M26 → Framer — canvas build  (framer-kit/setup/build-canvas.mjs)

   Reshapes the project to the requested division of labour:

     CMS        = only what keeps changing (Submissions). The People and
                  Students collections are REMOVED — the humans are static
                  site content now, living on the canvas.
     Canvas     = the whole page structure, built as native editable frames
                  and text: top strip, hero, an EMPTY middle region (the old
                  point cloud is deleted — that space is yours), the studio
                  section, the people section (photos placed), the work
                  section (with a labelled slot where a Collection List gets
                  bound to Submissions), footer.
     Code       = CanvasEmbed.tsx removed. Ticker.tsx stays (an instance is
                  placed in the top strip when the API allows).

   Also creates the M26 colour styles and text styles so restyling is a
   matter of editing styles, not hunting layers.

   Run (same env vars as setup.mjs):
     FRAMER_PROJECT_URL=… FRAMER_API_KEY=… node build-canvas.mjs

   Idempotent: frames named "M26 / …" are removed and rebuilt each run;
   styles and collections are matched by name.
   ============================================================================ */

const PROJECT = process.env.FRAMER_PROJECT_URL
const KEY = process.env.FRAMER_API_KEY
if (!PROJECT || !KEY) { console.error("Set FRAMER_PROJECT_URL and FRAMER_API_KEY."); process.exit(1) }

const report = []
const ok = (m) => { report.push(["✓", m]); console.log("✓", m) }
const skip = (m) => { report.push(["–", m]); console.log("–", m) }
const bad = (m, e) => { report.push(["✗", `${m} — ${(e && e.message) || e}`]); console.error("✗", m, "\n   ", (e && e.message) || e) }

const { connect } = await import("framer-api")
const framer = await connect(PROJECT, KEY)
console.log("Connected.\n")

/* ---------------------------------------------------------------- helpers */

async function tryAttrs(node, attrsList) {
  // apply the first attribute set that the API accepts
  for (const attrs of attrsList) {
    try { await node.setAttributes(attrs); return true } catch (e) { /* next */ }
  }
  return false
}

let knownText = new Set()
async function snapshotText() {
  knownText = new Set((await framer.getNodesWithType("TextNode")).map((n) => n.id))
}
async function addStyledText(parentId, str, { tag = "p", style = null, width = null, color = null } = {}) {
  await framer.addText(str, { tag })
  const all = await framer.getNodesWithType("TextNode")
  const fresh = all.filter((n) => !knownText.has(n.id))
  for (const n of fresh) knownText.add(n.id)
  const node = fresh[fresh.length - 1]
  if (!node) throw new Error("text node not found after addText")
  await framer.setParent(node.id, parentId)
  const attrs = {}
  if (style) attrs.inlineTextStyle = style
  if (width) attrs.width = width
  try { if (Object.keys(attrs).length) await node.setAttributes(attrs) } catch (e) {
    if (style) { try { await node.setAttributes({ inlineTextStyle: style }) } catch {} }
  }
  if (color) { try { await node.setAttributes({ color }) } catch {} }
  return node
}

async function frame(parentId, name, attrsList) {
  const node = await framer.createFrameNode({ name }, parentId ?? undefined)
  if (!node) throw new Error("createFrameNode returned null for " + name)
  if (attrsList?.length) await tryAttrs(node, attrsList)
  return node
}

const stack = (extra = {}) => ({
  layout: "stack",
  stackDirection: "vertical",
  stackDistribution: "start",
  stackAlignment: "start",
  gap: "16px",
  padding: "0px",
  backgroundColor: null,
  ...extra,
})

/* ---------------------------------------------------------------- content */

const INK = "rgb(29, 27, 23)", PAPER = "rgb(243, 241, 234)", RUST = "rgb(138, 90, 52)",
      INK60 = "rgb(108, 104, 95)", PAPER2 = "rgb(236, 233, 224)"

const PEOPLE = [
  ["Studio leads", [
    ["Alifiya Mutaher", "Cofounder, Lagori Collective", "alifiya-mutaher.jpg"],
    ["Dhaval Kothari", "Cofounder, Lagori Collective", "dhaval-kothari.jpg"],
    ["Ankita Trivedi", "Senior Assistant Professor, CEPT", "ankita-trivedi.jpg"],
  ]],
  ["Guest lecturers", [
    ["Anna Biswas", "Managing Director – India, Forum for the Future", "anna-biswas.jpg"],
    ["Vishwanath S", "Director, Biome Environmental Solutions", "vishwanath-s.jpg"],
    ["Reema Deshpande", "Cofounder, Lagori Collective", "reema-deshpande.jpg"],
    ["Ishita Jain", "Cofounder, LMNO", "ishita-jain.jpg"],
  ]],
]
const IMG = (f) => "https://mtwosix.github.io/uploads/people/" + f

try {
  /* ---- 0 · reshape CMS + code ---- */
  try {
    const cols = await framer.getCollections()
    for (const name of ["People", "Students"]) {
      const c = cols.find((x) => x.name === name)
      if (c) { await c.remove(); ok(`Collection removed: ${name} (static content now — lives on the canvas)`) }
      else skip(`Collection already gone: ${name}`)
    }
  } catch (e) { bad("collection cleanup", e) }

  try {
    const files = await framer.getCodeFiles()
    const ce = files.find((f) => /CanvasEmbed/i.test(f.name))
    if (ce) { await ce.remove(); ok("Code removed: CanvasEmbed.tsx (the middle is yours)") }
    else skip("CanvasEmbed already gone")
  } catch (e) { bad("code cleanup", e) }

  /* ---- 1 · styles ---- */
  const colorStyles = {}
  try {
    const existing = await framer.getColorStyles()
    const wanted = [["M26/Paper", PAPER], ["M26/Paper 2", PAPER2], ["M26/Ink", INK], ["M26/Ink 60", INK60], ["M26/Rust", RUST]]
    for (const [name, light] of wanted) {
      let s = existing.find((x) => x.name === name)
      if (!s) s = await framer.createColorStyle({ name, light })
      colorStyles[name] = s
    }
    ok("Colour styles: " + wanted.map(([n]) => n.split("/")[1]).join(", "))
  } catch (e) { bad("colour styles", e) }

  const ts = {}
  try {
    const fontArchivo = await framer.getFont("Archivo").catch(() => null)
    const fontSpectral = await framer.getFont("Spectral").catch(() => null)
    const fontPlex = await framer.getFont("IBM Plex Mono").catch(() => null)
    const existing = await framer.getTextStyles()
    const mk = async (name, def) => {
      let s = existing.find((x) => x.name === name)
      if (!s) s = await framer.createTextStyle({ name, ...def })
      return s
    }
    ts.display = await mk("M26/Display", { tag: "h1", fontSize: "120px", lineHeight: "0.9em", letterSpacing: "-0.03em", textTransform: "uppercase", color: INK, ...(fontArchivo ? { font: fontArchivo } : {}) })
    ts.h2 = await mk("M26/Section Title", { tag: "h2", fontSize: "44px", lineHeight: "1em", letterSpacing: "-0.01em", textTransform: "uppercase", color: INK, ...(fontArchivo ? { font: fontArchivo } : {}) })
    ts.lede = await mk("M26/Lede Serif", { tag: "p", fontSize: "26px", lineHeight: "1.4em", color: INK, ...(fontSpectral ? { font: fontSpectral } : {}) })
    ts.body = await mk("M26/Body", { tag: "p", fontSize: "15px", lineHeight: "1.7em", color: INK, ...(fontArchivo ? { font: fontArchivo } : {}) })
    ts.label = await mk("M26/Mono Label", { tag: "p", fontSize: "11px", lineHeight: "1.4em", letterSpacing: "0.25em", textTransform: "uppercase", color: INK60, ...(fontPlex ? { font: fontPlex } : {}) })
    ok("Text styles: Display, Section Title, Lede Serif, Body, Mono Label")
  } catch (e) { bad("text styles", e) }

  /* ---- 2 · find the home page + clean previous runs ---- */
  const pages = await framer.getNodesWithType("WebPageNode")
  const home = pages.find((p) => !p.path || p.path === "/" || p.path === "") ?? pages[0]
  if (!home) throw new Error("No web page found in project")
  ok(`Page: ${home.path || "/"}`)

  let rootId = home.id
  try {
    const kids = await framer.getChildren(home.id)
    const prev = kids.filter((k) => (k.name || "").startsWith("M26 /"))
    for (const p of prev) await p.remove()
    if (prev.length) ok(`Cleared ${prev.length} previous M26 frames`)
    const container = kids.find((k) => !(k.name || "").startsWith("M26 /") && k.__class === "FrameNode")
    if (container) rootId = container.id
  } catch (e) { skip("child scan: " + ((e && e.message) || e)) }

  await snapshotText()

  const W = [{ width: "1fr" }, { width: "100%" }, { width: "1200px" }]
  const sectionAttrs = (extra = {}) => [
    { ...stack({ padding: "48px 40px 48px 40px", ...extra }), width: "1fr" },
    { ...stack({ padding: "48px 40px 48px 40px", ...extra }), width: "1200px" },
    stack(extra),
  ]

  /* ---- 3 · top strip ---- */
  const top = await frame(rootId, "M26 / Top strip", [
    { ...stack({ stackDirection: "horizontal", stackDistribution: "space-between", stackAlignment: "center", gap: "24px", padding: "18px 40px 18px 40px", backgroundColor: PAPER }), width: "1fr", height: "64px" },
    stack({ stackDirection: "horizontal", stackDistribution: "space-between", stackAlignment: "center", gap: "24px", padding: "18px 40px 18px 40px" }),
  ])
  await addStyledText(top.id, "M26 STUDIO", { style: ts.label, color: INK })
  await addStyledText(top.id, "IMAGINATION INFRASTRUCTURE · CEPT · 2026", { style: ts.label })
  await addStyledText(top.id, "WK 01 / 18", { style: ts.label })
  const submit = await addStyledText(top.id, "SUBMIT ↗", { style: ts.label, color: RUST })
  try { await submit.setAttributes({ link: "https://docs.google.com/forms/" }) } catch {}
  ok("Top strip")

  /* ---- ticker instance, when the component URL is discoverable ---- */
  try {
    const files = await framer.getCodeFiles()
    const tickerFile = files.find((f) => /Ticker/i.test(f.name))
    const exp = tickerFile?.exports?.find((x) => x.url)
    if (exp?.url) {
      const inst = await framer.addComponentInstance({ url: exp.url, parentId: top.id })
      if (inst) await tryAttrs(inst, [{ width: "1fr", height: "40px" }, {}])
      ok("Ticker instance placed in the top strip")
    } else skip("Ticker export URL not found — drag it in from Assets → Code when wanted")
  } catch (e) { skip("Ticker instance: " + ((e && e.message) || e)) }

  /* ---- 4 · hero ---- */
  const hero = await frame(rootId, "M26 / Hero", sectionAttrs({ gap: "8px", padding: "96px 40px 72px 40px", backgroundColor: PAPER }))
  await addStyledText(hero.id, "IMAGINATION", { tag: "h1", style: ts.display })
  await addStyledText(hero.id, "INFRASTRUCTURE", { tag: "h1", style: ts.display })
  await addStyledText(hero.id, "A design studio at CEPT for futures thinking & systems design — run as a living archive.", { style: ts.lede })
  ok("Hero")

  /* ---- 5 · the middle — deliberately empty ---- */
  const mid = await frame(rootId, "M26 / The Middle — yours", [
    { ...stack({ stackDistribution: "center", stackAlignment: "center", padding: "0px", backgroundColor: PAPER2 }), width: "1fr", height: "820px" },
    stack({ stackDistribution: "center", stackAlignment: "center" }),
  ])
  await addStyledText(mid.id, "( the middle — an empty stage, build the new thing here )", { style: ts.label })
  ok("The middle: empty stage placed (the point cloud is gone)")

  /* ---- 6 · studio ---- */
  const st = await frame(rootId, "M26 / Studio", sectionAttrs({ gap: "28px", backgroundColor: PAPER }))
  await addStyledText(st.id, "01 — THE STUDIO", { style: ts.label, color: RUST })
  await addStyledText(st.id, "The Studio", { tag: "h2", style: ts.h2 })
  await addStyledText(st.id, "The set of conditions that allow collective imagination to arise, stay, and return.", { style: ts.lede })
  await addStyledText(st.id,
    "A good workshop can get a room imagining its future in one morning. The hard part is making that imagination stay — it gets written up, summarised, carried away, and the people who did the imagining are left to start from scratch next time. This studio is about building what's missing: the rhythms, spaces, rituals and archives that let imagination stick around and grow where it was made.",
    { style: ts.body })

  const facts = [
    ["TAUGHT BY", "Alifiya Mutaher & Dhaval Kothari, cofounders of Lagori Collective, with Ankita Trivedi, CEPT"],
    ["WHERE", "An L3 studio at CEPT University — in person, online, and in the field"],
    ["WHEN", "Mon, Thu & Fri · 10.30am – 1.30pm IST · 18 weeks"],
    ["FIELD TRIP", "Four days in Bengaluru with Biome Environmental Trust, around urban water"],
    ["GUESTS", "Practitioners across design, urban systems and community work"],
  ]
  for (const [k, v] of facts) {
    const row = await frame(st.id, "M26 / fact — " + k, [
      { ...stack({ stackDirection: "horizontal", gap: "24px", padding: "12px 0px 12px 0px" }), width: "1fr" },
      stack({ stackDirection: "horizontal", gap: "24px" }),
    ])
    const kn = await addStyledText(row.id, k, { style: ts.label })
    await tryAttrs(kn, [{ width: "160px" }, {}])
    await addStyledText(row.id, v, { style: ts.body })
  }

  await addStyledText(st.id, "WHAT WE'RE ASKING", { style: ts.label, color: RUST })
  for (const q of [
    "How do people begin to imagine together?",
    "Where are futures already being rehearsed in South Asian cities?",
    "What does collective imagination need to become durable?",
    "What could help future imaginaries gather force over time?",
  ]) await addStyledText(st.id, q, { style: ts.lede })

  await addStyledText(st.id, "THE SEMESTER", { style: ts.label, color: RUST })
  const steps = [
    ["01", "Mapping systems", "Frame an inquiry inside a city's tangled systems."],
    ["02", "Field research", "Go to Bengaluru. Watch, ask, listen."],
    ["03", "Synthesis", "Find the conditions that let futures happen."],
    ["04", "Designing interventions", "Turn what you found into things that keep imagination alive."],
    ["05", "Prototypes", "Build them — tools, artefacts, rituals, platforms."],
    ["06", "Share", "Put it in front of people."],
  ]
  for (const [n, t, d] of steps) {
    const row = await frame(st.id, "M26 / step — " + n, [
      { ...stack({ stackDirection: "horizontal", gap: "20px", padding: "10px 0px 10px 0px" }), width: "1fr" },
      stack({ stackDirection: "horizontal", gap: "20px" }),
    ])
    const nn = await addStyledText(row.id, n, { style: ts.label, color: RUST })
    await tryAttrs(nn, [{ width: "40px" }, {}])
    const tn = await addStyledText(row.id, t.toUpperCase(), { style: ts.body })
    await tryAttrs(tn, [{ width: "240px" }, {}])
    await addStyledText(row.id, d, { style: ts.body, color: INK60 })
  }
  await addStyledText(st.id, "WHAT YOU'LL MAKE — PARTICIPATORY TOOLS · SPECULATIVE ARTEFACTS · RITUALS · GAMES · DIGITAL PLATFORMS · GOVERNANCE MODELS", { style: ts.label })
  ok("Studio section")

  /* ---- 7 · people (static now, as requested) ---- */
  const pe = await frame(rootId, "M26 / People", sectionAttrs({ gap: "24px", backgroundColor: PAPER }))
  await addStyledText(pe.id, "02 — THE PEOPLE", { style: ts.label, color: RUST })
  await addStyledText(pe.id, "The People", { tag: "h2", style: ts.h2 })
  for (const [group, members] of PEOPLE) {
    await addStyledText(pe.id, group.toUpperCase(), { style: ts.label })
    const row = await frame(pe.id, "M26 / people — " + group, [
      { ...stack({ stackDirection: "horizontal", gap: "20px", stackWrapEnabled: true }), width: "1fr" },
      stack({ stackDirection: "horizontal", gap: "20px" }),
    ])
    for (const [name, role, img] of members) {
      const card = await frame(row.id, "M26 / person — " + name, [
        { ...stack({ gap: "10px", padding: "0px" }), width: "220px" },
        stack({ gap: "10px" }),
      ])
      const photo = await frame(card.id, "photo — " + name, [
        { width: "220px", height: "275px", backgroundColor: PAPER2 },
        {},
      ])
      try {
        await photo.setAttributes({ backgroundImage: { url: IMG(img) } })
      } catch {
        try {
          const asset = await framer.uploadImage({ image: { type: "url", url: IMG(img) } })
          await photo.setAttributes({ backgroundImage: asset })
        } catch (e) { skip(`photo for ${name}: set by hand (drag from ${IMG(img)})`) }
      }
      await addStyledText(card.id, name.toUpperCase(), { style: ts.body })
      await addStyledText(card.id, role, { style: ts.label })
    }
  }
  ok("People section (static)")

  /* ---- 8 · work ---- */
  const wk = await frame(rootId, "M26 / Work", sectionAttrs({ gap: "20px", backgroundColor: PAPER }))
  await addStyledText(wk.id, "03 — THE WORK", { style: ts.label, color: RUST })
  await addStyledText(wk.id, "The Work", { tag: "h2", style: ts.h2 })
  await addStyledText(wk.id, "Every submission, in the order it arrived — nothing curated away.", { style: ts.lede })
  const slot = await frame(wk.id, "M26 / Work — BIND A COLLECTION LIST HERE", [
    { ...stack({ stackDistribution: "center", stackAlignment: "center", padding: "60px 20px 60px 20px", backgroundColor: PAPER2 }), width: "1fr", height: "360px" },
    stack({ stackDistribution: "center", stackAlignment: "center" }),
  ])
  await addStyledText(slot.id, "INSERT → CMS → COLLECTION LIST, BIND TO “SUBMISSIONS”, THEN DELETE THIS FRAME", { style: ts.label })
  ok("Work section (with the Collection List slot labelled)")

  /* ---- 9 · footer ---- */
  const ft = await frame(rootId, "M26 / Footer", sectionAttrs({ gap: "14px", backgroundColor: INK, padding: "72px 40px 48px 40px" }))
  const fw = await addStyledText(ft.id, "M26 STUDIO", { tag: "h2", style: ts.display })
  try { await fw.setAttributes({ color: PAPER }) } catch {}
  const fl = await addStyledText(ft.id, "M26 STUDIO · CEPT UNIVERSITY · 2026 — THE RECORD IS A STRICT 1:1 MIRROR OF SUBMISSIONS.CSV", { style: ts.label })
  try { await fl.setAttributes({ color: "rgb(154, 149, 140)" }) } catch {}
  ok("Footer")
} catch (e) {
  bad("build", e)
} finally {
  await framer.disconnect()
}

console.log("\n──── summary ────")
for (const [s, m] of report) console.log(s, m)
