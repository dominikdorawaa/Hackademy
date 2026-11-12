import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronLeft, ChevronRight, List, Lock, PanelLeftOpen } from 'lucide-react';
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

interface RoomFooterSteps {
  steps: RoomStep[];
  current: number;
  list?: boolean;
  listHeader?: ReactNode;
  onPin?: () => void;
  unit: string;
  listLabel: string;
  onSelect: (index: number) => void;
}

interface RoomFooterBarProps {
  progress?: RoomFooterSteps;
  title?: string;
  badge?: ReactNode;
  back?: RoomFooterAction;
  next: RoomFooterAction & { primary?: boolean };
}

export default function RoomFooterBar({ progress, title, badge, back, next }: RoomFooterBarProps) {
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
        {progress && progress.list !== false && (
          <button ref={toggle} type="button" className="room-btn room-btn--icon" aria-label={progress.listLabel}
            aria-expanded={open} aria-controls={listId} onClick={() => setOpen(value => !value)}>
            <List aria-hidden="true" />
          </button>
        )}
        {progress && progress.list !== false && open && (
          <nav id={listId} className="room-steps" aria-label={progress.listLabel}>
            <div className="room-steps-head">
              <div className="room-steps-title">
                <p className="room-kicker">Zadania</p>
                {progress.onPin && (
                  <button type="button" className="room-tasklist-hide" aria-label="Pokaż spis z boku" title="Pokaż spis z boku"
                    onClick={() => { setOpen(false); progress.onPin?.(); }}>
                    <PanelLeftOpen aria-hidden="true" />
                  </button>
                )}
              </div>
              {progress.listHeader && <div className="room-steps-meta">{progress.listHeader}</div>}
            </div>
            <ol>
              {progress.steps.map((step, index) => (
                <li key={step.key}>
                  <button type="button" disabled={step.locked} aria-current={index === progress.current ? 'step' : undefined}
                    aria-label={step.done ? `${step.title}, ukończone` : undefined}
                    className={cn(step.done && 'is-done')}
                    onClick={() => { setOpen(false); progress.onSelect(index); }}>
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
          {title && <strong title={title}>{title}</strong>}
          {(progress || badge) && (
            <span>
              {progress && `${progress.unit} ${Math.min(progress.current + 1, progress.steps.length)} / ${progress.steps.length}`}
              {badge}
            </span>
          )}
        </div>
      </div>
      <div className="room-footer-lane" />
      <div className="room-footer-end">
        {back && (
          <button type="button" className="room-btn" disabled={back.disabled} onClick={back.onClick}>
            <ChevronLeft aria-hidden="true" />{back.label}
          </button>
        )}
        <button type="button" className={cn('room-btn', next.primary && 'room-btn--primary')} disabled={next.disabled} onClick={next.onClick}>
          {next.label}<ChevronRight aria-hidden="true" />
        </button>
      </div>
    </footer>
  );
}
