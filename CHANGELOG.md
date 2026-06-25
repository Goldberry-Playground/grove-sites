# Grove Sites — CHANGELOG

A running log of meaningful changes to the four-app monorepo. Entries are in
reverse chronological order. Each session block lists what shipped and the
follow-ups it surfaced.

## 2026-05-29 — Goldberry repositioning + cross-site polish

### Cross-site

- **Sibling-strip enlarged** on all four sites (`hub`, `goldberry`, `ggg`,
  `nursery`). Font 10 → 12 px, band padding 10 → 16 px, pill padding
  6×14 → 9×20 px. Strip height now ~72 px across the four sites. All four
  globals.css files updated identically so the cross-village nav stays
  pixel-uniform.
- **Docker boot port note**: `apps/goldberry`, `apps/ggg`, and `apps/nursery`
  expose port **3001** internally (`PORT=3001` baked into the image); `apps/hub`
  uses **3000**. The `docker run -p host:container` invocation has to match.
  Documented because earlier sessions hit confusing "container is up but the
  port is dead" symptoms before realizing this.

### Goldberry — positioning correction

Previous copy framed the farm as a "regional supplier of genetic stock" /
commercial nursery. That was a mismatch with how Goldberry actually operates.
Corrected throughout the site **and** in the vault Brand Persona.

**New positioning**: educational hub on native and regenerative agroforestry.

- **~7 acres** of u-pick (chestnut, hazelnut, black walnut; pawpaw, persimmon,
  mulberry, serviceberry, elderberry).
- **~9 acres** of mushroom production (shiitake, lion's mane, oysters on
  hardwood logs; wild-simulated medicinals along the woodland edge).
- **Medicinal forest farming** — wild-simulated ginseng, goldenseal, ramps,
  black cohosh in the wooded understory.
- **Foraging education** — guided walks for native plant ID, wild edibles,
  Appalachian materia medica.
- **Family signal** — Abigail + Josh Dunbar + Quasar (Samoyed), plus
  farmhands **George** and **Wesley**.

The American Chestnut remains the mission anchor (restoration story, Korean-
Appalachian heritage) but is **not** a product line. Vault `Brand Persona.md`
now carries this correction with an explicit "Positioning correction,
2026-05-29" callout so future copy work doesn't drift back to the old framing.

### Goldberry — pages built

- `apps/goldberry/app/page.tsx` — full rewrite. Hero, manifesto, "What grows
  here," vision, family slideshow, come-see-us preview, story strip.
- `apps/goldberry/app/visit/page.tsx` (new) — Come See Us hub with the
  four-program grid + getting-here block.
- `apps/goldberry/app/visit/upick/page.tsx` (new) — Season calendar, how it
  works, George + Wesley signal.
- `apps/goldberry/app/visit/events/page.tsx` (new) — Farm-to-table, harvest
  weekends, JADAM intensives, solstice days.
- `apps/goldberry/app/visit/seminars/page.tsx` (new) — Mushroom inoculation,
  forest farming, foraging walks, KNF, grafting, native plant ID.
- `apps/goldberry/app/visit/private/page.tsx` (new) — Lower-hollow venue spec,
  what works there, inquiry path.
- `apps/goldberry/app/about/page.tsx` (new) — Origin (Korean-Appalachian
  chestnut), explicit "educational farm — not a nursery" callout, George +
  Wesley crew band.

### Goldberry — media

- **Drone footage background** on the manifesto section. Source:
  `youtube.com/watch?v=G44Va_9r0JQ`. Re-encoded to a 20-second loop at
  1280×720, muted, autoplaying, looping: **mp4 (2.7 MB) + webm (2.2 MB)** with
  a **105 KB poster.webp**. Raw 591 MB file deleted after encode. Files live
  in `apps/goldberry/public/video/`.
- **Two-stage dark veil** over the video (linear gradient + radial spot over
  the text column) plus `text-shadow` on the copy keeps body text legible
  across every drone frame.
- **`prefers-reduced-motion`** falls back to the poster image, no video.
- **Family slideshow** — pure-CSS crossfade of 10 webp photos from
  `Desktop/Photos/Farm Activities/`. 50 s cycle, each slide visible ~5 s.
  `prefers-reduced-motion` reduces to a single still.
- **Founder photos** processed via `cwebp` (ffmpeg's webp encoder is disabled
  in the Homebrew build — fallback noted for next session): `abigail-hazelnuts.webp`,
  `founders-family.webp`, `learning-from-locals.webp`.

### Goldberry — frontend-design refinement pass

- **CSS root-cause fix** for `.visit-body li strong` — scoped to
  `:first-child` so prose `<strong>` inside the same `<li>` doesn't pick up
  the uppercase-mono label treatment. The earlier band-aid (inline style
  overrides on `/visit/upick`) is reverted to clean `<em class="prose-anchor">`.
- **Asymmetric "What grows here" grid** — broke the symmetric 4-up SaaS grid
  into an editorial layout: U-Pick is an anchor card on the left with a
  half-bleed photo + chestnut overlay, spanning all three rows; Mushrooms /
  Medicinal / Foraging stack to the right as typographic cream cards. Mobile
  reverts to single column.
- **Vision pillars** — dropped the "Pillar 01 / 02 / 03 / 04" mono numbering
  (read as SaaS-template). Replaced with a small botanical leaf SVG glyph +
  a tighter typographic hierarchy.
- **Paper-grain SVG noise** — fixed `body::before` overlay at 3.5 % opacity,
  `mix-blend-mode: multiply`. Same `feTurbulence` pattern the nursery site
  uses. Gives the editorial-print feel the brand guide invites.

### Hub / GGG / Nursery — state of play

- **Hub** is at "wireframe-port complete" — strong editorial bones
  (drop-cap, magazine-spread layout) but the hero gradient is currently eating
  the hero photo. Follow-up worth a future session.
- **GGG Woodworking** is the most distinctive of the four (brutalist craft
  typography, walnut log photos, catalog grid, maker's-note quote, wood
  library). No urgent changes.
- **Nursery** is functional garden-center commerce. Less aspirational than
  the other three; matches the use case. No urgent changes.

### Follow-ups (not done this session)

- Hub hero: rework the gradient so the hero photo reads at high contrast.
- Goldberry `/visit/upick` season list — restructure as an almanac with
  oversized italic month titles rather than a definition list. Today's edit
  fixed the styling collision; the structural redesign is a future pass.
- Wire the new `/visit/*` and `/about` routes into actual Asana follow-ups
  for content review (Abigail to read the copy, photos to be replaced with
  real on-farm shots where the activity-*.webp placeholders sit).
- Asana sync (done as part of this session — see project 1213867393569940).
