import { C, MUSCLES, PLATES, perHandOf, plateOfLift, repsOf, schemeOf, type Entry, type Lift } from '../data';
import { DOW, earned, fromIso, useStore } from '../store';
import { Chip, LetterTile, Nav, useSize } from '../ui';

type Outcome = 'earned' | 'hold' | 'short' | 'down' | 'open';

/** estimated one-rep max from the last set (Epley). only for sets of 15 or fewer, where it means something */
const e1rm = (w: number, r: number | null) => (r != null && r > 0 && r <= 15 ? Math.round(w * (1 + r / 30) * 2) / 2 : null);
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ''));

const OUT: Record<Outcome, { label: string; bg: string }> = {
  earned: { label: '↑ earned', bg: C.chart },
  hold: { label: 'hold', bg: C.white },
  short: { label: 'missed', bg: C.yellow },
  down: { label: '↓ lighter', bg: C.coral },
  open: { label: 'partial', bg: 'transparent' },
};

interface Row { date: string; dayId: string; e: Entry; w: number | null; done: number; reps: number | null; est: number | null; out: Outcome }

function rows(l: Lift, hist: { date: string; dayId: string; e: Entry }[]): Row[] {
  let prev: number | null = null;
  return hist.map(({ date, dayId, e }) => {
    const done = e.setsDone.filter(Boolean).length;
    const reps = e.reps ?? (done >= l.sets ? l.repMax : null);
    const w = e.weight;
    const out: Outcome = prev != null && w != null && w < prev ? 'down'
      : done < l.sets ? 'open'
      : earned(l, e) ? (l.inc > 0 ? 'earned' : 'hold')
      : 'short';
    if (w != null) prev = w;
    return { date, dayId, e, w, done, reps, est: w != null && w > 0 ? e1rm(w, reps) : null, out };
  });
}

/** weight as a stepped line (the bar only changes between sessions), estimated max dotted above it */
function Chart({ data, unit }: { data: Row[]; unit: string }) {
  const [ref, size] = useSize<HTMLDivElement>();
  const pts = data.filter((r) => r.w != null) as (Row & { w: number })[];
  const W = size.w || 400, H = 190, L = 34, R = 10, T = 14, B = 26;
  if (pts.length < 2) {
    return (
      <div ref={ref} className="h-chart h-empty">
        <p className="mono10">{pts.length ? 'one session so far. the line starts with the second.' : 'no sessions yet. the record begins at the first set.'}</p>
      </div>
    );
  }
  const vals = pts.flatMap((p) => (p.est != null ? [p.w, p.est] : [p.w]));
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const padY = Math.max((hi - lo) * 0.12, 5);
  lo = Math.max(0, lo - padY); hi = hi + padY;
  const x = (i: number) => L + (i / (pts.length - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const step = pts.map((p, i) => (i === 0 ? `M${x(0)},${y(p.w)}` : `H${x(i)}V${y(p.w)}`)).join('');
  const est = pts.map((p, i) => [i, p.est] as const).filter(([, v]) => v != null) as [number, number][];
  const ticks = [lo, (lo + hi) / 2, hi].map((v) => Math.round(v / 5) * 5);
  const every = Math.ceil(pts.length / 6);
  return (
    <div ref={ref} className="h-chart">
      <svg width={W} height={H} role="img" aria-label={`Weight over ${pts.length} sessions, from ${fmt(pts[0].w)} to ${fmt(pts[pts.length - 1].w)} ${unit}`}>
        {ticks.map((v, k) => (
          <g key={k}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={C.ink} strokeOpacity={0.25} strokeDasharray="2 3" />
            <text x={L - 5} y={y(v) + 3} textAnchor="end" className="h-tick">{v}</text>
          </g>
        ))}
        {est.length > 1 && (
          <polyline points={est.map(([i, v]) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={C.peri} strokeWidth={1.5} strokeDasharray="1 4" strokeLinecap="round" />
        )}
        <path d={step} fill="none" stroke={C.ink} strokeWidth={2} />
        {pts.map((p, i) => {
          const o = OUT[p.out];
          return <rect key={p.date} x={x(i) - 4} y={y(p.w) - 4} width={8} height={8} fill={o.bg === 'transparent' ? C.lime : o.bg} stroke={C.ink} strokeWidth={1} strokeDasharray={p.out === 'open' ? '2 1' : undefined} />;
        })}
        {pts.map((p, i) => ((i % every === 0 && x(pts.length - 1) - x(i) > 40) || i === pts.length - 1) && (
          <text key={`d${p.date}`} x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'} className="h-tick">
            {p.date.slice(8)}.{p.date.slice(5, 7)}
          </text>
        ))}
      </svg>
      <div className="h-legend mono9">
        <span><i style={{ background: C.ink, height: 2 }} />weight</span>
        {est.length > 1 && <span><i style={{ borderTop: `2px dotted ${C.peri}`, height: 0 }} />est. max</span>}
        <span><i className="sq" style={{ background: C.chart }} />earned</span>
        <span><i className="sq" style={{ background: C.yellow }} />missed</span>
        <span><i className="sq" style={{ background: C.coral }} />lighter</span>
      </div>
    </div>
  );
}

export default function History() {
  const st = useStore();
  const id = decodeURIComponent(location.hash.split('/')[2] ?? '');
  const l = st.lifts[id];

  if (!l) {
    return (
      <div className="screen hist">
        <p style={{ fontSize: 20 }}>No such lift.</p>
        <a href="#/edit" className="mono11">all lifts &#8594;</a>
        <div style={{ marginTop: 16 }}><Nav current="lift" /></div>
      </div>
    );
  }

  const each = perHandOf(l);
  const unit = each ? 'lb ea' : 'lb';
  const data = rows(l, st.history(id));
  const weighed = data.filter((r) => r.w != null) as (Row & { w: number })[];
  const best = weighed.reduce<(Row & { w: number }) | null>((a, r) => (!a || r.w > a.w ? r : a), null);
  const bestEst = data.reduce<Row | null>((a, r) => (r.est != null && (!a || r.est > (a.est ?? 0)) ? r : a), null);
  const sets = data.reduce((a, r) => a + r.done, 0);
  const sug = st.suggest(id, st.today);
  const first = data[0], lastW = weighed[weighed.length - 1];
  const gain = weighed.length > 1 ? weighed[weighed.length - 1].w - weighed[0].w : null;
  const plate = plateOfLift(l);
  const days = st.days.filter((d) => d.lifts.includes(id)).map((d) => d.name);
  const dayName = (dayId: string) => (dayId === 'core' ? 'Abs' : st.days.find((d) => d.id === dayId)?.name ?? '—');
  const short = (iso: string) => { const d = fromIso(iso); return `${DOW[d.getDay()]} ${iso.slice(8)}.${iso.slice(5, 7)}`; };

  return (
    <div className="screen hist">
      <header className="h-head">
        <button type="button" className="h-back" onClick={() => (history.length > 1 ? history.back() : (location.hash = '#/plate'))} aria-label="Back">&#8592;</button>
        <LetterTile letters={['P', 'l', plate]} label={`Plate ${plate}`} />
        <span style={{ flexGrow: 1 }} />
        <div className="wk-meta" style={{ paddingRight: 0 }}>
          <Chip>Case history</Chip>
          <div style={{ display: 'flex', gap: 3 }}>
            <Chip bg={C.lav}>{schemeOf(l)}</Chip>
            <Chip bg={C.mint}>{each ? 'per hand' : PLATES[plate].view}</Chip>
          </div>
        </div>
      </header>

      <div className="h-title">
        <span aria-hidden="true" style={{ position: 'absolute', left: -4, top: 6, width: 64, height: 46, background: C.coral }} />
        <h1>{l.name}</h1>
        <p className="mono10" style={{ margin: '4px 0 0', position: 'relative' }}>
          {MUSCLES[l.hit[0]]?.short}{l.hit.length > 1 ? `, with ${l.hit.slice(1).map((k) => MUSCLES[k]?.short).join(', ')}` : ''}
          {days.length > 0 && <> &#183; {days.join(', ')}</>}
        </p>
      </div>

      <dl className="h-stats">
        <div style={{ background: sug.why === 'up' ? C.chart : sug.why === 'deload' ? C.coral : C.white }}>
          <dt className="mono9">next</dt>
          <dd>{sug.weight != null ? fmt(sug.weight) : '—'}</dd>
          <span className="mono9">{sug.why === 'up' ? `earned, +${fmt((sug.weight ?? 0) - (sug.from ?? 0))}` : sug.why === 'deload' ? 'deload, −10%' : sug.why === 'hold' ? 'hold' : sug.why === 'start' ? 'start weight' : 'bodyweight'}</span>
        </div>
        <div>
          <dt className="mono9">heaviest</dt>
          <dd>{best ? fmt(best.w) : '—'}</dd>
          <span className="mono9">{best ? short(best.date) : 'not yet'}</span>
        </div>
        <div>
          <dt className="mono9">est. max</dt>
          <dd>{bestEst?.est != null ? fmt(bestEst.est) : '—'}</dd>
          <span className="mono9">{bestEst ? `${fmt(bestEst.w ?? 0)} × ${bestEst.reps}` : 'needs a last set'}</span>
        </div>
        <div>
          <dt className="mono9">since {first ? first.date.slice(8) + '.' + first.date.slice(5, 7) : '—'}</dt>
          <dd>{gain != null ? `${gain >= 0 ? '+' : '−'}${fmt(Math.abs(gain))}` : '—'}</dd>
          <span className="mono9">{sets} sets, {data.length}&#215;</span>
        </div>
      </dl>
      <p className="mono9" style={{ margin: '4px 0 0', color: '#4A3A60' }}>{unit}. est. max = last set weight &#215; (1 + reps / 30).</p>

      <Chart data={data} unit={unit} />

      <div className="sec-h" style={{ margin: '20px 0 6px' }}>
        <h2>// SESSIONS</h2><span className="rule" /><Chip>{data.length ? `${data.length} on record` : 'none yet'}</Chip>
      </div>
      {data.length === 0 && <p className="mono10">nothing logged for this lift yet.</p>}
      <ol className="h-rows">
        {[...data].reverse().map((r) => {
          const o = OUT[r.out];
          return (
            <li key={r.date}>
              <span className="mono10 h-date">{short(r.date)}<br /><span style={{ color: '#4A3A60' }}>{dayName(r.dayId)}</span></span>
              <span className="h-w">{r.w != null ? fmt(r.w) : '—'}<span className="mono9"> {r.w != null ? unit : ''}</span></span>
              <span className="mono10 h-sets">
                {r.done}/{l.sets} sets
                <br />{r.reps != null && r.done >= l.sets ? `last ${r.reps}` : repsOf(l)}
              </span>
              <span className="mono9 h-out" style={{ background: o.bg, border: o.bg === 'transparent' ? `1px dashed ${C.ink}` : undefined }}>{o.label}</span>
            </li>
          );
        })}
      </ol>
      {lastW && l.inc > 0 && (
        <p className="mono10" style={{ margin: '12px 0 0', lineHeight: 1.5, color: '#4A3A60' }}>
          the rule: all {l.sets} sets, and {l.repMax} on the last, earns +{fmt(l.inc)}. three missed sessions at one weight back off 10%.
        </p>
      )}

      <div style={{ marginTop: 18 }}><Nav current="lift" /></div>
    </div>
  );
}
