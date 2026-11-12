import { useEffect, useState } from 'react';
import { C, MUSCLES, PAL, PLATES, plateOfLift, posFor, type Entry } from '../data';
import { DOW, ddmm, fromIso, setsDoneIn, useStore } from '../store';
import { Chip, LetterTile, Nav, PlateLayers, Rail, useSize, Wipe } from '../ui';
import type { Tint } from '../ui';

export default function Workout() {
  const st = useStore();
  const { today, lifts } = st;
  const session = st.sessionFor(today);
  const day = st.dayById(session.dayId);
  const dayLifts = day.lifts.map((id) => lifts[id]).filter(Boolean);

  // start on the first lift that isn't finished
  const firstOpen = () => {
    const j = dayLifts.findIndex((l) => setsDoneIn(session, l.id) < l.sets);
    return j < 0 ? 0 : j;
  };
  const [i, setI] = useState(firstOpen);
  const [last, setLast] = useState<string | null>(null);
  useEffect(() => { setI(firstOpen()); /* eslint-disable-line */ }, [day.id]);

  const idx = Math.min(i, dayLifts.length - 1);
  const L = dayLifts[idx];
  const col = PAL[idx % PAL.length];
  const prim = L.hit[0];
  const plate = plateOfLift(L);

  const [figRef, fig] = useSize<HTMLElement>();
  const pos = `50% ${posFor(prim, fig.w, fig.h)}`;

  const tints: Record<string, Tint> = {};
  L.hit.forEach((k, j) => { if (MUSCLES[k].plate === plate) tints[k] = { color: col, op: j === 0 ? 1 : 0.45 }; });
  const chips = L.hit.filter((k) => MUSCLES[k].plate === plate);

  const entry: Entry = session.entries[L.id] ?? { weight: null, setsDone: Array(L.sets).fill(false) };
  const setsDone = Array.from({ length: L.sets }, (_, s) => !!entry.setsDone[s]);
  const prev = st.prevWeight(L.id, today);

  const write = (e: Entry) => st.saveSession({ ...session, entries: { ...session.entries, [L.id]: e } });
  const setWeight = (w: number | null) => write({ ...entry, setsDone, weight: w == null ? null : Math.max(0, w) });
  const toggle = (s: number) => {
    const nd = setsDone.slice(); nd[s] = !nd[s];
    // first set ticked with no weight entered: carry last session's weight
    const weight = entry.weight == null && nd[s] && prev != null ? prev : entry.weight;
    write({ weight, setsDone: nd });
    setLast(`${day.id}-${L.id}-${s}`);
    navigator.vibrate?.(8);
  };

  let got = 0, total = 0;
  const tabs = dayLifts.map((x, j) => {
    const n = setsDoneIn(session, x.id);
    got += Math.min(n, x.sets); total += x.sets;
    return { x, j, n, cur: j === idx, full: n >= x.sets, c: PAL[j % PAL.length] };
  });

  const isLast = idx === dayLifts.length - 1;
  const next = () => {
    if (!isLast) return setI(idx + 1);
    if (!session.sealed) st.saveSession({ ...session, sealed: true });
    location.hash = '#/week';
  };
  const cycleDay = () => {
    const k = st.days.findIndex((d) => d.id === day.id);
    st.saveSession({ ...session, dayId: st.days[(k + 1) % st.days.length].id });
  };

  const d = fromIso(today);
  const reps = L.scheme.split('×')[1] ?? '';
  const pad = (n: number) => (n < 10 ? '0' : '') + n;

  return (
    <div className="screen-plate">
      <Wipe colors={[C.lav, C.coral, C.chart, C.ink, C.yellow, C.mint]} chips={['Pl.', plate, 'opening']} />

      <header className="w-head">
        <LetterTile letters={['P', 'l', plate]} label={`Plate ${plate}`} />
        <div className="w-title">
          <span aria-hidden="true" style={{ position: 'absolute', left: 50, top: 6, width: 96, height: 34, background: day.color }} />
          <span className="cyc jit" aria-hidden="true" style={{ position: 'absolute', left: 100, top: 0, width: 12, height: 14, mixBlendMode: 'multiply' }} />
          <h1>{day.title}</h1>
        </div>
        <button type="button" className="w-day" onClick={cycleDay} aria-label={`Change day, now ${day.name}`}>
          <Chip>{DOW[d.getDay()]} {ddmm(d)}</Chip>
          <Chip bg={C.coral} cls="flk">{day.name} &#8635;</Chip>
        </button>
      </header>

      <figure ref={figRef} className="w-fig">
        <div key={plate} className="iris layer">
          <PlateLayers plate={plate} tints={tints} pos={pos} />
        </div>
        <Rail n={6} size={12} step={0.15} style={{ position: 'absolute', right: 16, top: 12, gap: 3 }} />
        <span className="cyc" aria-hidden="true" style={{ position: 'absolute', right: 30, bottom: 40, width: 24, height: 24, mixBlendMode: 'multiply', animationDelay: '1.4s' }} />
        <figcaption>
          <Chip>Fig.</Chip><Chip bg={C.mint}>{PLATES[plate].view}</Chip>
          {chips.map((k, j) => <Chip key={k} bg={j === 0 ? col : C.white}>{MUSCLES[k].short}</Chip>)}
        </figcaption>
      </figure>

      <ol aria-label="Lifts today" className="w-tabs">
        {tabs.map((t) => (
          <li key={t.x.id}>
            <button type="button" onClick={() => setI(t.j)}
              aria-label={`${t.x.name}, ${t.n} of ${t.x.sets} sets${t.cur ? ', current' : ''}`}
              aria-current={t.cur ? 'step' : undefined}
              style={{ border: t.cur ? `2px solid ${C.ink}` : `1px dashed ${C.ink}`, background: t.full ? t.c : t.cur ? C.white : 'transparent' }}>
              <span className="w-tab-l">{String.fromCharCode(65 + t.j)}</span>
              <span className="w-tab-p">{Math.min(t.n, t.x.sets)}/{t.x.sets}</span>
            </button>
          </li>
        ))}
      </ol>

      <section key={`${day.id}-${idx}`} className="w-card cardA" aria-live="polite">
        <div className="w-card-top">
          <h2>{L.name}</h2>
          <span className="w-card-meta">
            <span className="mono10">{pad(idx + 1)} / {pad(dayLifts.length)}  &#183;  {String.fromCharCode(65 + idx)}</span>
            <span style={{ display: 'flex', gap: 3 }}><Chip bg={col}>{L.scheme}</Chip><Chip>Pl. {plate}</Chip></span>
          </span>
        </div>
        <div className="w-card-mid">
          <div role="group" aria-label="Weight" className="stepper">
            <button type="button" aria-label="Less weight" onClick={() => entry.weight != null && setWeight(entry.weight - 5)}>&#8722;</button>
            <label style={{ background: col }}>
              <input inputMode="decimal" aria-label="Weight in pounds" placeholder="&#8212;"
                value={entry.weight ?? ''}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  if (v === '') return setWeight(null);
                  const n = Number(v);
                  if (Number.isFinite(n)) setWeight(n);
                }} />
              <span className="mono11">lb</span>
            </label>
            <button type="button" aria-label="More weight" onClick={() => setWeight(entry.weight == null ? (prev ?? 45) : entry.weight + 5)}>+</button>
          </div>
          <span style={{ flexGrow: 1 }} />
          <span className="mono11" style={{ textAlign: 'right', lineHeight: 1.4 }}>
            {L.sets} sets &#183; {reps} reps
            {prev != null && <><br /><span style={{ background: C.white, padding: '1px 4px' }}>last {prev} lb</span></>}
          </span>
        </div>
        <div role="group" aria-label="Sets" className="w-sets">
          {setsDone.map((dn, s) => {
            const key = `${day.id}-${L.id}-${s}`;
            return (
              <button key={s} type="button" onClick={() => toggle(s)} aria-pressed={dn} aria-label={`${L.name}, set ${s + 1}${dn ? ', done' : ''}`}>
                <span className={dn && key === last ? 'stamp' : ''} style={{ background: dn ? col : C.white }}>
                  <span className="w-set-n">{s + 1}</span>
                  <span className="mono9">{dn ? 'done' : 'set'}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="w-next">
        <button type="button" className="w-prev" aria-label="Previous lift" onClick={() => idx > 0 && setI(idx - 1)}>&#8592;</button>
        <button type="button" className="w-go" onClick={next}
          style={{ background: isLast ? C.ink : C.chart, color: isLast ? C.lime : C.ink }}>
          <span className="w-go-l">{isLast ? (session.sealed ? 'Plate sealed' : 'Seal the plate') : `Next: ${dayLifts[idx + 1].name}`}</span>
          <span className="w-go-n">{got}/{total}</span>
          <span className="hop" aria-hidden="true" />
        </button>
      </div>

      <Nav order={['home', 'plate', 'week']} current="plate" h={44} />
    </div>
  );
}
