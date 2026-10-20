import { useMemo, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

const W = 64;
const H = 24;
const ACCENTS = ['blue', 'teal', 'gold', 'violet'] as const;

type Cell = { x: number; y: number; w: number; h: number; tone: string };

function random(seed: number) {
  let state = (seed * 2654435761) >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function hash(text: string) {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}

function skyline(seed: number) {
  const next = random(seed);
  const cells: Cell[] = [];
  for (let i = 0; i < 22; i += 1) {
    const x = Math.floor(next() * W);
    const y = Math.floor(next() * 11);
    cells.push({ x, y, w: 1, h: 1, tone: next() > 0.8 ? 'star-bright' : 'star' });
  }
  const moonX = 8 + Math.floor(next() * 44);
  const moonY = 3 + Math.floor(next() * 3);
  const moon = [[1, 0, 3], [0, 1, 3], [0, 2, 2], [0, 3, 3], [1, 4, 3]];
  moon.forEach(([dx, dy, w]) => cells.push({ x: moonX + dx, y: moonY + dy, w, h: 1, tone: 'accent' }));

  cells.push({ x: 0, y: 15, w: W, h: 1, tone: 'haze' }, { x: 0, y: 17, w: W, h: 1, tone: 'haze' });
  for (let x = 0; x < W; x += 2) cells.push({ x: x + ((x / 2) % 2), y: 16, w: 1, h: 1, tone: 'haze' });

  for (let x = 0; x < W;) {
    const w = 3 + Math.floor(next() * 5);
    const top = 9 + Math.floor(next() * 9);
    const tone = next() > 0.5 ? 'block' : 'block-2';
    cells.push({ x, y: top, w, h: H - top, tone });
    cells.push({ x, y: top, w, h: 1, tone: 'block-edge' });
    for (let wy = top + 2; wy < H - 2; wy += 2) {
      for (let wx = x + 1; wx < x + w - 1; wx += 2) {
        const roll = next();
        if (roll > 0.82) cells.push({ x: wx, y: wy, w: 1, h: 1, tone: roll > 0.95 ? 'accent' : 'window' });
      }
    }
    x += w + (next() > 0.7 ? 1 : 0);
  }
  cells.push({ x: 0, y: H - 2, w: W, h: 2, tone: 'ground' });
  return { cells, accent: ACCENTS[Math.floor(next() * ACCENTS.length)] };
}

interface PathArtProps {
  seed: number | string;
  src?: string | null;
  className?: string;
  children?: ReactNode;
}

export default function PathArt({ seed, src, className, children }: PathArtProps) {
  const art = useMemo(() => skyline(typeof seed === 'number' ? seed + 1 : hash(seed)), [seed]);
  return (
    <div className={cn('path-art', `path-art--${art.accent}`, className)}>
      {src ? (
        <img src={src} alt="" loading="lazy" />
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" shapeRendering="crispEdges" aria-hidden="true">
          <rect className="pa-sky" width={W} height={H} />
          {art.cells.map((cell, index) => (
            <rect key={index} className={`pa-${cell.tone}`} x={cell.x} y={cell.y} width={cell.w} height={cell.h} />
          ))}
        </svg>
      )}
      {children}
    </div>
  );
}
