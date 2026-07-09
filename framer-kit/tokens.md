# M26 design tokens — set these up first in Framer

Create these as **Color Styles** and **Text Styles** (Assets panel) before
building anything, so every layer points at a token, not a hex value.

## Colours

| Style name | Value | Use |
|---|---|---|
| Paper | `#F3F1EA` | page background, panels |
| Paper 2 | `#ECE9E0` | hover fills, cards |
| Paper 3 | `#E6E2D6` | media placeholders |
| Ink | `#1D1B17` | text, rules, solid buttons |
| Ink 60 | `#6C685F` | secondary text, mono labels |
| Ink 40 | `#9A958C` | tertiary, arrows |
| Rust | `#8A5A34` | the one accent: numbers, hovers, links |
| Night | `#06060C` | (legacy — barely used now; keep for the grain/edges if wanted) |

Hairlines: Ink at 26% (`rgba(29,27,23,.26)`) and 13% for the soft grid.
Dashed borders = "provisional" (notes, sample data, make-chips): Ink at 38–50%, dashed.

## Type (Google Fonts — all available in Framer natively)

| Style | Font | Sample use |
|---|---|---|
| Display | **Archivo** 800/900, uppercase, letter-spacing −2…−3%, line 0.9–1.0 | panel titles, the big wordmark |
| Display-italic accent | **Spectral** 300 italic | the second word of titles ("The *Studio*"), pull quotes |
| Body | **Archivo** 400, 14–15px, line 1.6–1.75 | prose |
| Serif lede | **Spectral** 300 (italic for emphasis), 16–20px | ledes, bios, empty states |
| Mono label | **IBM Plex Mono** 700, 9–10px, letter-spacing 0.2–0.3em, uppercase | kickers, table labels, meta |
| Mono data | **Space Mono** 400/700 | numbers, timestamps |

## The moves that make it feel like the site

- Solid 1px Ink rules for structure; **2px Ink** for panel heads and emphasis.
- Numbered sections: rust mono number (`01·A`) + uppercase Archivo heading, ruled below.
- Ruled tables (AA-style): label column in mono caps Ink-60, value in Archivo 400.
- Ghost numerals: giant Archivo 900 outline (1px Ink at ~13%) behind panel content.
- Film grain overlay at ~7–16% multiply over everything (Framer: an image layer
  with an SVG noise tile, or skip — it's a garnish).
- Motion: slow. 0.6–0.65s panel slides, cubic-bezier(.7,0,.18,1); content rises
  ~18px with 0.1s stagger. Respect reduced motion.
