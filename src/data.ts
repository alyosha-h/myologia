import raw from './plates.json';

export const C = {
  lime: '#F0F7DC',
  lav: '#C9B5F0',
  chart: '#D6E46E',
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

export const asset = (f: string) => import.meta.env.BASE_URL + f;

/* ---------- program model ---------- */

export interface Lift { id: string; name: string; scheme: string; sets: number; hit: string[] }
export interface Day { id: string; name: string; title: string; color: string; lifts: string[] }
export interface Entry { weight: number | null; setsDone: boolean[] }
export interface Session {
  id: string; // = date, one session per calendar day
  date: string; // YYYY-MM-DD local
  dayId: string;
  entries: Record<string, Entry>; // by liftId
  sealed: boolean;
}

const DAY_COLOR: Record<string, string> = { Push: C.chart, Pull: C.lav, Legs: C.coral };
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function seedProgram(): { lifts: Lift[]; days: Day[] } {
  const lifts: Lift[] = [];
  const days: Day[] = raw.sampleDays.map((d) => {
    const ids = d.lifts.map((l) => {
      const id = slug(l.name);
      lifts.push({ id, name: l.name, scheme: l.scheme.replace('x', '×').replace('-', '–'), sets: l.sets, hit: l.hit });
      return id;
    });
    return { id: slug(d.name), name: d.name, title: d.title, color: DAY_COLOR[d.name] ?? C.chart, lifts: ids };
  });
  return { lifts, days };
}

export const plateOfLift = (l: Lift): PlateId => MUSCLES[l.hit[0]].plate;

/** the plate a day "opens": plate of its first lift */
export const plateOfDay = (d: Day, lifts: Record<string, Lift>): PlateId => plateOfLift(lifts[d.lifts[0]]);

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
