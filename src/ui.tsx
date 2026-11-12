import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { asset, C, MUSCLES, PLATES, type PlateId } from './data';

export function Chip({ bg = C.white, fg = C.ink, cls = '', children, style }: {
  bg?: string; fg?: string; cls?: string; children: ReactNode; style?: CSSProperties;
}) {
  return <span className={`chip ${cls}`} style={{ background: bg, color: fg, ...style }}>{children}</span>;
}

/** vertical "+" rail that blinks in sequence */
export function Rail({ n, size = 14, step = 0.12, cls = 'px', style }: {
  n: number; size?: number; step?: number; cls?: string; style?: CSSProperties;
}) {
  return (
    <div aria-hidden="true" className="rail" style={style}>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className={cls} style={{ width: size, height: size, fontSize: size - 3, animationDelay: `${(i * step).toFixed(2)}s` }}>+</span>
      ))}
    </div>
  );
}

/** page entry: six palette bars wipe right while a chip glitches in the centre */
export function Wipe({ colors, chips }: { colors: string[]; chips: [string, string, string] }) {
  const [on, setOn] = useState(true);
  useEffect(() => { const t = setTimeout(() => setOn(false), 1200); return () => clearTimeout(t); }, []);
  if (!on) return null;
  return (
    <div className="wipe" aria-hidden="true">
      {colors.map((c, i) => <span key={i} className="bar" style={{ background: c, animationDelay: `${0.05 + i * 0.07}s` }} />)}
      <em>
        <Chip>{chips[0]}</Chip><Chip bg={C.chart}>{chips[1]}</Chip><Chip bg={C.lav} cls="flk">{chips[2]}</Chip>
      </em>
    </div>
  );
}

export type Route = 'home' | 'plate' | 'week' | 'masks';

export function Nav({ order, current, h = 48 }: { order: Route[]; current: Route; h?: number }) {
  const label: Record<Route, string> = { home: 'Home', plate: 'Plate', week: 'Week', masks: 'Masks' };
  return (
    <nav aria-label="Atlas" className="nav">
      {order.map((r) => r === current
        ? <span key={r} aria-current="page" style={{ minHeight: h, background: C.chart }}>/ {label[r]}</span>
        : <a key={r} href={`#/${r === 'home' ? '' : r}`} style={{ minHeight: h }}>/ {label[r]}</a>)}
    </nav>
  );
}

/** 2x2 italic letter tile, "P l / I" */
export function LetterTile({ letters, size = 44, fs = 16, bg = C.chart, label }: {
  letters: string[]; size?: number; fs?: number; bg?: string; label: string;
}) {
  return (
    <div aria-label={label} className="ltile" style={{ width: size, height: size, fontSize: fs, background: bg }}>
      {letters.map((l, i) => <span key={i} style={letters.length === 3 && i === 2 ? { gridColumn: '1 / -1' } : undefined}>{l}</span>)}
    </div>
  );
}

export interface Tint { color: string; op: number; cls?: string; delay?: string }

/**
 * an engraved plate with multiply tints clipped by muscle masks.
 * `pos` is a CSS position ("50% 30%") applied identically to the img and every mask so they stay registered.
 */
export function PlateLayers({ plate, tints, pos = '50% 50%', fit = 'cover', imgCls = '', imgStyle, alt }: {
  plate: PlateId; tints: Record<string, Tint | undefined>; pos?: string; fit?: 'cover' | 'fill';
  imgCls?: string; imgStyle?: CSSProperties; alt?: string;
}) {
  const P = PLATES[plate];
  const maskSize = fit === 'cover' ? 'cover' : '100% 100%';
  return (
    <>
      <img className={`pimg ${imgCls}`} src={asset(P.file)} alt={alt ?? P.alt} draggable={false}
        style={{ objectFit: fit, objectPosition: pos, ...imgStyle }} />
      {P.masks.map((k) => {
        const t = tints[k];
        const url = `url(${asset(MUSCLES[k].mask)})`;
        return (
          <span key={k} aria-hidden="true" className={`mk ${t?.cls ?? ''}`}
            style={{
              background: t?.color ?? 'transparent', opacity: t ? t.op : 0,
              WebkitMaskImage: url, maskImage: url,
              WebkitMaskSize: maskSize, maskSize,
              WebkitMaskPosition: pos, maskPosition: pos,
              animationDelay: t?.delay,
            }} />
        );
      })}
    </>
  );
}

export function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const r = e.contentRect;
      setSize((s) => (s.w === Math.round(r.width) && s.h === Math.round(r.height) ? s : { w: Math.round(r.width), h: Math.round(r.height) }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}
