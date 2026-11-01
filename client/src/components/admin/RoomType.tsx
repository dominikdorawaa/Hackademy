import { useEffect, useRef, useState } from 'react';
import { Popover } from 'radix-ui';
import { GraduationCap, Info, SquareTerminal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RoomType } from '../../types/api';

export const roomTypes: { type: RoomType; label: string; icon: LucideIcon; summary: string }[] = [
  { type: 'PATH', label: 'Teoria', icon: GraduationCap, summary: 'Materiał do przeczytania, potem pytanie i odpowiedź do wpisania. Dobre do nauki pojęć.' },
  { type: 'CTF', label: 'CTF', icon: SquareTerminal, summary: 'Zadania, w których gracz szuka flagi, np. HACK{...}. Opcjonalnie VPN i pliki do pobrania.' },
];

const entryFor = (type: RoomType | undefined) => roomTypes.find(entry => entry.type === type) ?? roomTypes[0];

export const roomTypeLabel = (type: RoomType | undefined) => entryFor(type).label;

export function RoomTypeIcon({ type, className, labelled = false }: { type: RoomType | undefined; className?: string; labelled?: boolean }) {
  const Icon = entryFor(type).icon;
  return labelled ? <Icon role="img" aria-label={roomTypeLabel(type)} className={className} /> : <Icon aria-hidden="true" className={className} />;
}

export function RoomTypeSwitch({ value, onChange, label }: { value: RoomType; onChange: (type: RoomType) => void; label: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (index: number) => {
    const next = (index + roomTypes.length) % roomTypes.length;
    onChange(roomTypes[next].type);
    refs.current[next]?.focus();
  };
  return <div role="radiogroup" aria-label={label} data-field="roomType" className="inline-flex w-fit rounded-md bg-muted/50 p-0.5">
    {roomTypes.map((entry, index) => {
      const selected = entry.type === value;
      return <button key={entry.type} ref={node => { refs.current[index] = node; }} type="button" role="radio" aria-checked={selected}
        tabIndex={selected ? 0 : -1}
        onClick={() => onChange(entry.type)}
        onKeyDown={event => {
          if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); move(index + 1); }
          if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); move(index - 1); }
        }}
        className={cn('inline-flex h-9 items-center gap-2 rounded-[5px] px-4 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
          selected && 'bg-background font-medium text-foreground shadow-xs')}>
        <entry.icon aria-hidden="true" className={cn('size-4', selected && 'text-primary')} />
        {entry.label}
      </button>;
    })}
  </div>;
}

export function RoomTypeHelp() {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const trigger = useRef<HTMLButtonElement>(null);
  const tapped = useRef(false);
  const show = () => { clearTimeout(closeTimer.current); setOpen(true); };
  const leave = () => {
    if (document.activeElement === trigger.current) return;
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  return <Popover.Root open={open} onOpenChange={setOpen}>
    <Popover.Trigger asChild>
      <button ref={trigger} type="button" aria-label="Czym różnią się typy pokoi?"
        className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        onPointerDown={event => { tapped.current = event.pointerType === 'touch'; }}
        onPointerEnter={event => { if (event.pointerType !== 'touch') show(); }} onPointerLeave={leave}
        onFocus={show} onClick={event => {
          event.preventDefault();
          if (open && tapped.current) setOpen(false); else show();
        }}>
        <Info aria-hidden="true" className="size-4" />
      </button>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content side="bottom" align="start" sideOffset={8} collisionPadding={16} aria-label="Typy pokoi"
        onOpenAutoFocus={event => event.preventDefault()} onCloseAutoFocus={event => event.preventDefault()}
        onPointerEnter={() => clearTimeout(closeTimer.current)} onPointerLeave={leave}
        className="z-50 grid w-[min(20rem,calc(100vw-32px))] gap-3 rounded-md border bg-popover px-3.5 py-3 text-sm leading-normal text-popover-foreground shadow-lg animate-in fade-in-0 slide-in-from-top-1 duration-150">
        {roomTypes.map(entry => <div key={entry.type} className="grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-0.5">
          <entry.icon aria-hidden="true" className="mt-0.5 size-4 text-primary" />
          <strong className="font-semibold">{entry.label}</strong>
          <p className="col-start-2 text-muted-foreground">{entry.summary}</p>
        </div>)}
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}
