import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { createPortal } from 'react-dom';
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { currentToasts, subscribeToasts, toast } from './toast';
import type { ToastItem } from './toast';
import './Toaster.css';

const icons = { success: CircleCheck, warning: TriangleAlert, error: CircleAlert, info: Info };
const OBSTACLES = '.realtime-toasts, .rate-limit-notices, .room-footer';
const GAP = 8;

function ToastCard({ item }: { item: ToastItem }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const remaining = useRef(item.duration);
  const messageId = useId();
  const paused = hovered || focused;

  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    const timer = window.setTimeout(() => toast.dismiss(item.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - started));
    };
  }, [paused, item.id]);

  const Icon = icons[item.kind];
  return <li className="px-toast px-panel" data-type={item.kind} data-paused={paused || undefined}
    style={{ '--px-toast-duration': `${item.duration}ms` } as CSSProperties}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocus={() => setFocused(true)}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}>
    <span className="px-toast-icon" aria-hidden="true"><Icon /></span>
    <div className="px-toast-copy">
      <p className="px-toast-title">{item.title}</p>
      <p id={messageId} className="px-toast-message">{item.message}</p>
    </div>
    <button type="button" className="px-toast-close" onClick={() => toast.dismiss(item.id)} aria-label="Zamknij komunikat" aria-describedby={messageId}>
      <X aria-hidden="true" />
    </button>
    <span className="px-toast-timer" aria-hidden="true" />
  </li>;
}

function useLift(stack: RefObject<HTMLElement | null>, active: boolean) {
  const [lift, setLift] = useState(0);
  useLayoutEffect(() => {
    const element = stack.current;
    if (!active || !element) return;
    let observed: HTMLElement[] = [];
    let frame = 0;
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => measure());
    function measure() {
      const obstacles = Array.from(document.querySelectorAll<HTMLElement>(OBSTACLES));
      if (resize && (obstacles.length !== observed.length || obstacles.some((obstacle, index) => obstacle !== observed[index]))) {
        resize.disconnect();
        obstacles.forEach(obstacle => resize.observe(obstacle));
        observed = obstacles;
      }
      const own = element!.getBoundingClientRect();
      const applied = parseFloat(element!.style.getPropertyValue('--px-toasts-lift')) || 0;
      const top = own.top + applied;
      const bottom = own.bottom + applied;
      setLift(obstacles.reduce((needed, obstacle) => {
        const rect = obstacle.getBoundingClientRect();
        if (!rect.height || rect.right <= own.left || rect.left >= own.right || rect.bottom <= top) return needed;
        return Math.max(needed, Math.ceil(bottom - rect.top + GAP));
      }, 0));
    }
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };
    measure();
    const changes = new MutationObserver(schedule);
    changes.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', schedule);
    document.addEventListener('scroll', schedule, { capture: true, passive: true });
    return () => {
      document.removeEventListener('scroll', schedule, { capture: true });
      window.cancelAnimationFrame(frame);
      changes.disconnect();
      resize?.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [stack, active]);
  return active ? lift : 0;
}

export default function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, currentToasts);
  const stack = useRef<HTMLDivElement>(null);
  const lift = useLift(stack, toasts.length > 0);
  const groups = [
    { live: 'polite' as const, label: 'Komunikaty', items: toasts.filter(item => item.kind === 'success' || item.kind === 'info') },
    { live: 'assertive' as const, label: 'Pilne komunikaty', items: toasts.filter(item => item.kind === 'error' || item.kind === 'warning') },
  ];

  return createPortal(<div ref={stack} className="px-toasts" style={{ '--px-toasts-lift': `${lift}px` } as CSSProperties}>
    {groups.map(group => <div key={group.live} className="px-toasts-group" aria-live={group.live} aria-relevant="additions">
      {group.items.length > 0 && <ol aria-label={group.label}>{group.items.map(item => <ToastCard key={item.id} item={item} />)}</ol>}
    </div>)}
  </div>, document.body);
}
