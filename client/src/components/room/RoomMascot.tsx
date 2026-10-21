import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { DANCE_MS, Mascot, type MascotMood } from '../mascot/Mascot';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import './RoomMascot.css';

export interface RoomMascotState { successCount: number; paused?: boolean }
export const RoomMascotContext = createContext<RoomMascotState>({ successCount: 0 });
type Action = 'idle' | 'right' | 'left' | 'wave' | 'look' | 'jump' | 'return' | 'dance';
type Motion = { action: Action; from: number; position: number; fromY: number; y: number; duration: number; revision: number };
const initialMotion: Motion = { action: 'idle', from: .5, position: .5, fromY: .85, y: .85, duration: 0, revision: 0 };
const moods: Record<Action, MascotMood> = { idle: 'idle', right: 'walkSide', left: 'walkSide', wave: 'wave', look: 'calm', jump: 'wave', return: 'walkSide', dance: 'scuba' };
const clamp = (position: number) => Math.max(0, Math.min(1, position));

export function mascotViewport(rect: Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom'>, width: number, height: number) {
  const left = Math.max(0, rect.left);
  const top = Math.max(0, rect.top);
  const availableWidth = Math.max(0, Math.min(width, rect.right) - left);
  const availableHeight = Math.max(0, Math.min(height, rect.bottom) - top);
  return { left: left + 16, top: top + 32, width: Math.max(0, availableWidth - 148), height: Math.max(0, availableHeight - 168), visible: availableWidth >= 148 && availableHeight >= 168 };
}

export default function RoomMascot({ roaming = false }: { roaming?: boolean }) {
  const home = roaming ? .12 : .5;
  const { successCount, paused = false } = useContext(RoomMascotContext);
  const reduced = useReducedMotion();
  const zone = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState(() => mascotViewport({ left: 0, top: 0, right: 0, bottom: 0 }, 0, 0));
  const track = useRef<HTMLDivElement>(null);
  const actor = useRef<HTMLButtonElement>(null);
  const seen = useRef(successCount);
  const pending = useRef(0);
  const controller = useRef<(() => void) | null>(null);
  const retreat = useRef<(() => void) | null>(null);
  const current = useRef<Motion>({ ...initialMotion, from: home, position: home });
  const [motion, setMotion] = useState<Motion>(() => ({ ...initialMotion, from: home, position: home }));
  const [hidden, setHidden] = useState(() => document.hidden);

  useLayoutEffect(() => {
    const measure = () => {
      if (!zone.current) return;
      const next = mascotViewport(zone.current.getBoundingClientRect(), window.innerWidth, window.innerHeight);
      setViewport(previous => previous.left === next.left && previous.top === next.top && previous.width === next.width && previous.height === next.height && previous.visible === next.visible ? previous : next);
    };
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    if (zone.current) observer?.observe(zone.current);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, []);

  useEffect(() => {
    const visibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const position = () => {
      if (!track.current || !actor.current || track.current.clientWidth === 0) return current.current.position;
      const left = getComputedStyle(actor.current).left;
      const value = left.endsWith('%') ? parseFloat(left) / 100 : parseFloat(left) / track.current.clientWidth;
      return Number.isFinite(value) ? clamp(value) : current.current.position;
    };
    const vertical = () => {
      if (!track.current || !actor.current || track.current.clientHeight === 0) return current.current.y;
      const top = getComputedStyle(actor.current).top;
      const value = top.endsWith('%') ? parseFloat(top) / 100 : parseFloat(top) / track.current.clientHeight;
      return Number.isFinite(value) ? clamp(value) : current.current.y;
    };
    const show = (action: Action, destination = position(), duration = 0, y = vertical()) => {
      const next = { action, from: position(), position: destination, fromY: vertical(), y, duration, revision: current.current.revision + 1 };
      current.current = next;
      setMotion(next);
    };
    const stop = () => clearTimeout(timer);
    if (reduced || paused || hidden || !viewport.visible) {
      if (reduced) pending.current = 0;
      show('idle', home, 0, .85);
      controller.current = reduced ? () => { pending.current = 0; } : null;
      retreat.current = reduced ? () => show('idle', home, 0, .85) : null;
      return () => { controller.current = null; retreat.current = null; };
    }
    const rest = () => {
      show('idle');
      timer = setTimeout(random, 4_000 + Math.random() * 4_000);
    };
    const jump = () => {
      if (current.current.action === 'jump') return;
      stop();
      pending.current = Math.max(0, pending.current - 1);
      show('jump', position(), 640);
      timer = setTimeout(() => {
        show('idle');
        if (pending.current > 0) jump();
        else rest();
      }, 640);
    };
    const random = () => {
      const choice = Math.floor(Math.random() * 6);
      const width = track.current?.clientWidth ?? 0;
      let duration = 1800;
      if (choice < 4 && width >= 72) {
        let direction = choice % 2 === 0 ? 1 : -1;
        if (position() > .9) direction = -1;
        if (position() < .1) direction = 1;
        const destination = clamp(position() + direction * Math.min(.7, 360 / width));
        const destinationY = Math.random();
        const distance = Math.hypot((destination - position()) * width, (destinationY - vertical()) * (track.current?.clientHeight ?? 0));
        duration = Math.max(1200, Math.min(3200, distance / .12));
        show(direction > 0 ? 'right' : 'left', destination, duration, destinationY);
      } else show(choice === 5 ? 'look' : 'wave', position(), duration);
      timer = setTimeout(rest, duration);
    };
    retreat.current = () => {
      if (['return', 'dance'].includes(current.current.action)) return;
      stop();
      const dance = () => {
        show('dance', home, DANCE_MS, .85);
        timer = setTimeout(() => {
          show('idle', home, 0, .85);
          if (pending.current > 0) jump();
          else rest();
        }, DANCE_MS);
      };
      if (Math.abs(position() - home) < .01 && Math.abs(vertical() - .85) < .01) dance();
      else {
        show('return', home, 650, .85);
        timer = setTimeout(dance, 650);
      }
    };
    controller.current = jump;
    show('idle');
    if (pending.current > 0) jump();
    else timer = setTimeout(random, 2_200 + Math.random() * 1_800);
    const resize = () => {
      if ((track.current?.clientWidth ?? 0) < 72 && ['left', 'right'].includes(current.current.action)) {
        stop();
        rest();
      }
    };
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    if (track.current) observer?.observe(track.current);
    window.addEventListener('resize', resize);
    return () => {
      stop();
      observer?.disconnect();
      window.removeEventListener('resize', resize);
      controller.current = null;
      retreat.current = null;
      const settled = position();
      current.current = { ...current.current, action: 'idle', from: settled, position: settled };
    };
  }, [reduced, paused, hidden, home, viewport.visible]);

  useEffect(() => {
    pending.current += Math.max(0, successCount - seen.current);
    seen.current = successCount;
    if (pending.current > 0) controller.current?.();
  }, [successCount]);

  const still = reduced || paused || hidden || !viewport.visible;
  const action = still ? 'idle' : motion.action;
  return (
    <div ref={zone} className="room-mascot-zone" data-roaming={roaming} data-state={action} data-reaction={motion.revision} style={{ visibility: viewport.visible && !paused ? 'visible' : 'hidden' }}>
      <div className="room-mascot-track" ref={track} style={{ left: viewport.left, top: viewport.top, width: viewport.width, height: viewport.height }}>
        <button ref={actor} type="button" className="room-mascot-actor" data-action={action}
          data-facing={motion.position < motion.from ? 'left' : 'right'} disabled={paused || hidden}
          aria-label="Bit, wróć do siebie i zatańcz" onPointerDown={event => event.preventDefault()} onClick={() => retreat.current?.()}
          style={{ '--bit-from': `${motion.from * 100}%`, '--bit-to': `${motion.position * 100}%`, '--bit-from-y': `${motion.fromY * 100}%`, '--bit-to-y': `${motion.y * 100}%`, '--bit-duration': `${motion.duration}ms`, '--bit-walk': motion.revision % 2 ? 'room-bit-walk' : 'room-bit-walk-again' } as CSSProperties}>
          <div key={motion.revision} className="room-mascot-pose"><Mascot mood={moods[action]} scale={2} still={still} interactive={false} /></div>
        </button>
      </div>
    </div>
  );
}
