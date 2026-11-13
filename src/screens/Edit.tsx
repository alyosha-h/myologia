import { useState } from 'react';
import { C, DAY_COLOR, MUSCLES, DISC_COLOR, dbStep, perHandOf, saveDbStep, PLATE_IDS, PLATE_SIZES, PLATES, barOf, kindOf, platesOnHand, savePlatesOnHand, palFor, repsOf, schemeOf, slug, type Day, type Lift } from '../data';
import { useStore } from '../store';
import { Chip, Nav } from '../ui';

const PRIMARY_FOR: Record<string, string> = { Push: 'pec', Pull: 'lat', Legs: 'quad' };
/** the ab work, edited like a day but kept out of the rotation */
const CORE = 'core';

/** − value + ; null shows as "—" */
function Num({ label, value, step, min = 0, max = 999, onChange, nullable = false, unit, base = 0 }: {
  label: string; value: number | null; step: number; min?: number; max?: number;
  onChange: (v: number | null) => void; nullable?: boolean; unit?: string;
  /** what + gives from empty */ base?: number;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, Math.round(v * 100) / 100));
  return (
    <div className="ed-num">
      <span className="mono9">{label}</span>
      <div role="group" aria-label={label} className="stepper sm">
        <button type="button" aria-label={`Less ${label}`}
          onClick={() => onChange(value == null ? null : nullable && value - step < min ? null : clamp(value - step))}>&#8722;</button>
        <label>
          <input inputMode="decimal" aria-label={label} value={value ?? ''} placeholder="&#8212;"
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => {
              const t = e.target.value.trim();
              if (t === '') return onChange(nullable ? null : min);
              const n = Number(t);
              if (Number.isFinite(n)) onChange(clamp(n));
            }} />
          {unit && <span className="mono9">{unit}</span>}
        </label>
        <button type="button" aria-label={`More ${label}`} onClick={() => onChange(value == null && base ? base : clamp((value ?? 0) + step))}>+</button>
      </div>
    </div>
  );
}

function LiftForm({ lift, sharedWith, onSave }: { lift: Lift; sharedWith: string[]; onSave: (l: Lift) => void }) {
  const set = (p: Partial<Lift>) => onSave({ ...lift, ...p });
  const prim = lift.hit[0];
  const sec = lift.hit.slice(1);
  return (
    <div className="ed-form">
      <label className="ed-field">
        <span className="mono9">name</span>
        <input value={lift.name} onChange={(e) => set({ name: e.target.value })} />
      </label>
      <div className="ed-row">
        <Num label="sets" value={lift.sets} step={1} min={1} max={10} onChange={(v) => set({ sets: v ?? 1 })} />
        <Num label="reps from" value={lift.repMin} step={1} min={1} max={50}
          onChange={(v) => set({ repMin: v ?? 1, repMax: Math.max(lift.repMax, v ?? 1) })} />
        <Num label="to" value={lift.repMax} step={1} min={1} max={50}
          onChange={(v) => set({ repMax: v ?? 1, repMin: Math.min(lift.repMin, v ?? 1) })} />
      </div>
      <div className="ed-row">
        <Num label={perHandOf(lift) ? 'start weight, each' : 'start weight'} value={lift.start} step={perHandOf(lift) ? dbStep() : 2.5} nullable unit="lb" onChange={(v) => set({ start: v })} />
        <Num label="add when earned" value={lift.inc} step={2.5} max={50} unit="lb" onChange={(v) => set({ inc: v ?? 0 })} />
        {!perHandOf(lift) && <Num label="bar" value={barOf(lift)} step={5} max={100} nullable base={45} unit="lb" onChange={(v) => set({ bar: v })} />}
      </div>
      <p className="mono10 ed-rule">
        {lift.inc > 0
          ? <>all {lift.sets} sets done and {lift.repMax} reps on the last set &#8594; +{lift.inc} lb next time. three misses at one weight &#8594; &#8722;10%.</>
          : <>no automatic increase. weight carries over from last time.</>}
        {' '}{perHandOf(lift) ? <>dumbbells: logged per hand; increases round up to the next dumbbell on the rack ({dbStep()} lb apart).</>
          : barOf(lift) != null ? <>plates per side are worked out on a {barOf(lift)} lb bar.</> : <>no bar, so no plate math (bar &#8212; for dumbbells, cables, machines).</>}
      </p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button type="button" className="mtog" aria-pressed={perHandOf(lift)} onClick={() => set({ perHand: !perHandOf(lift) })}
          style={{ background: perHandOf(lift) ? C.mint : 'transparent' }}>
          dumbbells, per hand {perHandOf(lift) ? '✓' : ''}
        </button>
        <button type="button" className="mtog" aria-pressed={!!lift.amrap} onClick={() => set({ amrap: !lift.amrap })}
          style={{ background: lift.amrap ? C.chart : 'transparent' }}>
          last set amrap {lift.amrap ? '✓' : ''}
        </button>
      </div>
      <label className="ed-field">
        <span className="mono9">primary muscle (picks the plate)</span>
        <select value={prim} onChange={(e) => set({ hit: [e.target.value, ...sec.filter((k) => k !== e.target.value)] })}>
          {PLATE_IDS.map((p) => (
            <optgroup key={p} label={`Plate ${p}, ${PLATES[p].view}`}>
              {PLATES[p].masks.map((k) => <option key={k} value={k}>{MUSCLES[k].name}</option>)}
            </optgroup>
          ))}
        </select>
      </label>
      <div className="ed-field">
        <span className="mono9">also works (counts &#189; a set each)</span>
        <div className="ed-chips">
          {Object.values(MUSCLES).filter((m) => m.key !== prim).map((m) => {
            const on = sec.includes(m.key);
            return (
              <button key={m.key} type="button" className="mtog" aria-pressed={on}
                onClick={() => set({ hit: [prim, ...(on ? sec.filter((k) => k !== m.key) : [...sec, m.key])] })}
                style={{ background: on ? C.lav : 'transparent' }}>
                {m.short}
              </button>
            );
          })}
        </div>
      </div>
      <label className="ed-field">
        <span className="mono9">note</span>
        <input value={lift.note ?? ''} placeholder="&#8212;" onChange={(e) => set({ note: e.target.value || undefined })} />
      </label>
      <a href={`#/lift/${encodeURIComponent(lift.id)}`} className="mtog" style={{ alignSelf: 'flex-start', color: C.ink, textDecoration: 'none', background: C.white }}>history &#8594;</a>
      {sharedWith.length > 0 && (
        <p className="mono10 ed-rule">also on {sharedWith.join(', ')}. it&#8217;s one lift: edits and progress apply to every day it&#8217;s on.</p>
      )}
    </div>
  );
}

function PlatesOnHand() {
  const [on, setOn] = useState(platesOnHand);
  const [rack, setRack] = useState(dbStep);
  const toggle = (p: number) => {
    const next = on.includes(p) ? on.filter((x) => x !== p) : [...on, p].sort((a, b) => b - a);
    setOn(next); savePlatesOnHand(next);
  };
  return (
    <div style={{ marginTop: 22 }}>
      <span className="mono9">dumbbells on the rack go up in (this device)</span>
      <div className="ed-chips" style={{ marginTop: 6, marginBottom: 14 }}>
        {[2.5, 5].map((v) => (
          <button key={v} type="button" className="mtog" aria-pressed={rack === v} onClick={() => { setRack(v); saveDbStep(v); }}
            style={{ background: rack === v ? C.mint : 'transparent', minWidth: 52, borderWidth: rack === v ? 2 : 1, borderStyle: rack === v ? 'solid' : 'dashed' }}>
            {v} lb
          </button>
        ))}
      </div>
      <span className="mono9">plates on hand (lb, pairs, this device)</span>
      <div className="ed-chips" style={{ marginTop: 6 }}>
        {PLATE_SIZES.map((p) => {
          const s = on.includes(p);
          return (
            <button key={p} type="button" className="mtog" aria-pressed={s} onClick={() => toggle(p)}
              style={{ background: s ? DISC_COLOR[p] : 'transparent', color: s && p === 55 ? C.white : C.ink, minWidth: 44, borderWidth: s ? 2 : 1, borderStyle: s ? 'solid' : 'dashed' }}>
              {p}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CloudSync() {
  const st = useStore();
  const [code, setCode] = useState('');
  const [bad, setBad] = useState(false);
  const link = async (c?: string) => {
    setBad(false);
    const ok = await st.linkCloud(c);
    if (!ok) setBad(true);
  };
  const statusText = { off: 'off', syncing: 'syncing…', synced: 'synced', offline: 'offline — will retry on the next change' }[st.cloudStatus];
  return (
    <div style={{ marginTop: 22 }}>
      <span className="mono9">cloud sync</span>
      {st.cloudCode ? (
        <>
          <p className="mono10 ed-rule" style={{ marginTop: 6 }}>
            this device is linked. your sync code is your password — enter it on another device to pick up the same log.
          </p>
          <p className="mono10" style={{ margin: '8px 0', wordBreak: 'break-all' }}>
            code: <span style={{ background: C.mint, padding: '1px 5px' }}>{st.cloudCode}</span> &#183; {statusText}
          </p>
          <div className="ed-foot" style={{ marginTop: 8 }}>
            <button type="button" className="mtog" onClick={() => void st.syncNow()}>sync now</button>
            <button type="button" className="mtog" onClick={() => { if (confirm('Stop syncing this device? The cloud copy stays; this device just stops updating it.')) void st.unlinkCloud(); }}>unlink</button>
          </div>
        </>
      ) : (
        <>
          <p className="mono10 ed-rule" style={{ marginTop: 6 }}>
            the log lives on this device only. link it to a sync code and it follows you — same system as the other apps.
          </p>
          <label className="ed-field" style={{ marginTop: 8 }}>
            <span className="mono9">have a code already?</span>
            <input value={code} placeholder="myologia-…" onChange={(e) => setCode(e.target.value)} autoCapitalize="none" autoCorrect="off" />
          </label>
          {bad && <p className="mono10" style={{ color: '#B33' }}>that code doesn&#8217;t parse — 6–64 letters, numbers and dashes.</p>}
          <div className="ed-foot" style={{ marginTop: 8 }}>
            <button type="button" className="mtog" onClick={() => void link(code || undefined)} disabled={!code.trim()}>link this code</button>
            <button type="button" className="mtog" onClick={() => void link()}>start syncing (new code)</button>
          </div>
        </>
      )}
    </div>
  );
}

export default function Edit() {
  const st = useStore();
  const { days, lifts } = st;
  const [sel, setSel] = useState(() => st.sessionFor(st.today).dayId);
  const [open, setOpen] = useState<string | null>(null);
  const isCore = sel === CORE;
  const day: Day = isCore
    ? { id: CORE, name: 'Abs', title: 'The Abdomen.', color: C.yellow, lifts: st.core.lifts }
    : days.find((d) => d.id === sel) ?? days[0];
  const dayLifts = day.lifts.map((id) => lifts[id]).filter(Boolean);

  const saveDay = (d: Day) => (isCore
    ? st.saveCore({ ...st.core, lifts: d.lifts })
    : st.saveDays(days.map((x) => (x.id === d.id ? d : x))));
  const move = (j: number, by: number) => {
    const ls = day.lifts.slice();
    const k = j + by;
    if (k < 0 || k >= ls.length) return;
    [ls[j], ls[k]] = [ls[k], ls[j]];
    saveDay({ ...day, lifts: ls });
  };
  const remove = (id: string) => { saveDay({ ...day, lifts: day.lifts.filter((x) => x !== id) }); setOpen(null); };
  const addNew = () => {
    const id = `lift-${Date.now().toString(36)}`;
    st.saveLift(isCore
      ? { id, name: 'New ab lift', sets: 3, repMin: 10, repMax: 15, inc: 0, start: null, hit: ['abs'] }
      : { id, name: 'New lift', sets: 3, repMin: 8, repMax: 12, inc: 2.5, start: null, hit: [PRIMARY_FOR[kindOf(day)] ?? 'pec'] });
    saveDay({ ...day, lifts: [...day.lifts, id] });
    setOpen(id);
  };
  const addExisting = (id: string) => { if (id && !day.lifts.includes(id)) saveDay({ ...day, lifts: [...day.lifts, id] }); };
  const addDay = () => {
    const id = `day-${Date.now().toString(36)}`;
    st.saveDays([...days, { id, name: 'New day', title: 'The Day.', color: C.mint, lifts: [] }]);
    setSel(id);
  };
  const removeDay = () => {
    if (days.length < 2 || !confirm(`Remove ${day.name} from the rotation? Logged sessions stay.`)) return;
    const k = days.findIndex((d) => d.id === day.id);
    st.saveDays(days.filter((d) => d.id !== day.id));
    setSel(days[k === 0 ? 1 : k - 1].id);
  };
  const reset = async () => {
    if (!confirm('Put back the PPL split from the spreadsheet? Your logged sessions stay, edits to lifts and days are replaced.')) return;
    await st.resetProgram();
    setOpen(null);
  };

  const others = Object.values(lifts)
    .filter((l) => !day.lifts.includes(l.id) && days.some((d) => d.lifts.includes(l.id)))
    .sort((a, b) => a.name.localeCompare(b.name));
  const nLifts = new Set(days.flatMap((d) => d.lifts)).size;

  return (
    <div className="screen edit">
      <div className="wk-head">
        <div aria-label="Lifts" className="ltile" style={{ width: 68, height: 68, fontSize: 26, background: C.chart }}>
          <span>L</span><span>i</span><span>f</span><span>t</span>
        </div>
        <div className="wk-meta">
          <Chip>The programme</Chip>
          <div style={{ display: 'flex', gap: 4 }}>
            <Chip bg={C.mint}>{days.length} days</Chip><Chip bg={C.chart}>/</Chip><Chip bg={C.lav}>{nLifts} lifts</Chip>
          </div>
        </div>
      </div>

      <div className="ed-title">
        <span aria-hidden="true" style={{ position: 'absolute', left: 0, top: 4, width: 92, height: 60, background: C.coral }} />
        <span aria-hidden="true" style={{ position: 'absolute', left: 104, top: 10, width: 120, height: 52, background: C.chart }} />
        <h1>The Order<br /><span style={{ paddingLeft: 60 }}>of Lifts.</span></h1>
      </div>

      <ol aria-label="Days in rotation" className="ed-days">
        {days.map((d) => {
          const s = d.id === day.id;
          return (
            <li key={d.id}>
              <button type="button" aria-pressed={s} onClick={() => { setSel(d.id); setOpen(null); }}
                style={{ background: s ? C.ink : C.white, color: s ? C.lime : C.ink }}>
                <span aria-hidden="true" style={{ width: 10, height: 10, background: d.color, flexShrink: 0 }} />
                {d.name}
              </button>
            </li>
          );
        })}
        <li><button type="button" onClick={addDay} aria-label="Add a day" style={{ background: 'transparent', borderStyle: 'dashed' }}>+</button></li>
        <li className="ed-days-core">
          <button type="button" aria-pressed={isCore} onClick={() => { setSel(CORE); setOpen(null); }}
            aria-label={`Ab work, ${st.core.perWeek} times a week`}
            style={{ background: isCore ? C.ink : C.yellow, color: isCore ? C.lime : C.ink, borderStyle: 'dotted' }}>
            Abs &#215;{st.core.perWeek}
          </button>
        </li>
      </ol>

      {isCore ? (
        <div className="ed-row" style={{ marginTop: 10 }}>
          <Num label="times a week" value={st.core.perWeek} step={1} min={1} max={7}
            onChange={(v) => st.saveCore({ ...st.core, perWeek: v ?? 1 })} />
          <p className="mono10 ed-rule" style={{ flex: '1 1 180px' }}>
            beside the rotation, not in it. log it on the plate after the day&#8217;s lifts, or on a rest day.
            any ab set ticked counts the day; the week runs monday to sunday.
          </p>
        </div>
      ) : (
      <div className="ed-row" style={{ marginTop: 10 }}>
        <label className="ed-field" style={{ flex: 1 }}>
          <span className="mono9">day</span>
          <input value={day.name} onChange={(e) => {
            const name = e.target.value;
            saveDay({ ...day, name, color: DAY_COLOR[name.split(' ')[0]] ?? day.color });
          }} />
        </label>
        <label className="ed-field" style={{ flex: 1.4 }}>
          <span className="mono9">title</span>
          <input value={day.title} onChange={(e) => saveDay({ ...day, title: e.target.value })} />
        </label>
      </div>
      )}

      <ol aria-label={`Lifts on ${day.name}`} className="ed-lifts">
        {dayLifts.map((l, j) => {
          const isOpen = open === l.id;
          const pal = palFor(DAY_COLOR[kindOf(day)] ?? day.color);
          const col = isCore ? C.yellow : pal[j % pal.length]; // same letter colours as the plate screen
          const shared = isCore ? [] : days.filter((d) => d.id !== day.id && d.lifts.includes(l.id)).map((d) => d.name);
          return (
            <li key={l.id} className="ed-lift" style={{ borderWidth: isOpen ? 2 : 1 }}>
              <div className="ed-lift-top">
                <button type="button" className="ed-lift-h" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : l.id)}>
                  <span className="ed-letter" style={{ background: col }}>
                    {isCore ? <span>Ab{dayLifts.length > 1 && <sup>{j + 1}</sup>}</span> : String.fromCharCode(65 + j)}
                  </span>
                  <span className="ed-lift-name">
                    <span className="ed-name">{l.name || 'Untitled'}</span>
                    <span className="mono10">
                      {schemeOf(l)}{l.amrap ? ' amrap' : ''} &#183; {l.start != null ? `${l.start} lb start` : l.inc > 0 ? 'start open' : 'bw'}{l.inc > 0 ? ` · +${l.inc}` : ''}
                      {shared.length > 0 && <> &#183; <span style={{ background: C.mint, padding: '0 3px' }}>also {shared.join(', ')}</span></>}
                    </span>
                  </span>
                </button>
                <span className="ed-move">
                  <button type="button" aria-label={`Move ${l.name} up`} disabled={j === 0} onClick={() => move(j, -1)}>&#8593;</button>
                  <button type="button" aria-label={`Move ${l.name} down`} disabled={j === dayLifts.length - 1} onClick={() => move(j, 1)}>&#8595;</button>
                </span>
              </div>
              {isOpen && (
                <>
                  <LiftForm lift={l} sharedWith={shared} onSave={st.saveLift} />
                  <button type="button" className="ed-remove" onClick={() => remove(l.id)}>remove from {day.name}</button>
                </>
              )}
            </li>
          );
        })}
      </ol>

      <div className="ed-add">
        <button type="button" onClick={addNew}>{isCore ? '+ new ab lift' : '+ new lift'}</button>
        {!isCore && (
          <label>
            <span className="sr">Add a lift from another day</span>
            <select value="" onChange={(e) => addExisting(e.target.value)} disabled={!others.length}>
              <option value="">+ from another day&#8230;</option>
              {others.map((l) => <option key={l.id} value={l.id}>{l.name} ({repsOf(l)})</option>)}
            </select>
          </label>
        )}
      </div>

      <p className="mono10" style={{ margin: '14px 0 0', lineHeight: 1.5, color: '#4A3A60' }}>
        {isCore
          ? <>the ab lifts follow every day&#8217;s lifts on the plate, after the bar. while the week still owes ab days, the last lift hands on to them.</>
          : <>days run in this order, one after another; a missed day just waits. on the plate, tick each set,
            then set the reps you got on the last one. hit the top of the range and the next session adds weight.</>}
      </p>

      <div className="ed-foot">
        {isCore ? <span /> : <button type="button" className="mtog" onClick={removeDay} disabled={days.length < 2}>remove day: {day.name}</button>}
        <button type="button" className="mtog" onClick={reset}>reset to the sheet</button>
      </div>

      <PlatesOnHand />

      <CloudSync />

      <div style={{ marginTop: 16 }}><Nav current="edit" /></div>
    </div>
  );
}
