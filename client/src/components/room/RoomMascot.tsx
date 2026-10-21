import { createContext, useContext, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Mascot, type MascotMood } from '../mascot/Mascot';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import './RoomMascot.css';

export interface RoomMascotState { successCount: number; paused?: boolean }
export const RoomMascotContext = createContext<RoomMascotState>({ successCount: 0 });
type Action = 'idle' | 'right' | 'left' | 'wave' | 'look' | 'jump';
type Motion = { action: Action; from: number; position: number; duration: number; revision: number };
const initialMotion: Motion = { action: 'idle', from: .5, position: .5, duration: 0, revision: 0 };
const moods: Record<Action, MascotMood> = { idle: 'idle', right: 'walkSide', left: 'walkSide', wave: 'wave', look: 'calm', jump: 'wave' };
const clamp = (position: number) => Math.max(0, Math.min(1, position));

export default function RoomMascot() {
  const { successCount, paused = false } = useContext(RoomMascotContext);
  const reduced = useReducedMotion();
  const track = useRef<HTMLDivElement>(null);
  const actor = useRef<HTMLDivElement>(null);
  const seen = useRef(successCount);
  const pending = useRef(0);
  const controller = useRef<(() => void) | null>(null);
  const current = useRef<Motion>(initialMotion);
  const [motion, setMotion] = useState(initialMotion);
  const [hidden, setHidden] = useState(() => document.hidden);

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
    if (reduced || paused || hidden) {
      if (reduced) pending.current = 0;
      show('idle');
      controller.current = reduced ? () => { pending.current = 0; } : null;
      return () => { controller.current = null; };
    }
    const rest = () => {
      show('idle');
      timer = setTimeout(random, 14_000 + Math.random() * 16_000);
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
      const choice = Math.floor(Math.random() * 4);
      const width = track.current?.clientWidth ?? 0;
      if (choice < 2 && width >= 72) {
        const direction = choice === 0 ? 1 : -1;
        const destination = clamp(position() + direction * Math.min(.3, 84 / width));
        if (Math.abs(destination - position()) * width >= 16) show(direction > 0 ? 'right' : 'left', destination, 1800);
        else show('wave', position(), 1800);
      } else show(choice === 3 ? 'look' : 'wave', position(), 1800);
      timer = setTimeout(rest, 1800);
    };
    controller.current = jump;
    show('idle');
    if (pending.current > 0) jump();
    else rest();
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
      const settled = position();
      current.current = { ...current.current, action: 'idle', from: settled, position: settled };
    };
  }, [reduced, paused, hidden]);

  useEffect(() => {
    pending.current += Math.max(0, successCount - seen.current);
    seen.current = successCount;
    if (pending.current > 0) controller.current?.();
  }, [successCount]);

  const still = reduced || paused || hidden;
  const action = still ? 'idle' : motion.action;
  return (
    <div className="room-mascot-zone" aria-hidden="true" data-state={action} data-reaction={motion.revision}>
      <div className="room-mascot-track" ref={track}>
        <div key={motion.revision} ref={actor} className="room-mascot-actor" data-action={action}
          style={{ '--bit-from': `${motion.from * 100}%`, '--bit-to': `${motion.position * 100}%`, '--bit-duration': `${motion.duration}ms` } as CSSProperties}>
          <div className="room-mascot-pose"><Mascot mood={moods[action]} scale={1} still={still} interactive={false} /></div>
        </div>
      </div>
    </div>
  );
}
