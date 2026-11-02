import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, GripVertical, ListPlus, Lock, Plus, Search, Trash2, Unlink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { difficultyLabels, plural } from './adminFormat';
import { Button } from '@/components/ui/button';
import { ConfirmAction, Section } from './AdminUi';
import { TextField } from './ContentFields';
import type { FieldErrors } from './ContentFields';
import type { ChapterRequest, DifficultyLevel, RoomAdminSummaryDto, RoomTaskRequest, RoomType } from '../../types/api';
import { formatXp } from '../../lib/units';
import { RoomTypeIcon } from './RoomType';
import { poolStatus } from './RoomPaths';

export function move<T>(items: T[], index: number, offset: number) {
  const next = [...items];
  const target = index + offset;
  if (target < 0 || target >= items.length) return items;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
type Slot = { chapter: number; index: number };
// The lifted row follows the pointer: `grab` keeps the spot where it was picked up, `box` its size and column.
type Drag = { roomId: number; from: Slot; target: Slot | null; y: number; grab: number; box: { left: number; width: number } };
// Difficulty is state text only (DESIGN.md), in the shared difficulty hues.
const difficultyText: Record<DifficultyLevel, string> = {
  EASY: 'text-[#1a7f37] dark:text-[#56d364]',
  MEDIUM: 'text-[#8a5d00] dark:text-[#e3b341]',
  HARD: 'text-[#c62828] dark:text-[#ff8a80]',
  INSANE: 'text-[#7a3fd6] dark:text-[#c9a2ff]',
};
const roomsLabel = (count: number) => `${count} ${plural(count, ['pokój', 'pokoje', 'pokoi'])}`;

/** Takes the room out of its chapter and puts it at `to.index` of the target chapter, counted without the room. */
export function placeRoom(chapters: ChapterRequest[], roomId: number, to: Slot) {
  return chapters.map(c => ({ ...c, roomIds: (c.roomIds ?? []).filter(id => id !== roomId) }))
    .map((c, i) => i === to.chapter ? { ...c, roomIds: [...c.roomIds.slice(0, to.index), roomId, ...c.roomIds.slice(to.index)] } : c);
}
/** One keyboard step: within the chapter first, then over its edge into the neighbouring chapter. */
export function stepRoom(chapters: ChapterRequest[], from: Slot, offset: -1 | 1): Slot | null {
  const count = chapters[from.chapter]?.roomIds?.length ?? 0;
  if (offset < 0) {
    if (from.index > 0) return { chapter: from.chapter, index: from.index - 1 };
    return from.chapter > 0 ? { chapter: from.chapter - 1, index: chapters[from.chapter - 1].roomIds?.length ?? 0 } : null;
  }
  if (from.index < count - 1) return { chapter: from.chapter, index: from.index + 1 };
  return from.chapter < chapters.length - 1 ? { chapter: from.chapter + 1, index: 0 } : null;
}

export function ContentChapters({ chapters, rooms, pathId, errors, onChange, onCreateRoom, onRoom, canDelete, highlightRoomId = null, actions }: {
  chapters: ChapterRequest[]; rooms: RoomAdminSummaryDto[]; pathId: number | null; errors: FieldErrors;
  onChange: (chapters: ChapterRequest[]) => void; onCreateRoom: (index: number) => void; onRoom: (id: number, chapterIndex: number) => void; canDelete: boolean;
  highlightRoomId?: number | null; actions?: ReactNode;
}) {
  const [adding, setAdding] = useState<number | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [focusRoom, setFocusRoom] = useState<number | null>(null);
  const lists = useRef(new Map<number, HTMLOListElement>());
  const handles = useRef(new Map<number, HTMLButtonElement>());
  const addButtons = useRef(new Map<number, HTMLButtonElement>());
  const byId = new Map(rooms.map(r => [r.id, r]));
  const assigned = new Set(chapters.flatMap(c => c.roomIds ?? []));
  const available = rooms.filter(r => !assigned.has(r.id)).sort((a, b) => a.title.localeCompare(b.title, 'pl'));
  const titleOf = (id: number) => byId.get(id)?.title ?? `Pokój ${id}`;
  // A room moved into another chapter is a new element, so the keyboard focus is handed back to its grip.
  useEffect(() => {
    if (focusRoom == null) return;
    handles.current.get(focusRoom)?.focus();
    setFocusRoom(null);
  }, [focusRoom, chapters]);

  // Escape cancels a pointer drag wherever the keyboard focus happens to be.
  const dragging = drag != null;
  useEffect(() => {
    if (!dragging) return;
    const cancel = (event: KeyboardEvent) => { if (event.key === 'Escape') setDrag(null); };
    window.addEventListener('keydown', cancel);
    return () => window.removeEventListener('keydown', cancel);
  }, [dragging]);

  const update = (index: number, values: Partial<ChapterRequest>) => onChange(chapters.map((c, i) => i === index ? { ...c, ...values } : c));
  const place = (roomId: number, to: Slot) => {
    onChange(placeRoom(chapters, roomId, to));
    setAnnouncement(`${titleOf(roomId)}: rozdział ${to.chapter + 1}, pozycja ${to.index + 1}.`);
  };
  // The open picker belongs to its chapter, so it moves along when chapters swap places.
  const moveChapter = (index: number, offset: -1 | 1) => {
    onChange(move(chapters, index, offset));
    setAdding(current => current === index ? index + offset : current === index + offset ? index : current);
  };
  const removeChapter = (index: number) => {
    onChange(chapters.filter((_, i) => i !== index));
    setAdding(current => current == null || current < index ? current : current === index ? null : current - 1);
  };
  const closePicker = (index: number) => { setAdding(null); addButtons.current.get(index)?.focus(); };

  // Pointer dragging works the same for mouse, pen and touch; the drop slot is read from the rendered rows.
  const slotAt = (y: number, roomId: number): Slot | null => {
    let best: { chapter: number; distance: number; list: HTMLOListElement } | null = null;
    for (const [chapter, list] of lists.current) {
      const box = list.getBoundingClientRect();
      const distance = y < box.top ? box.top - y : y > box.bottom ? y - box.bottom : 0;
      if (!best || distance < best.distance) best = { chapter, distance, list };
    }
    if (!best) return null;
    const rows = [...best.list.querySelectorAll<HTMLElement>('[data-room-id]')].filter(row => Number(row.dataset.roomId) !== roomId);
    const index = rows.findIndex(row => { const box = row.getBoundingClientRect(); return y < box.top + box.height / 2; });
    return { chapter: best.chapter, index: index < 0 ? rows.length : index };
  };
  const startDrag = (event: React.PointerEvent<HTMLButtonElement>, roomId: number, from: Slot) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.currentTarget.focus();
    const row = (event.currentTarget.closest('li') ?? event.currentTarget).getBoundingClientRect();
    setDrag({ roomId, from, target: null, y: event.clientY, grab: event.clientY - row.top, box: { left: row.left, width: row.width } });
  };
  const moveDrag = (event: React.PointerEvent) => {
    if (!drag) return;
    if (event.clientY < 140) window.scrollBy?.(0, -12);
    else if (event.clientY > window.innerHeight - 60) window.scrollBy?.(0, 12);
    setDrag({ ...drag, y: event.clientY, target: slotAt(event.clientY, drag.roomId) });
  };
  const endDrag = () => {
    if (drag?.target && (drag.target.chapter !== drag.from.chapter || drag.target.index !== drag.from.index)) place(drag.roomId, drag.target);
    setDrag(null);
  };
  const keyStep = (event: React.KeyboardEvent, roomId: number, from: Slot) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    const to = stepRoom(chapters, from, event.key === 'ArrowUp' ? -1 : 1);
    if (!to) return;
    place(roomId, to);
    setFocusRoom(roomId);
  };

  return <section aria-labelledby="path-chapters-heading" className="grid min-w-0 gap-4">
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h2 id="path-chapters-heading" className="text-lg font-semibold text-foreground">Rozdziały</h2>
        <p id="path-chapters-hint" className="mt-0.5 text-sm text-muted-foreground">Przeciągnij pokój za uchwyt, żeby zmienić kolejność albo rozdział. Z klawiatury: strzałki na uchwycie.</p>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
    {errors.chapters && <p role="alert" className="text-sm text-destructive">{errors.chapters}</p>}
    <p aria-live="polite" className="sr-only">{announcement}</p>
    <ol className="grid min-w-0 gap-4" aria-label="Rozdziały ścieżki">
      {chapters.map((chapter, index) => {
        const roomIds = chapter.roomIds ?? [];
        const problem = errors[`chapters.${index}.rooms`];
        const titleError = errors[`chapters.${index}.title`] ?? (chapter.title.length > 120 ? 'Maksymalnie 120 znaków' : undefined);
        const titleId = `content-chapters.${index}.title`;
        const target = drag?.target?.chapter === index ? drag.target.index : null;
        const noop = drag != null && drag.target != null && drag.target.chapter === drag.from.chapter && drag.target.index === drag.from.index;
        let slot = 0;
        const marker = (at: number) => target === at && !noop ? <li key={`drop-${at}`} aria-hidden="true" className="relative h-0"><span className="absolute inset-x-3 -top-px h-0.5 rounded-full bg-primary" /></li> : null;
        return <li key={chapter.id ?? `new-${index}`} className="relative min-w-0 pl-10">
          <span aria-hidden="true" className="absolute top-3.5 left-0 flex size-7 items-center justify-center rounded-full border-2 border-primary bg-background text-xs font-semibold text-primary tabular-nums">{index + 1}</span>
          {index < chapters.length - 1 && <span aria-hidden="true" className="absolute top-[2.625rem] bottom-[-1.375rem] left-[13px] border-l-2 border-primary/30" />}
          <div className={cn('min-w-0 rounded-lg border bg-card text-card-foreground', (problem || titleError) && 'border-destructive/60')}>
          <header className="flex items-center gap-2 px-3 pt-3 pb-2 sm:px-4">
            <div className="min-w-0 flex-1">
              <Label htmlFor={titleId} className="sr-only">Nazwa rozdziału {index + 1}</Label>
              <Input id={titleId} value={chapter.title} aria-required aria-invalid={!!titleError} aria-describedby={titleError ? `${titleId}-error` : undefined}
                onChange={e => update(index, { title: e.target.value })}
                className="h-9 border-transparent bg-transparent px-2 text-base font-semibold shadow-none hover:border-input dark:bg-transparent" />
            </div>
            <span className="hidden shrink-0 text-xs text-muted-foreground tabular-nums sm:inline">{roomsLabel(roomIds.length)}</span>
            <div className="flex shrink-0 items-center">
              <Button type="button" variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => moveChapter(index, -1)} aria-label={`Przesuń rozdział ${index + 1} w górę`}><ArrowUp /></Button>
              <Button type="button" variant="ghost" size="icon-sm" disabled={index === chapters.length - 1} onClick={() => moveChapter(index, 1)} aria-label={`Przesuń rozdział ${index + 1} w dół`}><ArrowDown /></Button>
              {(canDelete || chapter.id == null) && (roomIds.length ? <ConfirmAction title={`Usunąć rozdział ${index + 1}?`} confirmLabel="Usuń rozdział"
                description={`Rozdział „${chapter.title.trim() || 'Bez nazwy'}” zniknie ze ścieżki razem z ${roomsLabel(roomIds.length)} po zapisie. Same pokoje zostaną w puli.`}
                onConfirm={() => removeChapter(index)}
                trigger={<Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" aria-label={`Usuń rozdział ${index + 1}`}><Trash2 /></Button>} />
                : <Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" aria-label={`Usuń rozdział ${index + 1}`} onClick={() => removeChapter(index)}><Trash2 /></Button>)}
            </div>
          </header>
          {titleError && <p id={`${titleId}-error`} role="alert" className="px-4 pb-2 text-sm text-destructive sm:px-5">{titleError}</p>}
          <ol ref={node => { if (node) lists.current.set(index, node); else lists.current.delete(index); }} aria-label={`Pokoje rozdziału ${index + 1}`}
            className={cn('mx-1.5 min-h-12 rounded-md sm:mx-2', drag && 'bg-muted/30')}>
            {roomIds.map((id, roomIndex) => {
              const room = byId.get(id);
              const title = titleOf(id);
              const dragged = drag?.roomId === id;
              const rowMarker = dragged ? null : marker(slot++);
              return [rowMarker, <li key={id} data-room-id={id}
                className={cn('flex min-w-0 items-center gap-2 rounded-md py-2 pr-1 pl-0.5 transition-colors duration-700 motion-reduce:transition-none sm:gap-3 sm:pr-2',
                  dragged ? 'opacity-40' : 'hover:bg-accent/60', highlightRoomId === id && 'bg-primary/15 hover:bg-primary/15')}>
                <button type="button" ref={node => { if (node) handles.current.set(id, node); else handles.current.delete(id); }}
                  aria-label={`Przesuń ${title}`} aria-describedby="path-chapters-hint"
                  className="flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
                  onPointerDown={e => startDrag(e, id, { chapter: index, index: roomIndex })} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={() => setDrag(null)}
                  onKeyDown={e => keyStep(e, id, { chapter: index, index: roomIndex })}>
                  <GripVertical aria-hidden="true" className="size-4" />
                </button>
                <span className="w-8 shrink-0 text-xs text-muted-foreground tabular-nums">{index + 1}.{roomIndex + 1}</span>
                <RoomSummary room={room} title={title} pathId={pathId} />
                <Button type="button" variant="ghost" size="sm" className="shrink-0" aria-label={`Edytuj ${title}`} onClick={() => onRoom(id, index)}>Edytuj</Button>
                <Button type="button" variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground hover:text-destructive" aria-label={`Odepnij ${title} od tej ścieżki`} title="Odepnij od tej ścieżki"
                  onClick={() => update(index, { roomIds: roomIds.filter(r => r !== id) })}><Unlink aria-hidden="true" /></Button>
              </li>];
            })}
            {marker(slot)}
            {roomIds.length === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">{drag ? 'Upuść tutaj.' : 'Ten rozdział nie ma jeszcze pokoi.'}</li>}
          </ol>
          <div className="flex flex-wrap gap-1 px-2 pt-1 pb-2 sm:px-3">
            <Button type="button" variant="ghost" size="sm" id={`content-chapters.${index}.rooms`} aria-expanded={adding === index} aria-controls={`chapter-${index}-picker`}
              ref={node => { if (node) addButtons.current.set(index, node); else addButtons.current.delete(index); }}
              onClick={() => adding === index ? closePicker(index) : setAdding(index)}><ListPlus />Dodaj istniejący</Button>
            <Button type="button" variant="ghost" size="sm" aria-label={`Nowy pokój w rozdziale ${index + 1}`} onClick={() => onCreateRoom(index)}><Plus />Nowy pokój</Button>
          </div>
          {adding === index && <RoomPicker id={`chapter-${index}-picker`} chapter={index + 1} rooms={available} pathId={pathId}
            onAdd={id => update(index, { roomIds: [...roomIds, id] })} onClose={() => closePicker(index)} />}
          {problem && <p role="alert" className="border-t border-destructive/30 px-4 py-2 text-sm text-destructive">{problem}</p>}
          </div>
        </li>;
      })}
    </ol>
    {drag && createPortal(<div aria-hidden="true" className="pointer-events-none fixed z-50 flex items-center gap-2 rounded-md bg-card py-2 pr-2 pl-0.5 text-card-foreground shadow-[0_0_0_1px_rgba(15,23,36,0.08),0_12px_28px_rgba(15,23,36,0.16)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_12px_32px_rgba(0,0,0,0.45)] sm:gap-3"
      style={{ top: drag.y - drag.grab, left: drag.box.left, width: drag.box.width }}>
      <span className="flex size-8 shrink-0 items-center justify-center text-foreground"><GripVertical className="size-4" /></span>
      <RoomSummary room={byId.get(drag.roomId)} title={titleOf(drag.roomId)} pathId={pathId} />
    </div>, document.body)}
    <Button type="button" variant="outline" className="ml-10 w-fit" data-field="chapters" onClick={() => onChange([...chapters, { id: null, title: `Rozdział ${chapters.length + 1}`, roomIds: [] }])}><Plus />Dodaj rozdział</Button>
  </section>;
}

function RoomSummary({ room, title, pathId }: { room: RoomAdminSummaryDto | undefined; title: string; pathId: number | null }) {
  const others = room?.paths.filter(p => p.id !== pathId) ?? [];
  return <>
    <RoomTypeIcon type={room?.roomType} labelled className="size-4 shrink-0 text-muted-foreground" />
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium" title={title}>{title}</p>
      <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground tabular-nums">
        {room?.roomType === 'CTF' && <span className={difficultyText[room.difficulty]}>{difficultyLabels[room.difficulty]}</span>}
        {room && <span>{formatXp(room.points)}</span>}
        {room?.requiresVpn && <span className="inline-flex items-center gap-1"><Lock aria-hidden="true" className="size-3" />VPN</span>}
        {others.length > 0 && <span title={others.map(p => p.title).join(', ')}>{poolStatus(room?.paths ?? [], pathId).label.replace(/^W /, 'Też w ')}</span>}
      </p>
    </div>
  </>;
}

// The picker lists rooms a page at a time; the search narrows the whole list.
const pickerPage = 20;

function RoomPicker({ id, chapter, rooms, pathId, onAdd, onClose }: {
  id: string; chapter: number; rooms: RoomAdminSummaryDto[]; pathId: number | null; onAdd: (id: number) => void; onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(pickerPage);
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => { search.current?.focus(); }, []);
  const term = query.trim().toLocaleLowerCase('pl');
  const found = rooms.filter(r => !term || r.title.toLocaleLowerCase('pl').includes(term));
  const matches = found.slice(0, shown);
  return <div id={id} className="mx-2 mb-3 rounded-md bg-muted/50 p-3 sm:mx-3" onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}>
    <div className="relative">
      <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input ref={search} type="search" aria-label={`Szukaj pokoju do rozdziału ${chapter}`} placeholder="Szukaj po tytule" value={query} onChange={e => { setQuery(e.target.value); setShown(pickerPage); }} className="h-9 bg-background pl-8" />
    </div>
    {matches.length ? <ul className="mt-2 max-h-72 overflow-y-auto" aria-label={`Pokoje do dodania w rozdziale ${chapter}`}>
      {matches.map(r => {
        const status = poolStatus(r.paths, pathId);
        return <li key={r.id} className="flex min-w-0 items-center gap-3 rounded-md py-1.5 pr-1 pl-2 hover:bg-background/60">
          <RoomTypeIcon type={r.roomType} labelled className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm" title={r.title}>{r.title}</span>
            <span className="block truncate text-xs text-muted-foreground" title={status.title}>{status.label}</span>
          </span>
          <Button type="button" variant="outline" size="sm" aria-label={`Dodaj ${r.title} do rozdziału`} onClick={() => { onAdd(r.id); search.current?.focus(); }}>Dodaj</Button>
        </li>;
      })}
    </ul> : null}
    {found.length > matches.length && <Button type="button" variant="ghost" size="sm" className="mt-1" onClick={() => setShown(count => count + pickerPage)}>
      Pokaż więcej <span className="text-muted-foreground tabular-nums">({found.length - matches.length})</span>
    </Button>}
    {!matches.length && <p className="px-2 pt-3 pb-1 text-sm text-muted-foreground">{term ? 'Brak pasujących pokoi.' : 'Wszystkie pokoje są już w tej ścieżce.'}</p>}
  </div>;
}
type TaskField = 'title' | 'content' | 'question' | 'answer';
const taskLimits: Record<TaskField, number> = { title: 255, content: 20000, question: 2000, answer: 255 };
// A CTF task keeps a question written in theory mode; the field goes away once it is empty.
function taskFields(kind: RoomType, task: RoomTaskRequest): TaskField[] {
  return kind === 'CTF' && !task.question?.trim() ? ['title', 'content', 'answer'] : ['title', 'content', 'question', 'answer'];
}
function taskRequired(kind: RoomType, field: TaskField, task: RoomTaskRequest, ready: boolean) {
  if (field === 'title') return true;
  if (!ready) return false;
  if (field === 'content') return true;
  if (field === 'answer') return kind === 'CTF' || !!task.question?.trim();
  return kind === 'PATH' && !!task.answer?.trim();
}
function taskBadge(kind: RoomType, task: RoomTaskRequest) {
  if (kind === 'CTF') return task.answer?.trim() ? 'Z flagą' : 'Bez flagi';
  return task.question?.trim() ? 'Z pytaniem' : 'Lektura';
}
export function ContentTasks({ tasks, kind, errors, ready, onChange }: { tasks: RoomTaskRequest[]; kind: RoomType; errors: FieldErrors; ready: boolean; onChange: (tasks: RoomTaskRequest[]) => void }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const ctf = kind === 'CTF';
  const update = (index: number, field: keyof RoomTaskRequest, value: string) => onChange(tasks.map((t, i) => i === index ? { ...t, [field]: value } : t));
  const toggle = (index: number) => setOpen(current => { const next = new Set(current); if (next.has(index)) next.delete(index); else next.add(index); return next; });
  const labels: Record<TaskField, string> = { title: 'Tytuł zadania', content: 'Treść', question: ctf ? 'Pytanie (opcjonalnie)' : 'Pytanie', answer: ctf ? 'Flaga' : 'Odpowiedź' };
  return <Section title="Zadania" description={ctf ? 'Każde zadanie kończy się flagą. Gracz wpisuje ją dokładnie tak, jak ją znalazł.' : 'Ułóż kolejne kroki pokoju. Postępy w zachowanych zadaniach pozostają bez zmian.'}>
    {errors.tasks && <p role="alert" className="mb-4 text-sm text-destructive">{errors.tasks}</p>}
    {tasks.length === 0 && <p className="mb-4 rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">{ctf ? 'Dodaj zadanie z flagą. Pokój jest rozwiązany, gdy gracz zdobędzie wszystkie flagi.' : 'Dodaj zadania, aby poprowadzić gracza krok po kroku. Pokój jest rozwiązany, gdy gracz ukończy wszystkie zadania.'}</p>}
    <ol className="grid gap-3">{tasks.map((task, index) => {
      const hasError = Object.keys(errors).some(key => key.startsWith(`tasks.${index}.`));
      const expanded = open.has(index) || hasError;
      return <li key={task.id ?? `new-${index}`} className={cn('overflow-hidden rounded-lg border bg-background/30', hasError && 'border-destructive/60')}>
        <header className="flex items-center gap-2 px-3 py-2.5">
          <span className="w-6 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">{String(index + 1).padStart(2, '0')}.</span>
          <button type="button" className="flex min-w-0 flex-1 items-center gap-2 rounded py-1 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-expanded={expanded} aria-controls={`content-task-${index}-panel`} onClick={() => toggle(index)}>
            <span className={cn('truncate font-medium', !task.title.trim() && 'text-muted-foreground italic')}>{task.title.trim() || 'Zadanie bez tytułu'}</span>
            <Badge variant="outline" className="hidden text-[10px] text-muted-foreground sm:inline-flex">{taskBadge(kind, task)}</Badge>
            <ChevronDown className={cn('ml-auto size-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
          </button>
          <div className="flex shrink-0 items-center">
            <Button type="button" variant="ghost" size="icon-sm" disabled={index === 0} aria-label={`Przesuń zadanie ${index + 1} w górę`} onClick={() => { onChange(move(tasks, index, -1)); setOpen(new Set([index - 1])); }}><ArrowUp /></Button>
            <Button type="button" variant="ghost" size="icon-sm" disabled={index === tasks.length - 1} aria-label={`Przesuń zadanie ${index + 1} w dół`} onClick={() => { onChange(move(tasks, index, 1)); setOpen(new Set([index + 1])); }}><ArrowDown /></Button>
            <Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" aria-label={`Usuń zadanie ${index + 1}`} onClick={() => onChange(tasks.filter((_, i) => i !== index))}><Trash2 /></Button>
          </div>
        </header>
        {expanded && <div id={`content-task-${index}-panel`} className="grid gap-4 border-t px-4 py-4 md:grid-cols-2">
          {taskFields(kind, task).map(field => <div key={field} className={field === 'title' || field === 'content' || ctf ? 'md:col-span-2' : ''}><TextField name={`tasks.${index}.${field}`} label={labels[field]} value={task[field] ?? ''} limit={taskLimits[field]} multiline={field === 'content'} mono={ctf && field === 'answer'} placeholder={ctf && field === 'answer' ? 'HACK{...}' : undefined} required={taskRequired(kind, field, task, ready)} error={errors[`tasks.${index}.${field}`]} onChange={value => update(index, field, value)} /></div>)}
          <p className="text-xs leading-relaxed text-muted-foreground md:col-span-2">{ctf ? 'Wielkość liter we fladze ma znaczenie. ' : ''}Treść obsługuje podstawowe formatowanie HTML. Usunięcie zadania usuwa również postęp graczy w tym zadaniu.</p>
        </div>}
      </li>;
    })}</ol>
    <Button type="button" variant="outline" className="mt-4" data-field="tasks" onClick={() => { setOpen(current => new Set(current).add(tasks.length)); onChange([...tasks, { id: null, title: '', content: '', question: null, answer: null }]); }}><Plus />{ctf ? 'Dodaj zadanie z flagą' : 'Dodaj zadanie'}</Button>
  </Section>;
}
