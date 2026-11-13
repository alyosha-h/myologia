import { C, MUSCLES, PLATES, PLATE_IDS, kindOf, word } from '../data';
import { DOW, addDays, ddmm, fromIso, hasCore, hasWork, iso, isoWeek, useStore, weekStart } from '../store';
import { AbMeter, Chip, Nav, PlateLayers, Rail } from '../ui';
import type { Tint } from '../ui';

const step = (n: number) => (n <= 0 ? null : n <= 5 ? C.yellow : n < 10 ? C.coral : C.peri);
const KIND: Record<string, string> = { Legs: C.mint, Pull: C.coral, Push: C.chart };
const fmt = (n: number) => (Number.isInteger(n) ? String(n).padStart(2, '0') : n.toFixed(1));
const LABEL: Record<string, string> = { I: 'Fig. 1', II: 'Fig. 2', III: 'Pl. III', IV: 'Pl. IV' };
const VIEWS: Record<string, string> = { I: 'anterior', II: 'posterior', III: 'legs', IV: 'lateral' };

export default function Week() {
  const st = useStore();
  const today = fromIso(st.today);
  const mon = weekStart(today);
  const vol = st.weekVolume(mon);
  const wk = String(isoWeek(today)).padStart(2, '0');

  const tints: Record<string, Tint> = {};
  for (const [k, n] of Object.entries(vol)) { const c = step(n); if (c) tints[k] = { color: c, op: 0.95 }; }

  const rows = Object.values(MUSCLES)
    .map((m) => ({ m, n: vol[m.key] }))
    .sort((a, b) => b.n - a.n);

  const abWeek = st.coreWeek(mon), abOf = st.core.perWeek;
  const neglected = rows.filter((r) => r.n === 0);
  const coda = abOf > 0 && abWeek >= abOf
    ? `The abdomen, against all custom, examined ${word(abWeek)} times.`
    : neglected.length === 0
      ? 'Every muscle accounted for. The plate is full.'
      : null;

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = iso(addDays(mon, i));
    const s = st.sessions[date];
    const t = date === st.today;
    const kind = s && hasWork(s) ? st.dayById(s.dayId).name.toUpperCase() : date < st.today ? 'REST' : '—';
    const kbg = s && hasWork(s) ? KIND[kindOf(st.dayById(s.dayId))] ?? C.chart : C.white;
    return { date, dow: DOW[addDays(mon, i).getDay()].toUpperCase(), kind, kbg, ab: hasCore(s), bg: t ? C.ink : C.white, fg: t ? C.lime : C.ink };
  });

  return (
    <div className="screen week">
      <Rail n={14} cls="" style={{ position: 'absolute', right: 8, top: 300 }} />
      <span aria-hidden="true" style={{ position: 'absolute', left: 0, top: 560, width: 10, height: 40, background: C.chart }} />
      <span aria-hidden="true" style={{ position: 'absolute', right: 40, top: 470, width: 26, height: 12, background: C.coral }} />
      <span aria-hidden="true" style={{ position: 'absolute', left: 30, top: 760, width: 18, height: 18, background: '#E8DEFA' }} />

      <div className="wk-head">
        <div aria-label={`Plate ${wk}`} className="ltile" style={{ width: 68, height: 68, fontSize: 26, background: C.chart }}>
          <span>P</span><span>l</span><span>{wk[0]}</span><span>{wk[1]}</span>
        </div>
        <div className="wk-meta">
          <Chip>Hebdomadal survey</Chip>
          <div style={{ display: 'flex', gap: 4 }}>
            <Chip bg={C.mint}>{ddmm(mon)}</Chip><Chip bg={C.chart}>/</Chip><Chip bg={C.mint}>{ddmm(addDays(mon, 6))}</Chip>
          </div>
        </div>
      </div>

      <h1 className="hl wk-hl">
        <span style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
          <span className="blk" style={{ background: C.coral }}>The</span>
          <span className="blk" style={{ background: C.chart }}>Week,</span>
        </span>
        <span className="blk" style={{ marginLeft: 44, background: C.chart }}>Surveyed.</span>
      </h1>
      <p style={{ margin: '2px 0 0', maxWidth: 300, fontSize: 15, lineHeight: 1.4 }}>
        Each muscle tinted by the working sets it received this week.
      </p>

      <ol aria-label="Sessions this week" className="wk-days">
        {days.map((d) => (
          <li key={d.date}>
            <span style={{ background: d.bg, color: d.fg }}>{d.dow}</span>
            <span style={{ background: d.kbg }}>{d.kind}</span>
            {st.core.lifts.length > 0 && <span style={{ background: d.ab ? C.yellow : 'transparent' }}>{d.ab ? 'AB' : '\u00a0'}</span>}
          </li>
        ))}
      </ol>
      {st.core.lifts.length > 0 && (
        <div className="wk-ab" aria-label={`Ab work on ${abWeek} of ${abOf} days`}>
          <Chip bg={C.yellow}>Abdomen</Chip>
          <AbMeter n={abWeek} of={abOf} w={22} h={16} fill={C.yellow} />
          <b className="xb">{String(abWeek).padStart(2, '0')}<span style={{ opacity: 0.35 }}>/{String(abOf).padStart(2, '0')}</span></b>
          <span className="mono10" style={{ color: '#4A3A60' }}>{abWeek >= abOf ? 'quota met' : `${word(abOf - abWeek)} to go`}</span>
        </div>
      )}

      <figure className="wk-grid enter">
        {PLATE_IDS.map((p, i) => (
          <div key={p} style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: i > 1 ? 6 : 0 }}>
            <div className="wk-plate">
              <PlateLayers plate={p} tints={tints} fit="fill" pos="0 0" alt={`${PLATES[p].alt}, tinted by weekly sets`} />
            </div>
            <span className="wk-cap"><span style={{ background: C.white }}>{LABEL[p]}</span><span style={{ background: C.mint }}>{VIEWS[p]}</span></span>
          </div>
        ))}
      </figure>

      <div aria-label="Key to tints" className="wk-key">
        {[['none', 'transparent'], ['1–5', C.yellow], ['6–9', C.coral], ['10+', C.peri]].map(([l, bg]) => (
          <span key={l}><span style={{ background: bg }} /><span className="mono10">{l}</span></span>
        ))}
      </div>

      <div className="sec-h" style={{ margin: '24px 0 6px' }}>
        <h2>// SETS BY MUSCLE</h2><span className="rule" /><Chip>{rows.some((r) => r.n > 0) ? 'specimen data' : 'no specimen yet'}</Chip>
      </div>
      {rows.map(({ m, n }) => (
        <div key={m.key} className="wk-row">
          <span className="wk-row-name">{m.name}<small>pl. {m.plate}</small></span>
          <span aria-hidden="true" className="wk-bar">
            {Array.from({ length: 10 }, (_, j) => <i key={j} className={j < Math.ceil(n) ? '' : 'off'} style={{ background: j < Math.ceil(n) ? step(n)! : 'transparent' }} />)}
          </span>
          <span className={`wk-row-n ${n ? '' : 'zero'}`}>{fmt(n)}</span>
        </div>
      ))}
      <p className="mono10" style={{ margin: '10px 0 0', color: '#4A3A60' }}>completed sets · primary mover counts 1, assisting muscles &#189;</p>
      {coda && <p className="wk-coda">{coda}</p>}
      <div style={{ marginTop: 8 }}><Nav current="week" /></div>
      <div className="foot">
        <Chip bg={C.chart}>Early Preview</Chip>
        <span className="mono10">wk {wk} &#183; {today.getFullYear()}</span>
      </div>
    </div>
  );
}
