import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import './RoomBit.css';

export interface RoomBitState { successCount: number; wrongCount?: number; hintCount?: number; finishCount?: number; paused?: boolean }
export const RoomBitContext = createContext<RoomBitState | null>(null);

export type BitSide = 'top' | 'side';
export type BitReaction = 'correct' | 'wrong' | 'hint' | 'finish';
export const REACTION_FRAMES = 12;
export const FRAME_MS = 100;
export const ENTER_MS = 360;
export const REACTION_MS = ENTER_MS + REACTION_FRAMES * FRAME_MS + 1000;
const PRIORITY: BitReaction[] = ['finish', 'correct', 'wrong', 'hint'];
const LINES: Record<BitReaction, string[]> = {
  correct: ['Dokładnie tak!', 'Brawo!', 'Świetnie!'],
  wrong: ['Ups, spróbuj jeszcze raz.', 'Prawie! Jeszcze raz.'],
  hint: ['Mam podpowiedź!', 'Zerknij na podpowiedź.'],
  finish: ['Pokój zaliczony!'],
};
const sprite = (side: BitSide, pose: BitReaction | 'idle') => `/assets/mascot/bit-peek/${side === 'top' ? 'hang' : 'side'}-${pose}.png`;
const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

function counts(state: RoomBitState): Record<BitReaction, number> {
  return { correct: state.successCount, wrong: state.wrongCount ?? 0, hint: state.hintCount ?? 0, finish: state.finishCount ?? 0 };
}

function useShellRect(anchor: React.RefObject<HTMLSpanElement | null>) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    const shell = anchor.current?.parentElement;
    if (!shell) return;
    const measure = () => {
      const next = shell.getBoundingClientRect();
      setRect(previous => previous && previous.top === next.top && previous.left === next.left && previous.width === next.width && previous.height === next.height ? previous : next);
    };
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(shell);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [anchor]);
  return rect;
}

export default function RoomBit() {
  const state = useContext(RoomBitContext);
  const reduced = useReducedMotion();
  const anchor = useRef<HTMLSpanElement>(null);
  const rect = useShellRect(anchor);
  const [side] = useState<BitSide>(() => Math.random() < .5 ? 'top' : 'side');
  const [shown, setShown] = useState<{ reaction: BitReaction; line: string; key: number } | null>(null);
  const seen = useRef(state ? counts(state) : null);
  const current = state ? counts(state) : null;
  const signature = current ? PRIORITY.map(kind => current[kind]).join() : '';

  useEffect(() => {
    if (!state || !seen.current) return;
    const now = counts(state);
    const fresh = PRIORITY.find(kind => now[kind] > seen.current![kind]);
    seen.current = now;
    if (!fresh || (state.paused && fresh !== 'finish')) return;
    setShown(previous => ({ reaction: fresh, line: pick(LINES[fresh]), key: (previous?.key ?? 0) + 1 }));
  }, [signature, state]);

  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => setShown(null), REACTION_MS);
    return () => clearTimeout(timer);
  }, [shown]);

  useEffect(() => {
    if (state?.paused && shown?.reaction !== 'finish') setShown(null);
  }, [state?.paused, shown?.reaction]);

  if (!state) return null;
  const pose = shown?.reaction ?? 'idle';
  const layer = rect && createPortal(
    <div className="room-bit-layer" aria-hidden="true" data-side={side} data-pose={pose} data-reduced={reduced || undefined}
      style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height } as CSSProperties}>
      <div className="room-bit" key={shown?.key ?? 'idle'}>
        <span className="room-bit-sprite" data-animated={pose !== 'idle' && !reduced ? '' : undefined}
          style={{ '--bit-sheet': `url(${sprite(side, pose)})`, '--bit-frames': pose === 'idle' ? 1 : REACTION_FRAMES } as CSSProperties} />
      </div>
      {shown && <p className="room-bit-bubble" key={`line-${shown.key}`}>{shown.line}</p>}
    </div>,
    document.body,
  );
  return <span ref={anchor} className="room-bit-anchor" aria-hidden="true">{layer}</span>;
}
