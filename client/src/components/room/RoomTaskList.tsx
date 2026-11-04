import { useEffect, useRef, useState } from 'react';
import { Check, Lock, Maximize2, Minimize2, PanelLeftClose } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { RoomStep } from './RoomFooterBar';

interface RoomTaskListProps {
  steps: RoomStep[];
  current: number;
  onSelect: (index: number) => void;
  onHide: () => void;
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

export function RoomTaskList({ steps, current, onSelect, onHide }: RoomTaskListProps) {
  const [short, setShort] = useStoredFlag('hackademy.roomTaskList.short');
  const list = useRef<HTMLOListElement>(null);

  useEffect(() => {
    list.current?.querySelector('[aria-current]')?.scrollIntoView?.({ block: 'nearest' });
  }, [current, short]);

  const item = (index: number) => {
    const step = steps[index];
    return (
      <li key={step.key}>
        <button type="button" disabled={step.locked} aria-current={index === current ? 'step' : undefined}
          className={cn('room-tasklist-item', step.done && 'is-done')} onClick={() => onSelect(index)}>
          <span className="room-tasklist-mark" aria-hidden="true">
            {step.done ? <Check /> : step.locked ? <Lock /> : index + 1}
          </span>
          <span className="room-tasklist-title">{step.title}</span>
          {step.done && <span className="sr-only">, ukończone</span>}
        </button>
      </li>
    );
  };

  return (
    <aside className="room-tasklist" aria-label="Spis zadań">
      <div className="room-tasklist-head">
        <p className="room-kicker">Zadania</p>
        <button type="button" className="room-tasklist-hide" aria-label="Ukryj spis zadań" title="Ukryj spis zadań" onClick={onHide}>
          <PanelLeftClose aria-hidden="true" />
        </button>
      </div>
      <ol ref={list}>
        {short ? (
          <>
            <li className="room-tasklist-label" aria-hidden="true">Teraz</li>
            {item(current)}
            {current + 1 < steps.length && <>
              <li className="room-tasklist-label" aria-hidden="true">Następne</li>
              {item(current + 1)}
            </>}
          </>
        ) : steps.map((_, index) => item(index))}
      </ol>
      <button type="button" className="room-tasklist-toggle" aria-expanded={!short} onClick={() => setShort(!short)}>
        {short ? <><Maximize2 aria-hidden="true" />Pokaż wszystkie</> : <><Minimize2 aria-hidden="true" />Zwiń</>}
      </button>
    </aside>
  );
}
