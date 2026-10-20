import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronLeft, ChevronRight, List, Lock } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface RoomStep {
  key: string | number;
  title: string;
  done: boolean;
  locked?: boolean;
}

interface RoomFooterAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

interface RoomFooterBarProps {
  steps: RoomStep[];
  current: number;
  unit: string;
  listLabel: string;
  title: string;
  badge?: ReactNode;
  center?: ReactNode;
  onSelect: (index: number) => void;
  back: RoomFooterAction;
  next: RoomFooterAction & { primary?: boolean };
}

export default function RoomFooterBar({ steps, current, unit, listLabel, title, badge, center, onSelect, back, next }: RoomFooterBarProps) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      toggle.current?.focus();
    };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <footer className="room-footer">
      <div className="room-footer-start" ref={root}>
        <button ref={toggle} type="button" className="room-btn room-btn--icon" aria-label={listLabel}
          aria-expanded={open} aria-controls={listId} onClick={() => setOpen(value => !value)}>
          <List aria-hidden="true" />
        </button>
        {open && (
          <nav id={listId} className="room-steps" aria-label={listLabel}>
            <ol>
              {steps.map((step, index) => (
                <li key={step.key}>
                  <button type="button" disabled={step.locked} aria-current={index === current ? 'step' : undefined}
                    aria-label={step.done ? `${step.title}, ukończone` : undefined}
                    className={cn(step.done && 'is-done')}
                    onClick={() => { setOpen(false); onSelect(index); }}>
                    <span className="room-steps-mark" aria-hidden="true">
                      {step.done ? <Check /> : step.locked ? <Lock /> : String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="room-steps-title">{step.title}</span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        )}
        <div className="room-footer-where">
          <strong title={title}>{title}</strong>
          <span>
            {unit} {Math.min(current + 1, steps.length)} / {steps.length}
            {badge}
          </span>
        </div>
      </div>
      <div className="room-footer-center">{center}</div>
      <div className="room-footer-end">
        <button type="button" className="room-btn" disabled={back.disabled} onClick={back.onClick}>
          <ChevronLeft aria-hidden="true" />{back.label}
        </button>
        <button type="button" className={cn('room-btn', next.primary && 'room-btn--primary')} disabled={next.disabled} onClick={next.onClick}>
          {next.label}<ChevronRight aria-hidden="true" />
        </button>
      </div>
    </footer>
  );
}
