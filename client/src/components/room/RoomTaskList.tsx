import { useEffect, useRef, useState } from 'react';
import { Check, Lock, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { RoomStep } from './RoomFooterBar';

interface RoomTaskListProps {
  steps: RoomStep[];
  current: number;
  onSelect: (index: number) => void;
  collapsed: boolean;
  onToggle: () => void;
}

export function useStoredFlag(key: string) {
  const [value, setValue] = useState(() => {
    try { return window.localStorage.getItem(key) === '1'; } catch { return false; }
  });
  const store = (next: boolean) => {
    setValue(next);
    try { window.localStorage.setItem(key, next ? '1' : '0'); } catch { return; }
  };
  return [value, store] as const;
}

export function RoomTaskList({ steps, current, onSelect, collapsed, onToggle }: RoomTaskListProps) {
  const list = useRef<HTMLOListElement>(null);
  const done = steps.filter(step => step.done).length;

  useEffect(() => {
    list.current?.querySelector('[aria-current]')?.scrollIntoView?.({ block: 'nearest' });
  }, [current, collapsed]);

  return (
    <aside className={cn('room-tasklist', collapsed && 'is-rail')} aria-label="Spis zadań">
      <div className="room-tasklist-head">
        {!collapsed && <p className="room-kicker">Zadania</p>}
        <span className="room-tasklist-count" aria-label={`Ukończone zadania: ${done} z ${steps.length}`}>{done}/{steps.length}</span>
        <button type="button" className="room-tasklist-hide" aria-expanded={!collapsed}
          aria-label={collapsed ? 'Rozwiń spis zadań' : 'Zwiń spis zadań'} title={collapsed ? 'Rozwiń spis zadań' : 'Zwiń spis zadań'} onClick={onToggle}>
          {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
        </button>
      </div>
      <ol ref={list}>
        {steps.map((step, index) => (
          <li key={step.key}>
            <button type="button" disabled={step.locked} aria-current={index === current ? 'step' : undefined}
              title={collapsed ? `${index + 1}. ${step.title}` : undefined}
              className={cn('room-tasklist-item', step.done && 'is-done')} onClick={() => onSelect(index)}>
              <span className="room-tasklist-mark" aria-hidden="true">
                {step.done ? <Check /> : step.locked ? <Lock /> : index + 1}
              </span>
              <span className={collapsed ? 'sr-only' : 'room-tasklist-title'}>{step.title}</span>
              {step.done && <span className="sr-only">, ukończone</span>}
            </button>
          </li>
        ))}
      </ol>
    </aside>
  );
}
