import { useEffect, useRef, useState } from 'react';
import { C, DAY_COLOR, PLATE_COLOR, kindOf, plateOfDay } from './data';
import Edit from './screens/Edit';
import Home from './screens/Home';
import MaskTest from './screens/MaskTest';
import Week from './screens/Week';
import Workout from './screens/Workout';
import { fromIso, isoWeek, useStore } from './store';
import { Turn, transitionHint, type Phase, type Route } from './ui';

const parse = (): Route => {
  const h = location.hash.replace(/^#\/?/, '');
  return h === 'plate' || h === 'week' || h === 'masks' || h === 'edit' ? h : 'home';
};

// colour at the top of each screen. ios standalone tints its status-bar blur band
// (and the overscroll area) from the root background, so the root has to match the top.
const TOP: Record<Route, string> = { home: C.ink, plate: C.lime, week: C.lav, masks: C.lime, edit: C.lime };

// the order of the book: turning to a later page sweeps one way, turning back sweeps the other
const ORDER: Route[] = ['home', 'plate', 'week', 'edit', 'masks'];
const COVER = 300, HOLD = 110, SEAL_HOLD = 520, REVEAL = 460; // sealing is the one turn that lingers

interface Turning { to: Route; back: boolean; phase: Phase; sealed: boolean }

export default function App() {
  const st = useStore();
  const { ready } = st;
  const [route, setRoute] = useState<Route>(parse);
  // the first paint is a turn too: slats already shut, pulled off once the store is ready
  const [turn, setTurn] = useState<Turning | null>(() =>
    matchMedia('(prefers-reduced-motion: reduce)').matches ? null : { to: parse(), back: false, phase: 'hold', sealed: false });
  const shown = useRef(route);
  const timers = useRef<number[]>([]);

  const after = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)); };
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const swap = (to: Route) => { shown.current = to; setRoute(to); window.scrollTo(0, 0); };
  const reveal = () => {
    setTurn((t) => t && { ...t, phase: 'reveal' });
    after(REVEAL, () => setTurn(null));
  };

  useEffect(() => {
    const on = () => {
      const to = parse();
      const sealed = transitionHint.sealed; transitionHint.sealed = false;
      clear();
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setTurn(null); swap(to); return; }
      if (to === shown.current) { reveal(); return; } // turned back mid-turn
      setTurn({ to, back: ORDER.indexOf(to) < ORDER.indexOf(shown.current), phase: 'cover', sealed });
      after(COVER, () => { swap(to); setTurn((t) => t && { ...t, phase: 'hold' }); after(sealed ? SEAL_HOLD : HOLD, reveal); });
    };
    addEventListener('hashchange', on);
    return () => { removeEventListener('hashchange', on); clear(); };
  }, []);

  useEffect(() => {
    if (!ready) return;
    after(HOLD, reveal);
  }, [ready]);

  useEffect(() => {
    const top = TOP[route];
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', top);
    document.documentElement.style.background = top;
    document.documentElement.dataset.route = route;
  }, [route]);

  // what's stamped on the slats, and what colour they are: the destination's own
  let face: { slats: string[]; kicker: string; label: string } | null = null;
  if (turn) {
    let a: string = C.lime, b: string = C.chart, kicker = 'Myologia', label = 'Myologia';
    if (ready) {
      const day = st.dayById(st.sessionFor(st.today).dayId);
      const plate = plateOfDay(day, st.lifts);
      if (turn.to === 'home') { a = PLATE_COLOR[plate]; kicker = 'Vol. I'; }
      else if (turn.to === 'plate') { a = DAY_COLOR[kindOf(day)] ?? day.color; b = C.lime; kicker = `Pl. ${plate} / opening`; label = day.name; }
      else if (turn.to === 'week') {
        a = C.lav; label = turn.sealed ? 'Sealed' : `Wk ${String(isoWeek(fromIso(st.today))).padStart(2, '0')}`;
        kicker = turn.sealed ? `Pl. ${plate} / ${day.name}` : 'Hebdomadal survey';
      }
      else if (turn.to === 'edit') { a = C.lime; b = C.coral; kicker = 'The programme'; label = 'Lifts'; }
      else { a = C.mint; b = C.lime; kicker = 'Debug'; label = 'Masks'; }
    }
    face = { slats: [a, b, a, C.ink, a, b, a], kicker, label };
  }

  const Screen = { home: Home, plate: Workout, week: Week, masks: MaskTest, edit: Edit }[route];
  return (
    <>
      {ready && <Screen key={route} />}
      {turn && face && <Turn phase={turn.phase} back={turn.back} {...face} />}
    </>
  );
}
