import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { DANCE_MS, Mascot, type MascotMood } from '../mascot/Mascot';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import './RoomMascot.css';

export interface RoomMascotState { successCount: number; paused?: boolean }
export const RoomMascotContext = createContext<RoomMascotState>({ successCount: 0 });
export const MASCOT_WIDTH = 58;
type Action = 'idle' | 'right' | 'left' | 'wave' | 'look' | 'jump' | 'return' | 'dance';
type Motion = { action: Action; from: number; position: number; duration: number; revision: number };
const HOME = .5;
const initialMotion: Motion = { action: 'idle', from: HOME, position: HOME, duration: 0, revision: 0 };
const moods: Record<Action, MascotMood> = { idle: 'idle', right: 'walkSide', left: 'walkSide', wave: 'wave', look: 'calm', jump: 'wave', return: 'walkSide', dance: 'scuba' };
const clamp = (position: number) => Math.max(0, Math.min(1, position));

export default function RoomMascot() {
  const { successCount, paused = false } = useContext(RoomMascotContext);
  const reduced = useReducedMotion();
  const zone = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const actor = useRef<HTMLButtonElement>(null);
  const seen = useRef(successCount);
  const pending = useRef(0);
  const controller = useRef<(() => void) | null>(null);
  const retreat = useRef<(() => void) | null>(null);
  const current = useRef<Motion>(initialMotion);
  const [motion, setMotion] = useState<Motion>(initialMotion);
  const [hidden, setHidden] = useState(() => document.hidden);

  useLayoutEffect(() => {
    const measure = () => {
      if (zone.current) setVisible(zone.current.getBoundingClientRect().width >= MASCOT_WIDTH);
    };
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    if (zone.current) observer?.observe(zone.current);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
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
    const show = (action: Action, destination = position(), duration = 0) => {
      const next = { action, from: position(), position: destination, duration, revision: current.current.revision + 1 };
      current.current = next;
      setMotion(next);
    };
    const stop = () => clearTimeout(timer);
    if (reduced || paused || hidden || !visible) {
      if (reduced) pending.current = 0;
      show('idle', HOME);
      controller.current = reduced ? () => { pending.current = 0; } : null;
      retreat.current = reduced ? () => show('idle', HOME) : null;
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
        const destination = clamp(position() + direction * Math.min(.7, 240 / width));
        duration = Math.max(1200, Math.min(5000, Math.abs(destination - position()) * width / .06));
        show(direction > 0 ? 'right' : 'left', destination, duration);
      } else show(choice === 5 ? 'look' : 'wave', position(), duration);
      timer = setTimeout(rest, duration);
    };
    retreat.current = () => {
      if (['return', 'dance'].includes(current.current.action)) return;
      stop();
      const dance = () => {
        show('dance', HOME, DANCE_MS);
        timer = setTimeout(() => {
          show('idle', HOME);
          if (pending.current > 0) jump();
          else rest();
        }, DANCE_MS);
      };
      if (Math.abs(position() - HOME) < .01) dance();
      else {
        show('return', HOME, 650);
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
  }, [reduced, paused, hidden, visible]);

  useEffect(() => {
    pending.current += Math.max(0, successCount - seen.current);
    seen.current = successCount;
    if (pending.current > 0) controller.current?.();
  }, [successCount]);

  const still = reduced || paused || hidden || !visible;
  const action = still ? 'idle' : motion.action;
  return (
    <div ref={zone} className="room-mascot-zone" data-state={action} data-reaction={motion.revision} style={{ visibility: visible && !paused ? 'visible' : 'hidden' }}>
      <div className="room-mascot-track" ref={track}>
        <button ref={actor} type="button" className="room-mascot-actor" data-action={action}
          data-facing={motion.position < motion.from ? 'left' : 'right'} disabled={paused || hidden}
          aria-label="Bit, wróć do siebie i zatańcz" onPointerDown={event => event.preventDefault()} onClick={() => retreat.current?.()}
          style={{ '--bit-from': `${motion.from * 100}%`, '--bit-to': `${motion.position * 100}%`, '--bit-duration': `${motion.duration}ms`, '--bit-walk': motion.revision % 2 ? 'room-bit-walk' : 'room-bit-walk-again' } as CSSProperties}>
          <div key={motion.revision} className="room-mascot-pose"><Mascot mood={moods[action]} scale={1} still={still} interactive={false} /></div>
        </button>
      </div>
    </div>
  );
}
