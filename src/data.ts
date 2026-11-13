import raw from './plates.json';

export const C = {
  lime: '#F0F7DC',
  lav: '#C9B5F0',
  chart: '#DCEE5A',
  coral: '#F4A186',
  dlav: '#B79CEB',
  yellow: '#F5D54A',
  mint: '#A9E0D6',
  peri: '#4E54B0',
  ink: '#33190F',
  paper: '#EFE6D3',
  white: '#FFFFFF',
} as const;

/** per-lift tint cycle, index = lift position in the day */
export const PAL = [C.coral, C.lav, C.chart, C.mint, C.yellow, C.dlav];

/** lift colours that still read on a given field: drop the field's own colour and its near neighbour */
const CLASH: Record<string, string[]> = {
  [C.lav]: [C.lav, C.dlav], [C.dlav]: [C.lav, C.dlav], [C.chart]: [C.chart, C.yellow], [C.yellow]: [C.chart, C.yellow],
  [C.coral]: [C.coral], [C.mint]: [C.mint],
};
export const palFor = (field: string) => PAL.filter((c) => !(CLASH[field] ?? []).includes(c));

export type PlateId = 'I' | 'II' | 'III' | 'IV';
export const PLATE_IDS: PlateId[] = ['I', 'II', 'III', 'IV'];

export interface Muscle {
  key: string;
  name: string; // atlas name, "Pectoralis major"
  short: string; // chip name, "pectoralis major"
  phrase: string; // prose name, "anterior deltoid"
  plate: PlateId;
  mask: string;
  centroidY: number;
}

export interface Plate {
  id: PlateId;
  file: string;
  view: string;
  alt: string;
  masks: string[];
}

const SHORT: Record<string, [string, string]> = {
  pec: ['pectoralis major', 'pectoralis major'],
  delt: ['deltoid, anterior', 'anterior deltoid'],
  tri: ['triceps', 'triceps'],
  abs: ['rectus abdominis', 'rectus abdominis'],
  obl: ['obliques', 'obliques'],
  trap: ['trapezius', 'trapezius'],
  lat: ['latissimus dorsi', 'latissimus dorsi'],
  rdelt: ['deltoid, posterior', 'posterior deltoid'],
  quad: ['quadriceps', 'quadriceps'],
  ham: ['hamstrings', 'hamstrings'],
  glute: ['gluteus maximus', 'gluteus maximus'],
  calf: ['gastrocnemius', 'gastrocnemius'],
  sdelt: ['deltoid, lateral', 'lateral deltoid'],
  bic: ['biceps', 'biceps'],
};

const ALT: Record<PlateId, string> = {
  I: 'Plate I: a young man, arms bound overhead, chest and abdomen dissected',
  II: 'Plate II: the same young man from behind, head in profile, back dissected',
  III: "Plate III: the same young man's legs, front and back, dissected",
  IV: 'Plate IV: the same young man in profile, head bowed, shoulder and arm dissected',
};

export const PLATES = {} as Record<PlateId, Plate>;
export const MUSCLES: Record<string, Muscle> = {};

for (const id of PLATE_IDS) {
  const p = (raw.plates as Record<string, { file: string; view: string; masks: Record<string, { file: string; name: string; centroidY: number }> }>)[id];
  PLATES[id] = { id, file: p.file, view: p.view, alt: ALT[id], masks: Object.keys(p.masks) };
  for (const [key, m] of Object.entries(p.masks)) {
    MUSCLES[key] = {
      key, name: m.name, short: SHORT[key][0], phrase: SHORT[key][1],
      plate: id, mask: m.file, centroidY: m.centroidY,
    };
  }
}

/** a point deep inside each muscle (fraction of the plate), where its leader line lands. rightmost belly when there are two */
export const ANCHOR: Record<string, [number, number]> = {
  pec: [0.594, 0.443], delt: [0.693, 0.386], tri: [0.714, 0.295], abs: [0.493, 0.699], obl: [0.595, 0.632],
  trap: [0.491, 0.397], lat: [0.531, 0.57], rdelt: [0.65, 0.343],
  quad: [0.375, 0.47], ham: [0.675, 0.439], glute: [0.819, 0.308], calf: [0.808, 0.698],
  sdelt: [0.633, 0.361], bic: [0.626, 0.464],
};

/** the colour field each plate is printed on */
export const PLATE_COLOR: Record<PlateId, string> = { I: C.coral, II: C.dlav, III: C.chart, IV: C.mint };

export const asset = (f: string) => import.meta.env.BASE_URL + f;

/* ---------- program model ---------- */

export interface Lift {
  id: string;
  name: string;
  sets: number;
  repMin: number;
  repMax: number;
  /** lb added after a session where every set was done and the last set reached repMax. 0 = never auto-add */
  inc: number;
  /** first-session weight, lb. null = bodyweight / unknown */
  start: number | null;
  /** last set as many reps as possible */
  amrap?: boolean;
  /** bar weight for plate math, lb. null = not a barbell lift (no plate math). undefined = default by lift id */
  bar?: number | null;
  /** weight is per dumbbell. undefined = default by lift id */
  perHand?: boolean;
  note?: string;
  hit: string[]; // muscle keys, primary first
  /** legacy, pre-v2 lifts only */
  scheme?: string;
}
export interface Day { id: string; name: string; title: string; color: string; lifts: string[]; order?: number }
export interface Entry { weight: number | null; setsDone: boolean[]; /** reps on the last set */ reps?: number | null }
export interface Session {
  id: string; // = date, one session per calendar day
  date: string; // YYYY-MM-DD local
  dayId: string;
  entries: Record<string, Entry>; // by liftId
  sealed: boolean;
  /** ab work, by liftId. kept out of `entries` so it never counts as a rotation day */
  core?: Record<string, Entry>;
}

/** ab work: its own lifts and a weekly quota, beside the rotation rather than in it. any ab set ticked counts the day */
export interface Core { perWeek: number; lifts: string[] }

export const repsOf = (l: Lift) => (l.repMin === l.repMax ? String(l.repMax) : `${l.repMin}–${l.repMax}`);
export const schemeOf = (l: Lift) => `${l.sets}×${repsOf(l)}`;

/** fill v2 fields on lifts saved by v1 ("3x8-12") */
export function normLift(l: Lift): Lift {
  if (l.repMin != null) return l;
  const m = (l.scheme ?? '').match(/(\d+)\s*[x×]\s*(\d+)(?:\s*[-–]\s*(\d+))?/);
  const lo = m ? +m[2] : 8, hi = m && m[3] ? +m[3] : lo;
  return { ...l, sets: l.sets ?? (m ? +m[1] : 3), repMin: lo, repMax: hi, inc: 2.5, start: null };
}

/** "Push A" → "Push" */
export const kindOf = (d: Day) => d.name.split(' ')[0];
export const DAY_COLOR: Record<string, string> = { Push: C.chart, Pull: C.lav, Legs: C.coral };
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const round25 = (n: number) => Math.round(n / 2.5) * 2.5;

/**
 * the split from PPL_Template_v2.xlsx (Routine sheet), Mon–Sun minus Thursday.
 * start weights follow the sheet: floor(1RM × training % for the top of the rep range, 2.5).
 * progression follows the sheet: hit the top of the range on the last set → add `inc` next time.
 */
const L = (id: string, name: string, sets: number, repMin: number, repMax: number, start: number | null, hit: string[], extra: Partial<Lift> = {}): Lift =>
  ({ id, name, sets, repMin, repMax, inc: start == null ? 0 : 2.5, start, hit, ...extra });

export const PROGRAM_VERSION = 2;

/* ---------- plate math ---------- */

/** the sheet's barbell lifts. any other lift has no bar until one is set in the editor */
const BARBELL = new Set(['deadlift', 'barbell-row', 'bench-press', 'incline-bench-press', 'squat', 'romanian-deadlift', 'barbell-hack-squat']);
export const barOf = (l: Lift): number | null => (l.bar !== undefined ? l.bar : BARBELL.has(l.id) ? 45 : null);

export const PLATE_SIZES = [55, 45, 35, 25, 15, 10, 5, 2.5, 1.25];
export const DEFAULT_PLATES = [45, 35, 25, 10, 5, 2.5];
export const DISC_COLOR: Record<number, string> = {
  55: C.peri, 45: C.coral, 35: C.yellow, 25: C.mint, 15: C.dlav, 10: C.lav, 5: C.chart, 2.5: C.white, 1.25: C.white,
};

/**
 * what goes on each side of the bar for `w`, largest plates first, as many pairs of each as needed.
 * `short` = lb per side that the plates on hand can't make (0 when exact). null when `w` is under the bar.
 */
export function loadFor(w: number, bar: number, plates: number[]): { side: number[]; short: number } | null {
  if (w < bar) return null;
  let rest = (w - bar) / 2;
  const side: number[] = [];
  for (const p of [...plates].sort((a, b) => b - a)) {
    while (rest >= p - 1e-9) { side.push(p); rest -= p; }
  }
  return { side, short: Math.round(rest * 1000) / 1000 };
}

/* ---------- dumbbells ---------- */

/** the sheet's dumbbell lifts, logged per hand */
const DUMBBELL = new Set(['hammer-curl', 'dumbbell-curl', 'dumbbell-row', 'dumbbell-press', 'incline-dumbbell-press', 'lateral-raise']);
export const perHandOf = (l: Lift): boolean => (l.perHand !== undefined ? l.perHand : DUMBBELL.has(l.id));

const DB_KEY = 'myologia.dbstep';
/** how far apart the dumbbells on the rack are, lb. the rack is this gym's, so it stays on this device */
export function dbStep(): number {
  try { const v = Number(localStorage.getItem(DB_KEY)); if (v === 2.5 || v === 5) return v; } catch { /* ignore */ }
  return 5;
}
export function saveDbStep(v: number) { try { localStorage.setItem(DB_KEY, String(v)); } catch { /* ignore */ } }
/** weight step for a lift: the rack's spacing for dumbbells, 2.5 for everything else */
export const stepOf = (l: Lift) => (perHandOf(l) ? dbStep() : 2.5);
/** a weight that's actually on the rack: up for an increase, down for a deload */
export const snap = (w: number, step: number, dir: 'up' | 'down') =>
  (dir === 'up' ? Math.ceil(w / step - 1e-9) : Math.floor(w / step + 1e-9)) * step;

const PLATES_KEY = 'myologia.plates';
/** plates on hand are this gym's, so they stay on this device */
export function platesOnHand(): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(PLATES_KEY) ?? 'null');
    if (Array.isArray(v) && v.every((x) => typeof x === 'number')) return v;
  } catch { /* private mode, bad json */ }
  return DEFAULT_PLATES;
}
export function savePlatesOnHand(p: number[]) {
  try { localStorage.setItem(PLATES_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

export function seedProgram(): { lifts: Lift[]; days: Day[] } {
  const lifts = [
    L('deadlift', 'Deadlift', 1, 5, 5, 225, ['glute', 'ham', 'trap', 'lat'], { amrap: true }),
    L('barbell-row', 'Barbell row', 5, 5, 10, 145, ['lat', 'rdelt', 'trap', 'bic'], { amrap: true }),
    L('lat-pulldown', 'Lat pulldown', 3, 8, 12, 120, ['lat', 'bic']),
    L('hammer-curl', 'Hammer curl', 3, 8, 12, 35, ['bic']),
    L('dumbbell-curl', 'Dumbbell curl', 3, 8, 12, 35, ['bic']),
    L('dumbbell-row', 'Dumbbell row', 3, 8, 12, 45, ['lat', 'rdelt', 'bic']),
    L('d-handle-pull', 'D-handle pull', 5, 8, 12, 110, ['lat', 'trap', 'rdelt', 'bic']),
    L('face-pull', 'Face pull', 3, 15, 20, 47.5, ['rdelt', 'trap'], { note: 'rope. no cable? band pull-aparts' }),
    L('bench-press', 'Bench press', 3, 5, 5, 162.5, ['pec', 'tri', 'delt'], { amrap: true }),
    L('incline-bench-press', 'Incline bench press', 3, 5, 5, 130, ['pec', 'delt', 'tri'], { amrap: true }),
    L('dumbbell-press', 'Dumbbell press', 3, 8, 12, 50, ['pec', 'tri', 'delt'], { inc: 0, note: 'flat' }),
    L('incline-dumbbell-press', 'Incline dumbbell press', 3, 8, 12, 50, ['pec', 'delt', 'tri']),
    L('lateral-raise', 'Lateral raise', 4, 15, 20, 30, ['sdelt']),
    L('skullcrushers', 'Skullcrushers', 3, 8, 12, 15, ['tri']),
    L('overhead-extension', 'Overhead extension', 3, 8, 12, 45, ['tri']),
    L('squat', 'Squat', 3, 5, 5, 152.5, ['quad', 'glute'], { amrap: true }),
    L('romanian-deadlift', 'Romanian deadlift', 3, 8, 12, 100, ['ham', 'glute']),
    L('barbell-hack-squat', 'Barbell hack squat', 3, 8, 12, 100, ['quad', 'glute']),
    L('slider-leg-curl', 'Slider leg curl', 3, 8, 12, null, ['ham'], { note: 'bodyweight, add reps' }),
    L('calf-raise', 'Calf raise', 5, 8, 12, 95, ['calf']),
  ];
  const pullB = ['lat-pulldown', 'hammer-curl', 'dumbbell-curl', 'dumbbell-row', 'd-handle-pull', 'face-pull'];
  const day = (id: string, name: string, title: string, ls: string[]): Day =>
    ({ id, name, title, color: DAY_COLOR[name.split(' ')[0]], lifts: ls });
  const days = [
    day('pull-a', 'Pull A', 'The Pull.', ['deadlift', ...pullB]),
    day('push-a', 'Push A', 'The Push.', ['bench-press', 'dumbbell-press', 'incline-dumbbell-press', 'lateral-raise', 'skullcrushers', 'overhead-extension']),
    day('legs-a', 'Legs A', 'The Legs.', ['squat', 'romanian-deadlift', 'barbell-hack-squat', 'slider-leg-curl', 'calf-raise']),
    day('pull-b', 'Pull B', 'The Pull.', ['barbell-row', ...pullB]),
    day('push-b', 'Push B', 'The Push.', ['incline-bench-press', 'dumbbell-press', 'lateral-raise', 'skullcrushers', 'overhead-extension']),
    day('legs-b', 'Legs B', 'The Legs.', ['squat', 'romanian-deadlift', 'barbell-hack-squat', 'calf-raise', 'slider-leg-curl']),
  ].map((d, i) => ({ ...d, order: i }));
  return { lifts, days };
}

export function seedCore(): { lifts: Lift[]; core: Core } {
  const lifts = [
    L('hanging-leg-raise', 'Hanging leg raise', 3, 10, 15, null, ['abs', 'obl'], { note: 'knees up. straighten the legs once 15 is easy' }),
    L('cable-crunch', 'Cable crunch', 3, 10, 15, null, ['abs'], { inc: 5, note: 'rope, kneeling. round the spine, hips still' }),
  ];
  return { lifts, core: { perWeek: 4, lifts: lifts.map((l) => l.id) } };
}

export const plateOfLift = (l: Lift): PlateId => MUSCLES[l.hit[0]].plate;

/** the plate a day "opens": the plate holding the most of its sets (by primary mover), ties to the earliest lift */
export const plateOfDay = (d: Day, lifts: Record<string, Lift>): PlateId => {
  const n: Partial<Record<PlateId, number>> = {};
  let best: PlateId | null = null;
  for (const id of d.lifts) {
    const l = lifts[id]; if (!l?.hit[0] || !MUSCLES[l.hit[0]]) continue;
    const p = plateOfLift(l); n[p] = (n[p] ?? 0) + l.sets;
    if (!best || n[p]! > n[best]!) best = p;
  }
  return best ?? 'I';
};

/**
 * vertical crop for a muscle inside a frame of fw x fh (plate is object-fit: cover).
 * plate 896x1200; centre the muscle ~42% down the frame.
 */
export function posFor(muscle: string, fw: number, fh: number): string {
  if (!fw || !fh) return '50%';
  const rh = 1200 * (fw / 896);
  if (rh <= fh) return '50%';
  const p = (MUSCLES[muscle].centroidY * rh - fh * 0.42) / (rh - fh);
  return Math.round(Math.max(0, Math.min(1, p)) * 100) + '%';
}

/** where a muscle's anchor lands, in px, inside a fw x fh frame showing the plate at `pos` ("50% 30%"), object-fit: cover */
export function anchorIn(muscle: string, fw: number, fh: number, pos: string): { x: number; y: number } | null {
  const a = ANCHOR[muscle];
  if (!a || !fw || !fh) return null;
  const [px, py] = pos.split(' ').map((v) => parseFloat(v) / 100);
  const s = Math.max(fw / 896, fh / 1200), rw = 896 * s, rh = 1200 * s;
  return { x: (fw - rw) * (px || 0) + a[0] * rw, y: (fh - rh) * (py || 0) + a[1] * rh };
}

/* ---------- words ---------- */

const WORDS = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty'.split(' ');
const TENS: Record<number, string> = { 2: 'twenty', 3: 'thirty', 4: 'forty', 5: 'fifty' };
export function word(n: number): string {
  if (n <= 20) return WORDS[n];
  if (n < 60) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + WORDS[n % 10] : '');
  return String(n);
}
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const OPENING: Record<PlateId, string> = {
  I: 'the chest is opened.',
  II: 'the back is opened.',
  III: 'the legs are opened.',
  IV: 'the arm is opened.',
};
export const OPENED: Record<PlateId, string> = {
  I: 'the chest was opened.',
  II: 'the back was opened.',
  III: 'the legs were opened.',
  IV: 'the arm was opened.',
};
