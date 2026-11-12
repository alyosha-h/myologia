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
- `src/ui.tsx` — `PlateLayers` (img + multiply mask tints, shared position), chips, rails, wipe, nav
- `src/screens/*` — Home, Workout, Week, MaskTest
- `public/sw.js` — offline: precaches shell + plates + masks, cache-first after

## decisions made

- one session per calendar day. today's day = the one after the last worked session (push → pull → legs); `↻` on the plate screen overrides it
- weekly heat: primary mover counts 1 set, other `hit` muscles ½
- weight: blank → first `+` gives last session's weight (or 45) → +5; the number is also typeable. ticking a set with no weight carries last session's weight
- "seal the plate" marks the session sealed and opens the week
- fonts self-hosted via @fontsource so offline works

## not yet

rest timer, PR flags, editing days/lifts (model supports it, no ui), export/backup
