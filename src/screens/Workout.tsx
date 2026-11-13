import { useEffect, useRef, useState } from 'react';
import { C, DAY_COLOR, MUSCLES, PLATES, DISC_COLOR, barOf, perHandOf, snap, stepOf, kindOf, loadFor, platesOnHand, palFor, plateOfLift, posFor, repsOf, schemeOf, type Entry } from '../data';
import { DOW, coreSetsDone, ddmm, fromIso, hasCore, hasWork, nextAfter, setsDoneIn, useStore, weekStart } from '../store';
import { AbMeter, Callout, Chip, LetterTile, Nav, PlateLayers, openHint, transitionHint, useSize } from '../ui';
import type { Tint } from '../ui';

export default function Workout() {
  const st = useStore();
  const { today, lifts } = st;
  const session = st.sessionFor(today);
  const day = st.dayById(session.dayId);
  const dayLifts = day.lifts.map((id) => lifts[id]).filter(Boolean);
  // ab work rides after the day's lifts on every plate, rest days included
  const coreLifts = st.core.lifts.map((id) => lifts[id]).filter(Boolean);
  const all = [...dayLifts, ...coreLifts];
  const nRot = dayLifts.length;
  const abWeek = st.coreWeek(weekStart(fromIso(today)));
  const abDue = coreLifts.length > 0 && !hasCore(session) && abWeek < st.core.perWeek;

  // start on the first lift that isn't finished; the ab work if asked for, or if it's all that's left and still owed
  const firstOpen = (abs: boolean) => {
    const k = coreLifts.findIndex((l) => coreSetsDone(session, l.id) < l.sets);
    if (abs && coreLifts.length) return nRot + Math.max(k, 0);
    const j = dayLifts.findIndex((l) => setsDoneIn(session, l.id) < l.sets);
    if (j >= 0) return j;
    return abDue ? nRot + Math.max(k, 0) : 0;
  };
  const [i, setI] = useState(() => firstOpen(openHint.abs));
  const [last, setLast] = useState<string | null>(null);
  useEffect(() => { openHint.abs = false; }, []);
  const shownDay = useRef(day.id);
  useEffect(() => {
    if (shownDay.current === day.id) return;
    shownDay.current = day.id;
    setI(firstOpen(false));
  }, [day.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [figRef, fig] = useSize<HTMLElement>();

  const cycleDay = () => {
    const k = st.days.findIndex((d) => d.id === day.id);
    st.saveSession({ ...session, dayId: st.days[(k + 1) % st.days.length].id });
  };

  if (!all.length) {
    return (
      <div className="screen-plate">
        <header className="w-head">
          <LetterTile letters={['P', 'l', '0']} label="Empty plate" />
          <div className="w-title"><h1>{day.title}</h1></div>
          <button type="button" className="w-day" onClick={cycleDay} aria-label={`Change day, now ${day.name}`}>
            <Chip bg={C.coral}>{day.name} &#8635;</Chip>
          </button>
        </header>
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
          <p style={{ margin: 0, fontSize: 18 }}>No lifts on this day yet.</p>
          <a href="#/edit" className="mtog" style={{ alignSelf: 'flex-start', color: C.ink, background: C.chart, textDecoration: 'none' }}>edit lifts &#8594;</a>
        </div>
        <Nav current="plate" h={44} />
      </div>
    );
  }

  const idx = Math.min(i, all.length - 1);
  const L = all[idx];
  const isCore = idx >= nRot;
  const ak = idx - nRot; // position among the ab lifts
  const abLabel = (j: number) => (coreLifts.length > 1 ? <>Ab<sup>{j + 1}</sup></> : <>Ab</>);
  // the figure is printed on the day's colour; lift colours are whatever still reads on it
  const field = DAY_COLOR[kindOf(day)] ?? day.color;
  const pal = palFor(field);
  const col = pal[idx % pal.length];
  const prim = L.hit[0];
  const plate = plateOfLift(L);

  const pos = `50% ${posFor(prim, fig.w, fig.h)}`;

  const tints: Record<string, Tint> = {};
  L.hit.forEach((k, j) => { if (MUSCLES[k].plate === plate) tints[k] = { color: col, op: j === 0 ? 1 : 0.45 }; });
  const chips = L.hit.filter((k) => MUSCLES[k].plate === plate);

  const bucket = (isCore ? session.core : session.entries) ?? {};
  const entry: Entry = bucket[L.id] ?? { weight: null, setsDone: Array(L.sets).fill(false) };
  const setsDone = Array.from({ length: L.sets }, (_, s) => !!entry.setsDone[s]);
  const sug = st.suggest(L.id, today);
  const allDone = setsDone.every(Boolean);
  const reps = entry.reps ?? L.repMax;

  const write = (e: Entry) => st.saveSession(isCore
    ? { ...session, core: { ...session.core, [L.id]: e } }
    : { ...session, entries: { ...session.entries, [L.id]: e } });
  const setWeight = (w: number | null) => write({ ...entry, setsDone, weight: w == null ? null : Math.max(0, w) });
  const setReps = (r: number) => write({ ...entry, setsDone, reps: Math.max(0, Math.min(99, r)) });
  const toggle = (s: number) => {
    const nd = setsDone.slice(); nd[s] = !nd[s];
    // first set ticked with no weight entered: take the suggested weight
    const weight = entry.weight == null && nd[s] ? sug.weight : entry.weight;
    write({ ...entry, weight, setsDone: nd });
    setLast(`${day.id}-${L.id}-${s}`);
    navigator.vibrate?.(8);
  };

  let got = 0, total = 0, abGot = 0, abTotal = 0;
  const tabs = all.map((x, j) => {
    const core = j >= nRot;
    const n = core ? coreSetsDone(session, x.id) : setsDoneIn(session, x.id);
    if (core) { abGot += Math.min(n, x.sets); abTotal += x.sets; } else { got += Math.min(n, x.sets); total += x.sets; }
    return { x, j, n, core, cur: j === idx, full: n >= x.sets, c: pal[j % pal.length] };
  });

  // the day's last lift hands on to the ab work while the week still owes it; the last ab lift closes the plate.
  // ab work alone (a rest day) files nothing: sealing would count the day as a turn of the rotation
  const toAbs = !isCore && idx === nRot - 1 && abDue;
  const closes = isCore ? ak === coreLifts.length - 1 : idx === nRot - 1 && !abDue;
  const worked = hasWork(session);
  const advance = () => {
    if (!closes) return setI(idx + 1);
    if (worked && !session.sealed) { st.saveSession({ ...session, sealed: true }); transitionHint.sealed = true; }
    location.hash = '#/week';
  };
  const goLabel = !closes ? `Next: ${all[idx + 1].name}`
    : session.sealed ? 'Plate sealed' : worked || !isCore ? 'Seal the plate' : 'Note the abdomen';
  const d = fromIso(today);
  const w = entry.weight ?? sug.weight;
  const next = w != null ? nextAfter(L, w, { setsDone, reps }) : null;
  const hint = sug.why === 'up' ? `\u2191 +${(sug.weight ?? 0) - (sug.from ?? 0)}, was ${sug.from}` : sug.why === 'deload' ? `deload, was ${sug.from}`
    : sug.why === 'hold' ? `hold, last ${sug.from}` : sug.why === 'start' ? 'start weight' : L.note ?? 'bodyweight';
  const pad = (n: number) => (n < 10 ? '0' : '') + n;
  const each = perHandOf(L);
  const step = stepOf(L);
  const offRack = each && w != null && snap(w, step, 'down') !== w;
  const bar = each ? null : barOf(L);
  const load = bar != null && w != null ? loadFor(w, bar, platesOnHand()) : null;
  const loadLabel = each && w != null ? `${w} lb in each hand, ${w * 2} lb total${offRack ? `, not on a ${step} lb rack` : ''}`
    : bar == null || w == null ? '' : !load ? `under the ${bar} lb bar`
    : !load.side.length ? `empty ${bar} lb bar` : `per side ${load.side.join(', ')} on a ${bar} lb bar${load.short > 0 ? `, ${load.short} lb short each side` : ''}`;

  return (
    <div className="screen-plate">

      <header className="w-head">
        <LetterTile letters={['P', 'l', plate]} label={`Plate ${plate}`} />
        <div className="w-title">
          <span aria-hidden="true" style={{ position: 'absolute', left: 50, top: 6, width: 96, height: 34, background: field }} />
          <h1>{day.title}</h1>
        </div>
        <button type="button" className="w-day" onClick={cycleDay} aria-label={`Change day, now ${day.name}`}>
          <Chip>{DOW[d.getDay()]} {ddmm(d)}</Chip>
          <Chip bg={C.ink} fg={C.lime}>{day.name} &#8635;</Chip>
        </button>
      </header>

      <figure ref={figRef} className="w-fig" style={{ background: field }}>
        <div key={plate} className="iris layer">
          <PlateLayers plate={plate} tints={tints} pos={pos} field={field} />
        </div>
        <span aria-hidden="true" className="ticks" />
        <Callout key={L.id} muscle={prim} fw={fig.w} fh={fig.h} pos={pos} color={col} letter={isCore ? 'ab' : String.fromCharCode(97 + idx)} label={MUSCLES[prim].short} />
        <figcaption>
          <Chip>Fig.</Chip><Chip bg={C.mint}>{PLATES[plate].view}</Chip>
          {chips.slice(1).map((k) => <Chip key={k} bg={C.white}><span aria-hidden="true" style={{ display: 'inline-block', width: 7, height: 7, marginRight: 5, background: col, opacity: 0.6 }} />{MUSCLES[k].short}</Chip>)}
          <span className="sr">{MUSCLES[prim].short}</span>
        </figcaption>
      </figure>

      <div aria-hidden="true" className="w-meter">
        {tabs.filter((t) => !t.core).flatMap((t) => Array.from({ length: t.x.sets }, (_, s) => (
          <i key={`${t.x.id}-${s}`} style={{ background: session.entries[t.x.id]?.setsDone[s] ? t.c : 'transparent' }} />
        )))}
      </div>

      <ol aria-label="Lifts today" className="w-tabs">
        {tabs.flatMap((t) => [
          ...(t.j === nRot && nRot > 0 ? [<li key="gap" aria-hidden="true" className="w-tab-gap" />] : []),
          <li key={t.x.id}>
            <button type="button" onClick={() => setI(t.j)}
              aria-label={`${t.core ? 'Ab work: ' : ''}${t.x.name}, ${t.n} of ${t.x.sets} sets${t.cur ? ', current' : ''}`}
              aria-current={t.cur ? 'step' : undefined}
              style={{ border: t.cur ? `2px solid ${C.ink}` : `1px ${t.core ? 'dotted' : 'dashed'} ${C.ink}`, background: t.full ? t.c : t.cur ? C.white : 'transparent' }}>
              <span className="w-tab-l">{t.core ? abLabel(t.j - nRot) : String.fromCharCode(65 + t.j)}</span>
              <span className="w-tab-p">{Math.min(t.n, t.x.sets)}/{t.x.sets}</span>
            </button>
          </li>,
        ])}
      </ol>

      <section key={`${day.id}-${idx}`} className="w-card cardA" aria-live="polite">
        <div className="w-card-top">
          <h2>{L.name}</h2>
          <span className="w-card-meta">
            {isCore ? (
              <span className="mono10" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                wk <AbMeter n={abWeek} of={st.core.perWeek} w={7} h={9} /> {abWeek}/{st.core.perWeek}
              </span>
            ) : (
              <span className="mono10">{pad(idx + 1)} / {pad(nRot)}  &#183;  {String.fromCharCode(65 + idx)}</span>
            )}
            <span style={{ display: 'flex', gap: 3 }}><Chip bg={col}>{schemeOf(L)}</Chip><Chip>{isCore ? 'Ab' : `Pl. ${plate}`}</Chip></span>
          </span>
        </div>
        <div className="w-card-mid">
          <div role="group" aria-label="Weight" className="stepper">
            <button type="button" aria-label="Less weight" onClick={() => w != null && setWeight(snap(w, step, 'up') - step)}>&#8722;</button>
            <label style={{ background: col }}>
              <input inputMode="decimal" aria-label="Weight in pounds" placeholder={sug.weight != null ? String(sug.weight) : '\u2014'}
                value={entry.weight ?? ''}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  if (v === '') return setWeight(null);
                  const n = Number(v);
                  if (Number.isFinite(n)) setWeight(n);
                }} />
              <span className="mono11">{each ? 'lb ea' : 'lb'}</span>
            </label>
            <button type="button" aria-label="More weight" onClick={() => setWeight(w == null ? (each ? 20 : 45) : snap(w, step, 'down') + step)}>+</button>
          </div>
          <span style={{ flexGrow: 1 }} />
          {allDone ? (
            <div className="w-reps">
              <span className="mono9">last set reps{next != null && w != null && next > w ? <> &#183; <b>next {next}</b></> : next != null ? <> &#183; next {next}</> : null}</span>
              <div role="group" aria-label="Reps on the last set" className="stepper sm">
                <button type="button" aria-label="Fewer reps" onClick={() => setReps(reps - 1)}>&#8722;</button>
                <label><span className="w-reps-n" aria-live="polite">{reps}</span></label>
                <button type="button" aria-label="More reps" onClick={() => setReps(reps + 1)}>+</button>
              </div>
            </div>
          ) : (
            <span className="mono11" style={{ textAlign: 'right', lineHeight: 1.4 }}>
              {L.sets} sets &#183; {repsOf(L)} reps{L.amrap ? ' \u00b7 amrap' : ''}
              <br /><span style={{ background: sug.why === 'up' ? C.chart : sug.why === 'deload' ? C.coral : C.white, padding: '1px 4px' }}>{hint}</span>
            </span>
          )}
        </div>
        <div className="w-load" aria-label={loadLabel || undefined}>
          {each && w != null && (
            <>
              <span className="mono9" aria-hidden="true">per hand</span>
              <span aria-hidden="true" className="w-db" style={{ background: col }}><i />{w}<i /></span>
              <span aria-hidden="true" className="w-db" style={{ background: col }}><i />{w}<i /></span>
              {offRack && <span className="mono9" aria-hidden="true" style={{ background: C.coral, padding: '1px 4px' }}>rack: {snap(w, step, 'down')} / {snap(w, step, 'up')}</span>}
              <span style={{ flexGrow: 1 }} />
              <span className="mono9" aria-hidden="true">{w * 2} total</span>
            </>
          )}
          {bar != null && w != null && (
            <>
              <span className="mono9" aria-hidden="true">per side</span>
              {!load ? <span className="mono10" aria-hidden="true">under the bar</span>
                : !load.side.length ? <span className="mono10" aria-hidden="true">bar only</span>
                : load.side.map((p, k) => (
                  <span key={k} aria-hidden="true" className="w-plate" style={{ background: DISC_COLOR[p] ?? C.white, color: p === 55 ? C.white : C.ink, height: 10 + Math.sqrt(p) * 1.6 }}>{p}</span>
                ))}
              {load && load.short > 0 && <span className="mono9" aria-hidden="true" style={{ background: C.coral, padding: '1px 4px' }}>{load.short} short</span>}
              <span style={{ flexGrow: 1 }} />
              <span className="mono9" aria-hidden="true">bar {bar}</span>
            </>
          )}
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
        <button type="button" className="w-go" onClick={advance}
          style={{ background: closes ? C.ink : toAbs ? C.yellow : C.chart, color: closes ? C.lime : C.ink }}>
          <span className="w-go-l">{goLabel}</span>
          <span className="w-go-n">{isCore ? `${abGot}/${abTotal}` : `${got}/${total}`}</span>
        </button>
      </div>

      <Nav current="plate" h={44} />
    </div>
  );
}
