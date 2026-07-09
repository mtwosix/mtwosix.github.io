// M26 — the living canvas, embedded in Framer.
// Paste into Framer: Assets → Code → New file → replace contents.
// Drop the component on your page and size it to fill the middle region.
// The canvas itself keeps living on GitHub Pages (the form → sheet → CSV
// pipeline feeds it there); Framer only frames it.

import { addPropertyControls, ControlType } from "framer"

export default function CanvasEmbed(props: { url: string; sandbox: boolean }) {
    const src =
        props.url + "?embed" + (props.sandbox ? "&sandbox" : "")
    return (
        <iframe
            src={src}
            title="The living canvas — every submission a point, every student a thread"
            allow="autoplay"
            style={{
                width: "100%",
                height: "100%",
                border: 0,
                display: "block",
                background: "#f3f1ea",
            }}
        />
    )
}

CanvasEmbed.defaultProps = {
    url: "https://mtwosix.github.io/canvas.html",
    sandbox: false,
}

addPropertyControls(CanvasEmbed, {
    url: { type: ControlType.String, title: "Canvas URL" },
    sandbox: { type: ControlType.Boolean, title: "Sandbox data" },
})
