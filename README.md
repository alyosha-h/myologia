# myologia

weightlifting tracker as an 1851 anatomical atlas. each workout is a plate. built from `../myologia-handoff`.

```
npm i
npm run dev        # http://<lan-ip>:5173 — open on the phone on the same wifi
npm run build      # dist/ — static, deploy anywhere (cloudflare pages / vercel / netlify)
```

routes (hash): `#/` home · `#/plate` today's workout · `#/week` survey · `#/masks` mask debug

## shape

- `src/data.ts` — plates, muscles, palette, seed PPL program (from `plates.json`), crop math (`posFor`)
- `src/db.ts` — indexeddb wrapper (lifts, days, sessions, meta)
- `src/store.tsx` — in-memory state, write-through to idb; rotation, prev weight, weekly volume
- `src/ui.tsx` — `PlateLayers` (img + multiply mask tints, shared position), chips, rails, page turn, nav
- `src/screens/*` — Home, Workout, Week, MaskTest
- `public/sw.js` — offline: precaches shell + plates + masks, cache-first after

## art direction

pastel print-ware over an 1851 atlas. the rules:

- three voices. serif italic = the engraver (names, titles, roman numerals). archivo expanded black = the machine (every arabic number: weights, sets, counts). plex mono = the ledger (metadata chips)
- plates are never shown as scans. `PlateLayers` knocks the scan back to line and multiplies it onto a `field` colour, so the figure is printed on the page, riso-style. each plate owns a field (I coral, II lavender, III chartreuse, IV mint)
- tints are flat colour laid *under* the line work, not multiplied over it, so they stay clean on any field. on the plate screen the field is the day's colour and `palFor(field)` picks lift colours that still read on it
- motion: the home screen is the poster and may loop (ticking ring, flicker, drift). the plate screen only moves in answer to you: plate pans, tint lands out of register and snaps in, ring stamps, leader draws, tag unrolls. everything is stepped, nothing eases
- page turns live in `App.tsx` (`Turn` in `ui.tsx`), not in the screens: slats in the destination's colours shut over the old screen, its name is stamped on, the screens swap underneath, the slats pull off the far side. later pages sweep one way, earlier pages the other. sealing a plate stamps SEALED and holds a beat longer
- the atlas's leader lines are the hud: `Callout` drops a ring on the primary mover (`ANCHOR` in `data.ts`) and elbows out to a tag
- furniture is print furniture: registration marks, tick rulers, barcodes, segmented meters. nothing decorative that doesn't look like it came off a press

## decisions made

- one session per calendar day. today's day = the one after the last worked session (push → pull → legs); `↻` on the plate screen overrides it
- weekly heat: primary mover counts 1 set, other `hit` muscles ½
- weight: blank → first `+` gives last session's weight (or 45) → +5; the number is also typeable. ticking a set with no weight carries last session's weight
- "seal the plate" marks the session sealed and opens the week
- ab work is a weekly quota (default 4×, set under Lifts → `Abs ×4`), not a rotation day. its lifts ride after every day's lifts on the plate (dotted `Ab` tabs) and log to `session.core`, so an ab-only rest day never advances push → pull → legs. any ab set ticked counts the day; weeks run mon–sun
- while the week still owes ab days, the day's last lift hands on to the abs instead of sealing. ab work alone ends in "note the abdomen", which files nothing
- fonts self-hosted via @fontsource so offline works

## not yet

rest timer, PR flags, editing days/lifts (model supports it, no ui), export/backup
