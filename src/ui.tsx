import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { anchorIn, asset, C, MUSCLES, PLATES, type PlateId } from './data';

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

export type Phase = 'cover' | 'hold' | 'reveal';

/** set just before navigating, read once by the next page turn */
export const transitionHint = { sealed: false };

/**
 * the page turn. slats in the destination's colours shut over the old screen, its name is stamped on them,
 * the screens swap underneath, and the slats pull off the far side. `back` mirrors the direction.
 */
export function Turn({ phase, back, slats, kicker, label }: {
  phase: Phase; back: boolean; slats: string[]; kicker: string; label: string;
}) {
  return (
    <div className={`turn ${phase} ${back ? 'back' : ''}`} aria-hidden="true">
      {slats.map((c, i) => <span key={i} className="slat" style={{ background: c, ['--i' as string]: i }} />)}
      <Reg style={{ left: 14, top: 'calc(var(--st) + 14px)' }} /><Reg style={{ right: 14, top: 'calc(var(--st) + 14px)' }} />
      <Reg style={{ left: 14, bottom: 'calc(var(--sb) + 14px)' }} /><Reg style={{ right: 14, bottom: 'calc(var(--sb) + 14px)' }} />
      <div className="turn-label">
        <span className="chip">{kicker}</span>
        <b className="xb">{label}</b>
      </div>
    </div>
  );
}

export type Route = 'home' | 'plate' | 'week' | 'masks' | 'edit';

export function Nav({ order, current, h = 48 }: { order: Route[]; current: Route; h?: number }) {
  const label: Record<Route, string> = { home: 'Home', plate: 'Plate', week: 'Week', masks: 'Masks', edit: 'Lifts' };
  return (
    <nav aria-label="Atlas" className="nav" style={{ gridTemplateColumns: `repeat(${order.length}, minmax(0, 1fr))` }}>
      {order.map((r) => r === current
        ? <span key={r} aria-current="page" style={{ minHeight: h, background: C.ink, color: C.lime }}>/ {label[r]}</span>
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
export function PlateLayers({ plate, tints, pos = '50% 50%', fit = 'cover', imgCls = '', imgStyle, alt, field = C.lime }: {
  plate: PlateId; tints: Record<string, Tint | undefined>; pos?: string; fit?: 'cover' | 'fill';
  imgCls?: string; imgStyle?: CSSProperties; alt?: string;
  /** the engraving is printed (multiply) onto this colour, so the scan's own paper never shows */
  field?: string;
}) {
  const P = PLATES[plate];
  const maskSize = fit === 'cover' ? 'cover' : '100% 100%';
  return (
    <>
      <span aria-hidden="true" className="layer" style={{ background: field }} />
      {P.masks.map((k) => {
        const t = tints[k];
        const url = `url(${asset(MUSCLES[k].mask)})`;
        return (
          <span key={k} aria-hidden="true" className={`mk ${t ? t.cls ?? 'on' : ''}`}
            style={{
              background: t?.color ?? 'transparent', opacity: t ? t.op : 0,
              WebkitMaskImage: url, maskImage: url,
              WebkitMaskSize: maskSize, maskSize,
              WebkitMaskPosition: pos, maskPosition: pos,
              animationDelay: t?.delay,
            }} />
        );
      })}
      {/* flat colour first, then the line work printed over it: tints never multiply against the field, so they never muddy */}
      <img className={`pimg ink ${imgCls}`} src={asset(P.file)} alt={alt ?? P.alt} draggable={false}
        style={{ objectFit: fit, objectPosition: pos, ...imgStyle }} />
    </>
  );
}

/** registration mark, the printer's crosshair */
export function Reg({ size = 16, style, cls = '' }: { size?: number; style?: CSSProperties; cls?: string }) {
  return (
    <svg aria-hidden="true" className={`reg ${cls}`} width={size} height={size} viewBox="0 0 16 16" style={style}>
      <circle cx="8" cy="8" r="4.5" fill="none" stroke="currentColor" />
      <path d="M8 0v16M0 8h16" stroke="currentColor" />
    </svg>
  );
}

/** a barcode whose bars are the characters of `code`. decorative, but it does encode the thing it labels */
export function Barcode({ code, h = 20, style }: { code: string; h?: number; style?: CSSProperties }) {
  const bars: number[] = [1, 1];
  for (const ch of code) { const n = ch.charCodeAt(0); bars.push(1 + (n & 3), 1 + ((n >> 2) & 1), 1 + ((n >> 3) & 3), 1 + ((n >> 5) & 1)); }
  bars.push(1, 1, 1);
  return (
    <span aria-hidden="true" className="barcode" style={{ height: h, ...style }}>
      {bars.map((w, i) => <i key={i} style={{ width: w, opacity: i % 2 ? 0 : 1 }} />)}
    </span>
  );
}

/**
 * the atlas's leader line as a hud callout: a ring on the muscle, an elbow, a tag at the right edge.
 * lives inside the same frame as PlateLayers and takes the same `pos`.
 */
export function Callout({ muscle, fw, fh, pos, color, letter, label }: {
  muscle: string; fw: number; fh: number; pos: string; color: string; letter: string; label: string;
}) {
  const a = anchorIn(muscle, fw, fh, pos);
  if (!a || a.y < 0 || a.y > fh) return null;
  const up = a.y > 78;
  const ly = up ? a.y - 30 : a.y + 30; // the shelf the tag sits on
  const ex = Math.min(a.x + 30, fw - 16);
  return (
    <div aria-hidden="true" className="callout layer">
      <svg width={fw} height={fh} viewBox={`0 0 ${fw} ${fh}`}>
        <polyline className="co-line" pathLength={1} points={`${a.x},${a.y} ${ex},${ly} ${fw - 16},${ly}`} fill="none" stroke={C.ink} strokeWidth="1" />
        <g className="co-ring" style={{ transformOrigin: `${a.x}px ${a.y}px` }}>
          <circle cx={a.x} cy={a.y} r="5.5" fill={C.lime} stroke={C.ink} />
          <circle cx={a.x} cy={a.y} r="1.5" fill={C.ink} />
        </g>
      </svg>
      <span className="callout-tag" style={up ? { right: 16, bottom: fh - ly } : { right: 16, top: ly }}>
        <b style={{ background: color }}>{letter}</b><span>{label}</span>
      </span>
    </div>
  );
}

/** counts up to n in a few hard steps, like a counter settling */
export function useCount(n: number, delay = 0, steps = 7) {
  const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [v, setV] = useState(still ? n : 0);
  useEffect(() => {
    if (still) { setV(n); return; }
    let i = 0, iv = 0;
    const t = window.setTimeout(() => {
      iv = window.setInterval(() => { i++; setV(Math.round((n * i) / steps)); if (i >= steps) clearInterval(iv); }, 55);
    }, delay);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, [n, delay, steps, still]);
  return v;
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
