import { useState } from 'react';
import { C, MUSCLES, PAL, PLATES, PLATE_IDS } from '../data';
import { Chip, Nav, PlateLayers } from '../ui';
import type { Tint } from '../ui';

/** debug view: every plate, every mask, per-muscle toggles */
export default function MaskTest() {
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(Object.keys(MUSCLES).map((k) => [k, true])));
  const color = (k: string, i: number) => PAL[i % PAL.length];

  return (
    <div className="screen masks">
      <div className="sec-h" style={{ marginBottom: 12 }}>
        <h2>// MASK TEST</h2><span className="rule" />
        <button type="button" className="mono11 link44" onClick={() => setOn((o) => Object.fromEntries(Object.keys(o).map((k) => [k, !Object.values(o).some(Boolean)])))}>
          toggle all
        </button>
      </div>
      {PLATE_IDS.map((p) => {
        const P = PLATES[p];
        const tints: Record<string, Tint> = {};
        P.masks.forEach((k, i) => { if (on[k]) tints[k] = { color: color(k, i), op: 0.9 }; });
        return (
          <section key={p} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}><Chip>Pl. {p}</Chip><Chip bg={C.mint}>{P.view}</Chip></div>
            <div className="wk-plate" style={{ border: `1px solid ${C.ink}` }}>
              <PlateLayers plate={p} tints={tints} fit="fill" pos="0 0" />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {P.masks.map((k, i) => (
                <button key={k} type="button" aria-pressed={on[k]} className="mtog"
                  onClick={() => setOn((o) => ({ ...o, [k]: !o[k] }))}
                  style={{ background: on[k] ? color(k, i) : 'transparent' }}>
                  {k} <span style={{ opacity: 0.7 }}>{MUSCLES[k].centroidY}</span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
      <Nav current="masks" />
    </div>
  );
}
