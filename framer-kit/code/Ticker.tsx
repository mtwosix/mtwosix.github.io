// M26 — the ticker of the present tense, as a Framer code component.
// Reads the live submissions feed (JSON) and marquees the latest entries.
// Point "Feed URL" at your Apps Script web app (see apps-script-live-feed.gs)
// or leave it empty to show the fallback line. Honest empty states: if the
// feed is empty, the strip says so — it never invents content.

import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

type Row = { student: string; kind: string; date: string; week?: number }

export default function Ticker(props: {
    feedUrl: string
    fallback: string
    speed: number
}) {
    const [rows, setRows] = React.useState<Row[] | null>(null)

    React.useEffect(() => {
        let dead = false
        if (!props.feedUrl) return
        fetch(props.feedUrl)
            .then((r) => (r.ok ? r.json() : null))
            .then((j) => {
                if (dead || !j) return
                const list = Array.isArray(j) ? j : j.submissions
                if (Array.isArray(list)) setRows(list.slice(0, 14))
            })
            .catch(() => {})
        return () => {
            dead = true
        }
    }, [props.feedUrl])

    const text =
        rows && rows.length
            ? rows
                  .map(
                      (r) =>
                          `${(r.student || "").toUpperCase()} · ${r.kind || ""} · ${r.date || ""}` +
                          (r.week ? ` · W${r.week}` : "")
                  )
                  .join("      ///      ")
            : props.fallback

    const track: React.CSSProperties = {
        display: "inline-block",
        whiteSpace: "nowrap",
        paddingRight: 64,
        animation: `m26marq ${props.speed}s linear infinite`,
        font: "400 10px 'IBM Plex Mono', ui-monospace, monospace",
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: "#1d1b17",
    }

    return (
        <div style={{ overflow: "hidden", width: "100%", height: "100%", display: "flex", alignItems: "center" }}>
            <style>{`@keyframes m26marq { from { transform: translateX(0) } to { transform: translateX(-50%) } }
              @media (prefers-reduced-motion: reduce) { div[data-m26tick] * { animation: none !important } }`}</style>
            <div data-m26tick style={{ whiteSpace: "nowrap" }}>
                <span style={track}>{text}</span>
                <span style={track} aria-hidden>
                    {text}
                </span>
            </div>
        </div>
    )
}

Ticker.defaultProps = {
    feedUrl: "",
    fallback: "M26 STUDIO · CEPT · 2026 — THE ARCHIVE IS LIVE",
    speed: 40,
}

addPropertyControls(Ticker, {
    feedUrl: { type: ControlType.String, title: "Feed URL" },
    fallback: { type: ControlType.String, title: "Fallback text" },
    speed: { type: ControlType.Number, title: "Loop (s)", min: 10, max: 150 },
})
