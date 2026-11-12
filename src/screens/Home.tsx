import { useEffect, useRef, useState } from 'react';
import { C, MUSCLES, PLATES, PLATE_IDS, asset, cap, plateOfDay, plateOfLift, word, OPENED, OPENING, type PlateId } from '../data';
import { DOW, addDays, ddmm, fromIso, hasWork, iso, setsDoneIn, useStore, weekStart } from '../store';
import { Barcode, Chip, Nav, PlateLayers, Rail, Reg, useCount } from '../ui';
import type { Tint } from '../ui';

const MOON: Record<PlateId, { pos: string; tints: [string, string][]; name: string; color: string }> = {
  I: { pos: '50% 30%', name: 'The Push', color: C.coral, tints: [['pec', C.coral], ['delt', C.dlav], ['tri', C.chart]] },
  II: { pos: '50% 32%', name: 'The Pull', color: C.dlav, tints: [['trap', C.dlav], ['lat', C.coral], ['rdelt', C.chart]] },
  III: { pos: '50% 34%', name: 'The Legs', color: C.chart, tints: [['quad', C.chart], ['ham', C.coral], ['glute', C.dlav], ['calf', C.mint]] },
  IV: { pos: '58% 30%', name: 'The Arm', color: C.mint, tints: [['sdelt', C.dlav], ['bic', C.coral]] },
};

const MOTTOS = [
  { t: 'A', a: 'Faithful', b: 'Body.', pad: 96 },
  { t: 'The', a: 'Body,', b: 'Opened.', pad: 60 },
  { t: 'Sic', a: 'itur ad', b: 'astra.', pad: 90 },
  { t: 'The', a: 'Flesh,', b: 'Annotated.', pad: 0 },
  { t: 'A', a: 'Plate', b: 'a Day.', pad: 96 },
  { t: 'Per', a: 'ardua', b: 'ad astra.', pad: 30 },
];

function Motto() {
  const [hi, setHi] = useState(0);
  const [out, setOut] = useState(false);
  const iv = useRef<number>(0), to = useRef<number>(0);
  const advance = () => {
    setOut(true);
    clearTimeout(to.current);
    to.current = window.setTimeout(() => { setHi((h) => (h + 1) % MOTTOS.length); setOut(false); }, 430);
  };
  const start = () => { clearInterval(iv.current); iv.current = window.setInterval(advance, 4200); };
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    start();
    return () => { clearInterval(iv.current); clearTimeout(to.current); };
  }, []);
  const h = MOTTOS[hi];
  return (
    <h1 className="motto">
      <button type="button" className={`hl ${out ? 'h-out' : ''}`} onClick={() => { advance(); start(); }}
        aria-label={`${h.t} ${h.a} ${h.b}, tap for another motto`}>
        <span style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
          <span className="blk b1" style={{ backgroundImage: `linear-gradient(${C.lime},${C.lime})` }}><span className="txt">{h.t}</span></span>
          <span className="blk b2" style={{ backgroundImage: `linear-gradient(${C.chart},${C.chart})` }}><span className="txt">{h.a}</span></span>
        </span>
        <span className="blk b3" style={{ marginLeft: h.pad, backgroundImage: `linear-gradient(${C.chart},${C.chart})` }}><span className="txt">{h.b}</span></span>
      </button>
    </h1>
  );
}

export default function Home() {
  const st = useStore();
  const { today, lifts } = st;
  const session = st.sessionFor(today);
  const day = st.dayById(session.dayId);
  const todayPlate = plateOfDay(day, lifts);
  const [sel, setSel] = useState<PlateId>(todayPlate);
  useEffect(() => setSel(todayPlate), [todayPlate]);

  const d = fromIso(today);
  const dayLifts = day.lifts.map((id) => lifts[id]).filter(Boolean);
  const totalSets = dayLifts.reduce((a, l) => a + l.sets, 0);
  const doneSets = dayLifts.reduce((a, l) => a + Math.min(l.sets, setsDoneIn(session, l.id)), 0);
  const plates = new Set(dayLifts.map(plateOfLift));

  // muscles of the opened plate, primaries first
  const ordered: string[] = [];
  for (const pass of [0, 1]) for (const l of dayLifts) l.hit.forEach((m, j) => {
    if ((pass === 0) === (j === 0) && MUSCLES[m].plate === todayPlate && !ordered.includes(m)) ordered.push(m);
  });
  const prose = cap(ordered.map((m) => MUSCLES[m].phrase).join(', ')) + '.';
  const spoken = `${word(dayLifts.length)} lifts, ${word(totalSets)} sets, ${word(plates.size)} plate${plates.size > 1 ? 's' : ''}`;
  const p2 = (v: number) => String(v).padStart(2, '0');
  const cLifts = useCount(dayLifts.length, 900), cSets = useCount(doneSets > 0 ? doneSets : totalSets, 1000), cPlates = useCount(plates.size, 1100);

  const sealed = session.sealed;
  const started = doneSets > 0;

  const moon = MOON[sel];
  const tints: Record<string, Tint> = {};
  moon.tints.forEach(([k, c], i) => { tints[k] = { color: c, op: 1, cls: 'tint', delay: `${(0.5 + i * 0.35).toFixed(2)}s, ${(1.4 + i * 0.35).toFixed(2)}s` }; });

  // 7-day strip, this week
  const mon = weekStart(d);
  const future = st.plannedDays(today, 7);
  const strip = Array.from({ length: 7 }, (_, i) => {
    const date = iso(addDays(mon, i));
    const s = st.sessions[date];
    const t = date === today, past = date < today;
    let num = '·', bg = 'transparent', border = `1px dashed ${C.ink}`;
    if (t) { num = todayPlate; bg = C.ink; border = `1px solid ${C.ink}`; }
    else if (past) {
      border = `1px solid ${C.ink}`;
      if (s && hasWork(s)) { const p = plateOfDay(st.dayById(s.dayId), lifts); num = p; bg = MOON[p].color; }
    } else {
      const k = Math.round((fromIso(date).getTime() - d.getTime()) / 86400000);
      num = plateOfDay(future[k], lifts);
    }
    return { date, dow: DOW[addDays(mon, i).getDay()].toUpperCase(), num, bg, border, t, fg: t ? C.lime : C.ink, delay: `${(0.9 + i * 0.07).toFixed(2)}s` };
  });

  const n = st.sessionNumber(today);

  return (
    <div className="screen home">

      <header className="masthead">
        <div aria-hidden="true" className="ltile" style={{ width: 44, height: 44, fontSize: 18, background: C.chart, color: C.ink }}>
          <span>M</span><span>y</span><span>o</span><span>l</span>
        </div>
        <span className="wordmark">
          <b className="xb">Myologia</b>
          <span className="mono9" style={{ letterSpacing: '0.08em' }}>VOL. I &#183; 1851 / {d.getFullYear()}<span className="blink" aria-hidden="true">&#9613;</span></span>
        </span>
        <span style={{ display: 'flex', gap: 3 }}>
          <Chip bg={C.peri} fg={C.white} cls="flk">A</Chip>
          <Chip bg={C.coral} cls="cycbg">{String(n).padStart(2, '0')}</Chip>
        </span>
      </header>

      <section aria-label="Frontispiece" className="hero" style={{ background: moon.color }}>
        <Reg style={{ left: 12, top: 14 }} /><Reg style={{ right: 12, top: 14 }} />
        <Reg style={{ left: 12, bottom: 16 }} /><Reg style={{ right: 12, bottom: 16 }} />
        <Rail n={5} style={{ position: 'absolute', left: 12, top: 400 }} />
        <Rail n={5} style={{ position: 'absolute', right: 12, top: 400 }} />
        <span className="cyc jit" aria-hidden="true" style={{ position: 'absolute', left: 60, bottom: 76, width: 22, height: 22, animationDelay: '2.2s, 1s' }} />
        <span className="cyc" aria-hidden="true" style={{ position: 'absolute', right: 40, bottom: 120, width: 40, height: 12, animationDelay: '3.3s' }} />
        <span aria-hidden="true" className="moon-ring" />

        <div className="hero-top"><Chip>Myologia</Chip><Chip bg={C.chart}>/</Chip><Chip>Exercitationis</Chip></div>

        <div className="moon">
          <div key={sel} className="iris-soft layer">
            <div className="drift layer">
              <PlateLayers plate={sel} tints={tints} pos={moon.pos} />
            </div>
          </div>
        </div>

        <Motto />
        <span className="cyc" aria-hidden="true" style={{ position: 'absolute', right: 30, top: 306, width: 18, height: 18, animationDelay: '.5s' }} />

        <div className="hero-foot">
          <Chip>Plate</Chip><Chip bg={C.ink} fg={C.lime} cls="flk">{sel}</Chip>
          <Chip bg={C.mint}>{PLATES[sel].view}</Chip><Chip bg={C.chart} cls="flk2">{MOON[sel].name.slice(4).toLowerCase()}</Chip>
        </div>
      </section>

      <section aria-label="Today" className="today-sec">
        <div className="boot">
          <div>
            <span><span className="bootn">1</span><Chip bg={C.mint}>+</Chip><Chip bg={C.coral} cls="flk">Booting</Chip></span>
            <span><span className="bootn">2</span><Chip bg={C.mint}>+</Chip><Chip bg={C.lav} cls="flk2">Main power</Chip></span>
            <span><span className="bootn">3</span><Chip bg={C.mint}>+</Chip><Chip>{DOW[d.getDay()]} {ddmm(d)}</Chip></span>
          </div>
          <div style={{ alignItems: 'flex-start' }}>
            <span className="chips3"><Chip bg={C.chart}>Split</Chip><Chip bg={C.lav}>/</Chip><Chip>{day.name}</Chip></span>
            <span className="chips3"><Chip bg={C.coral}>Session</Chip><Chip bg={C.chart}>{String(n).padStart(3, '0')}</Chip></span>
            <span className="chips3"><Chip bg={C.peri} fg={C.white}>Plate</Chip><Chip>{todayPlate}</Chip></span>
          </div>
        </div>
        <div style={{ position: 'relative', paddingTop: 6 }}>
          <span className="slide" aria-hidden="true" style={{ position: 'absolute', left: -4, top: 0, width: 96, height: 44, background: C.lav }} />
          <span className="cyc jit" aria-hidden="true" style={{ position: 'absolute', left: 150, top: 30, width: 16, height: 16, mixBlendMode: 'multiply', animationDelay: '1.7s, .4s' }} />
          <h2 className="today-h">Today,<br />{sealed ? OPENED[todayPlate] : OPENING[todayPlate]}</h2>
        </div>
        <p className="today-p">
          {prose}
        </p>
        <p className="stats" aria-label={spoken}>
          <span><b className="xb">{p2(cLifts)}</b><em className="cn">lifts</em></span>
          <span><b className="xb">{started ? <>{p2(cSets)}<span style={{ opacity: 0.35 }}>/{totalSets}</span></> : p2(cSets)}</b><em className="cn">{started ? 'sets done' : 'sets'}</em></span>
          <span><b className="xb">{p2(cPlates)}</b><em className="cn">plate{plates.size > 1 ? 's' : ''}</em></span>
        </p>
        <a href="#/plate" className="cta">
          <span className="cycbg cta-n">{todayPlate}</span>
          <span className="cta-l">{sealed ? 'Review the plate' : started ? 'Resume the plate' : 'Open the plate'}<span className="hop" aria-hidden="true" /><span className="hop hop2" aria-hidden="true" /></span>
          <span className="cta-r"><span className="blink">ESC</span>&#8594;</span>
        </a>
      </section>

      <section aria-label="Table of plates" className="toc">
        <div className="sec-h">
          <h2>// TABLE OF PLATES</h2><span className="rule" style={{ borderColor: C.lime, opacity: 0.6 }} /><Chip bg={C.chart}>IV</Chip>
        </div>
        <div className="toc-grid">
          {PLATE_IDS.map((p) => {
            const s = p === sel, isToday = p === todayPlate;
            return (
              <button key={p} type="button" onClick={() => setSel(p)} aria-pressed={s} aria-label={`Plate ${p}, ${MOON[p].name}${s ? ', shown' : ''}`}>
                <span className="thumb" style={{ background: MOON[p].color, outline: s ? `2px solid ${C.lime}` : 'none' }}>
                  <img src={asset(PLATES[p].file)} alt="" style={{ objectPosition: MOON[p].pos }} />
                  <span className={s ? 'blink' : ''} aria-hidden="true" style={s ? { animationDuration: '1.6s' } : undefined}>{p}</span>
                </span>
                <span className="toc-cap">
                  <span className="toc-name">{MOON[p].name}</span>
                  <span className="mono10" style={{ color: isToday ? C.chart : '#C9BFB4' }}>{isToday ? 'today' : MOON[p].name.slice(4).toLowerCase()}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-label="This week" className="hebd">
        <div className="sec-h">
          <h2>// HEBDOMADAL</h2><span className="rule" /><a href="#/week" className="mono11 link44">survey &#8594;</a>
        </div>
        <ol className="strip7">
          {strip.map((x) => (
            <li key={x.date} className="rise" style={{ animationDelay: x.delay }}>
              <span className={x.t ? 'today-pulse' : ''} style={{ background: x.bg, border: x.border, color: x.fg }}>{x.num}</span>
              <span className="mono10" style={{ textAlign: 'center' }}>{x.dow}</span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="Motto" className="coda">
        <span className="dots" aria-hidden="true" />
        <p lang="la" className="coda-la">Hic locus est ubi mors gaudet succurrere vitae.</p>
        <p className="mono11" style={{ position: 'relative', margin: 0, lineHeight: 1.5, maxWidth: 300 }}>
          This is the place where death delights to help the living. Over the door of the anatomy theatre.
        </p>
        <div style={{ marginTop: 8 }}><Nav order={['home', 'plate', 'week', 'edit']} current="home" /></div>
        <div className="foot">
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Barcode code={`MYO-${today}`} /><Chip bg={C.lav}>Early Preview</Chip></span>
          <a href="#/masks" className="mono10" style={{ color: C.ink }}>mask test &#8594;</a>
        </div>
      </section>
    </div>
  );
}
