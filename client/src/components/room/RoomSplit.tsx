import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

const MIN = 0.28;
const MAX = 0.72;
const STEP = 0.02;

const clamp = (value: number) => Math.min(MAX, Math.max(MIN, value));

interface RoomSplitProps {
  start: ReactNode;
  end: ReactNode;
  variant?: 'panels' | 'flat';
  initial?: number;
}

export default function RoomSplit({ start, end, variant = 'panels', initial = 0.42 }: RoomSplitProps) {
  const [ratio, setRatio] = useState(clamp(initial));
  const [dragging, setDragging] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const follow = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging || !box.current) return;
    const rect = box.current.getBoundingClientRect();
    if (rect.width > 0) setRatio(clamp((event.clientX - rect.left) / rect.width));
  };

  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = { ArrowLeft: -STEP, ArrowRight: STEP, Home: MIN - ratio, End: MAX - ratio };
    if (!(event.key in moves)) return;
    event.preventDefault();
    setRatio(clamp(ratio + moves[event.key]));
  };

  return (
    <div ref={box} className={cn('room-split', `room-split--${variant}`, dragging && 'is-dragging')}
      style={{ '--room-split-start': `${ratio}fr`, '--room-split-end': `${1 - ratio}fr` } as CSSProperties}>
      <div className="room-split-pane">{start}</div>
      <div className="room-split-handle" role="separator" aria-orientation="vertical" aria-label="Szerokość paneli"
        aria-valuemin={Math.round(MIN * 100)} aria-valuemax={Math.round(MAX * 100)} aria-valuenow={Math.round(ratio * 100)}
        tabIndex={0} onKeyDown={keys}
        onPointerDown={event => { event.currentTarget.setPointerCapture?.(event.pointerId); setDragging(true); }}
        onPointerMove={follow}
        onPointerUp={event => { event.currentTarget.releasePointerCapture?.(event.pointerId); setDragging(false); }}
        onPointerCancel={() => setDragging(false)} />
      <div className="room-split-pane">{end}</div>
    </div>
  );
}
