import { C, MUSCLES, PLATES, PLATE_IDS, kindOf } from '../data';
import { DOW, addDays, ddmm, fromIso, hasWork, iso, isoWeek, useStore, weekStart } from '../store';
import { Chip, Nav, PlateLayers, Rail, Wipe } from '../ui';
import type { Tint } from '../ui';

const step = (n: number) => (n <= 0 ? null : n <= 5 ? C.yellow : n < 10 ? C.coral : C.peri);
const KIND: Record<string, string> = { Legs: C.mint, Pull: C.coral, Push: C.chart };
const fmt = (n: number) => (Number.isInteger(n) ? String(n).padStart(2, '0') : n.toFixed(1));
const PLAIN: Record<string, string> = {
  abs: 'abdomen', obl: 'flank', calf: 'calf', trap: 'trapezius', glute: 'buttock', ham: 'hamstring',
  quad: 'thigh', lat: 'back', pec: 'chest', bic: 'biceps', tri: 'triceps', delt: 'shoulder', rdelt: 'rear shoulder', sdelt: 'shoulder',
};
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

  const neglected = rows.filter((r) => r.n === 0);
  const coda = neglected.length === 0
    ? 'Every muscle accounted for. The plate is full.'
    : `The ${PLAIN[(neglected.find((r) => r.m.key === 'abs') ?? neglected[neglected.length - 1]).m.key]}, as is customary, remains unexamined.`;

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = iso(addDays(mon, i));
    const s = st.sessions[date];
    const t = date === st.today;
    const kind = s && hasWork(s) ? st.dayById(s.dayId).name.toUpperCase() : date < st.today ? 'REST' : '—';
    const kbg = s && hasWork(s) ? KIND[kindOf(st.dayById(s.dayId))] ?? C.chart : C.white;
    return { date, dow: DOW[addDays(mon, i).getDay()].toUpperCase(), kind, kbg, bg: t ? C.ink : C.white, fg: t ? C.lime : C.ink };
  });

  return (
    <div className="screen week">
      <Wipe colors={[C.chart, C.ink, C.coral, C.lav, C.mint, C.yellow]} chips={['Pl.', wk, 'surveying']} />
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

      <div className="wk-title">
        <span aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, width: 70, height: 74, background: C.coral }} />
        <span aria-hidden="true" style={{ position: 'absolute', left: 84, top: 6, width: 170, height: 64, background: C.chart }} />
        <span aria-hidden="true" style={{ position: 'absolute', left: 70, top: 78, width: 250, height: 64, background: C.chart }} />
        <span aria-hidden="true" style={{ position: 'absolute', left: 244, top: 0, width: 18, height: 18, background: C.yellow }} />
        <h1><span style={{ display: 'inline-block', width: 70, textAlign: 'center' }}>A</span> <span>Faithful</span><br /><span style={{ paddingLeft: 76 }}>Week.</span></h1>
      </div>
      <p style={{ margin: '2px 0 0', maxWidth: 300, fontSize: 15, lineHeight: 1.4 }}>
        Each muscle tinted by the working sets it received this week.
      </p>

      <ol aria-label="Sessions this week" className="wk-days">
        {days.map((d) => (
          <li key={d.date}>
            <span style={{ background: d.bg, color: d.fg }}>{d.dow}</span>
            <span style={{ background: d.kbg }}>{d.kind}</span>
          </li>
        ))}
      </ol>

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
          <span className="sw" style={{ background: step(n) ?? 'transparent' }} />
          <span className="wk-row-name">{m.name}</span>
          <span className="mono10" style={{ color: '#4A3A60' }}>pl. {m.plate}</span>
          <span className="wk-row-n">[ {fmt(n)} ]</span>
        </div>
      ))}
      <p className="mono10" style={{ margin: '10px 0 0', color: '#4A3A60' }}>completed sets · primary mover counts 1, assisting muscles &#189;</p>
      <p className="wk-coda">{coda}</p>
      <div style={{ marginTop: 8 }}><Nav order={['plate', 'week', 'edit', 'home']} current="week" /></div>
      <div className="foot">
        <Chip bg={C.chart}>Early Preview</Chip>
        <span className="mono10">wk {wk} &#183; {today.getFullYear()}</span>
      </div>
    </div>
  );
}
