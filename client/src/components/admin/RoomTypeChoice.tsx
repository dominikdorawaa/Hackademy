import { useRef } from 'react';
import { BookOpen, Flag } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RoomType } from '../../types/api';

export const roomTypes: { type: RoomType; label: string; icon: LucideIcon; summary: string; parts: string[] }[] = [
  { type: 'PATH', label: 'Teoria', icon: BookOpen, summary: 'Lekcja prowadzi gracza przez treść i pytania sprawdzające.', parts: ['Treść zadania', 'Pytanie i odpowiedź', 'XP ustalasz sam'] },
  { type: 'CTF', label: 'CTF', icon: Flag, summary: 'Gracz szuka flagi i wpisuje ją jako odpowiedź na zadanie.', parts: ['Treść zadania i flaga', 'Opcjonalnie VPN i plik do pobrania', 'XP wynika z trudności'] },
];

export const roomTypeLabel = (type: RoomType | undefined) => roomTypes.find(entry => entry.type === type)?.label ?? 'Teoria';

export function RoomTypeIcon({ type, className, labelled = false }: { type: RoomType | undefined; className?: string; labelled?: boolean }) {
  const Icon = type === 'CTF' ? Flag : BookOpen;
  return labelled ? <Icon role="img" aria-label={roomTypeLabel(type)} className={className} /> : <Icon aria-hidden="true" className={className} />;
}

export function RoomTypeChoice({ value, onChange, label, compact = false }: {
  value: RoomType | null; onChange: (type: RoomType) => void; label: string; compact?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = roomTypes.findIndex(entry => entry.type === value);
  const move = (index: number) => {
    const next = (index + roomTypes.length) % roomTypes.length;
    onChange(roomTypes[next].type);
    refs.current[next]?.focus();
  };
  return <div role="radiogroup" aria-label={label} data-field="roomType" className={cn('grid gap-3', compact ? 'grid-cols-2 sm:max-w-md' : 'sm:grid-cols-2')}>
    {roomTypes.map((entry, index) => {
      const selected = entry.type === value;
      return <button key={entry.type} ref={node => { refs.current[index] = node; }} type="button" role="radio" aria-checked={selected}
        tabIndex={selected || (current < 0 && index === 0) ? 0 : -1}
        onClick={() => onChange(entry.type)}
        onKeyDown={event => {
          if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); move(index + 1); }
          if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); move(index - 1); }
        }}
        className={cn('group grid min-w-0 content-start gap-2 rounded-md bg-muted/40 text-left outline-none ring-1 ring-transparent transition-[background-color,box-shadow,transform] duration-150 ease-out hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px',
          compact ? 'px-3 py-2.5' : 'p-5',
          selected && 'bg-primary/12 ring-primary hover:bg-primary/15')}>
        <span className="flex items-center gap-2.5">
          <span className={cn('flex shrink-0 items-center justify-center rounded-md bg-background/60 text-muted-foreground transition-colors', compact ? 'size-7' : 'size-10', selected && 'bg-primary text-primary-foreground')}>
            <entry.icon className={compact ? 'size-4' : 'size-5'} aria-hidden="true" />
          </span>
          <span className={cn('font-semibold', compact ? 'text-sm' : 'text-lg')}>{entry.label}</span>
        </span>
        {!compact && <>
          <span className="text-sm leading-relaxed text-muted-foreground">{entry.summary}</span>
          <ul className="grid gap-1 text-sm">
            {entry.parts.map(part => <li key={part} className="flex items-baseline gap-2"><span aria-hidden="true" className={cn('size-1.5 shrink-0 translate-y-[-1px] rounded-full bg-muted-foreground/50', selected && 'bg-primary')} />{part}</li>)}
          </ul>
        </>}
      </button>;
    })}
  </div>;
}
