import { useState } from 'react';
import { ArrowDown, ArrowUp, ArrowRightLeft, ChevronDown, LibraryBig, Lock, Plus, Search, Trash2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { plural } from './adminFormat';
import { Button } from '@/components/ui/button';
import { Section } from './AdminUi';
import { TextField } from './ContentFields';
import type { FieldErrors } from './ContentFields';
import type { ChapterRequest, RoomAdminSummaryDto, RoomTaskRequest } from '../../types/api';

export function move<T>(items: T[], index: number, offset: number) {
  const next = [...items];
  const target = index + offset;
  if (target < 0 || target >= items.length) return items;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
export function ContentChapters({ chapters, rooms, pathId, errors, onChange, onCreateRoom, onRoom, canDelete }: {
  chapters: ChapterRequest[]; rooms: RoomAdminSummaryDto[]; pathId: number | null; errors: FieldErrors;
  onChange: (chapters: ChapterRequest[]) => void; onCreateRoom: (index: number) => void; onRoom: (id: number) => void; canDelete: boolean;
}) {
  const [targetIndex, setTargetIndex] = useState(0);
  const [query, setQuery] = useState('');
  const target = chapters[targetIndex] ? targetIndex : Math.max(0, chapters.length - 1);
  const assigned = new Set(chapters.flatMap(c => c.roomIds ?? []));
  const pool = rooms.filter(r => r.roomType === 'PATH' && !assigned.has(r.id) && (r.pathId == null || r.pathId === pathId))
    .filter(r => !query.trim() || r.title.toLocaleLowerCase('pl').includes(query.trim().toLocaleLowerCase('pl')))
    .sort((a, b) => a.title.localeCompare(b.title, 'pl'));
  const update = (index: number, values: Partial<ChapterRequest>) => onChange(chapters.map((c, i) => i === index ? { ...c, ...values } : c));
  const reorder = (index: number, offset: number) => {
    if (target === index) setTargetIndex(index + offset);
    else if (target === index + offset) setTargetIndex(index);
    onChange(move(chapters, index, offset));
  };
  return <Section title="Rozdziały i pokoje" description="Ułóż program ścieżki. Dodawaj pokoje z puli lub twórz je bezpośrednio w rozdziale.">
    {errors.chapters && <p role="alert" className="mb-4 text-sm text-destructive">{errors.chapters}</p>}
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <ol className="min-w-0 space-y-5" aria-label="Rozdziały ścieżki">
        {chapters.map((chapter, index) => {
          const roomIds = chapter.roomIds ?? [];
          const problem = errors[`chapters.${index}.rooms`];
          return <li key={chapter.id ?? `new-${index}`} className="relative pl-10">
            <span aria-hidden="true" className="absolute top-4 left-0 flex size-7 items-center justify-center rounded-full border-2 border-primary/70 bg-background font-mono text-xs font-semibold text-primary tabular-nums">{index + 1}</span>
            {index < chapters.length - 1 && <span aria-hidden="true" className="absolute top-12 bottom-[-1.25rem] left-[13px] border-l-2 border-primary/20" />}
            <div className={cn('min-w-0 overflow-hidden rounded-lg border bg-background/30', (problem || errors[`chapters.${index}.title`]) && 'border-destructive/60')}>
              <header className="flex flex-wrap items-start gap-2 border-b bg-muted/20 px-3 py-3">
                <div className="min-w-0 flex-1 basis-40">
                  <TextField compact name={`chapters.${index}.title`} label={`Nazwa rozdziału ${index + 1}`} value={chapter.title} limit={120} required error={errors[`chapters.${index}.title`]} onChange={title => update(index, { title })} />
                </div>
                <div className="flex shrink-0 items-center pt-5">
                  <Button type="button" variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => reorder(index, -1)} aria-label={`Przesuń rozdział ${index + 1} w górę`}><ArrowUp /></Button>
                  <Button type="button" variant="ghost" size="icon-sm" disabled={index === chapters.length - 1} onClick={() => reorder(index, 1)} aria-label={`Przesuń rozdział ${index + 1} w dół`}><ArrowDown /></Button>
                  {(canDelete || chapter.id == null) && <Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" aria-label={`Usuń rozdział ${index + 1}`} onClick={() => { onChange(chapters.filter((_, i) => i !== index)); if (target > index) setTargetIndex(target - 1); }}><Trash2 /></Button>}
                </div>
              </header>
              {roomIds.length ? <ol className="divide-y" aria-label={`Pokoje rozdziału ${index + 1}`}>{roomIds.map((id, roomIndex) => {
                const room = rooms.find(r => r.id === id);
                const title = room?.title ?? `Pokój ${id}`;
                return <li key={id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
                  <span className="w-7 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">{index + 1}.{roomIndex + 1}</span>
                  <button type="button" className="min-w-0 flex-1 basis-28 truncate text-left font-medium underline-offset-4 hover:text-primary hover:underline" onClick={() => onRoom(id)}>{title}</button>
                  {room?.requiresVpn && <Lock className="size-3.5 text-muted-foreground" aria-label="Wymaga VPN" />}
                  {room?.published === false ? <Badge variant="secondary" className="text-[10px]">Szkic</Badge> : <span className="text-[10px] text-muted-foreground">Opublikowany</span>}
                  <div className="ml-auto flex shrink-0 items-center">
                    {chapters.length > 1 && <Select value="" onValueChange={value => {
                      if (!value) return;
                      const destination = Number(value);
                      onChange(chapters.map((c, i) => i === index ? { ...c, roomIds: (c.roomIds ?? []).filter(r => r !== id) } : i === destination ? { ...c, roomIds: [...(c.roomIds ?? []), id] } : c));
                    }}><SelectTrigger size="sm" aria-label={`Przenieś pokój ${id}`} className="mr-1 h-8 w-8 justify-center border-transparent bg-transparent px-1.5 text-xs hover:border-border sm:w-28 sm:justify-between sm:px-2.5"><span className="hidden sm:inline"><SelectValue placeholder="Przenieś…" /></span><ArrowRightLeft className="size-3.5 sm:hidden" /></SelectTrigger><SelectContent>{chapters.map((c, i) => i !== index && <SelectItem key={i} value={String(i)}>{i + 1}. {c.title.trim() || 'Bez nazwy'}</SelectItem>)}</SelectContent></Select>}
                    <Button type="button" variant="ghost" size="icon-sm" disabled={roomIndex === 0} aria-label={`Przesuń pokój ${id} w górę`} onClick={() => update(index, { roomIds: move(roomIds, roomIndex, -1) })}><ArrowUp /></Button>
                    <Button type="button" variant="ghost" size="icon-sm" disabled={roomIndex === roomIds.length - 1} aria-label={`Przesuń pokój ${id} w dół`} onClick={() => update(index, { roomIds: move(roomIds, roomIndex, 1) })}><ArrowDown /></Button>
                    <Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" aria-label={`Wyjmij ${title} z rozdziału`} onClick={() => update(index, { roomIds: roomIds.filter(r => r !== id) })}><X /></Button>
                  </div>
                </li>;
              })}</ol> : <div className="px-4 py-6"><p className="text-sm text-muted-foreground">Ten rozdział czeka na pierwszy pokój.</p><button type="button" className="mt-1 text-xs text-primary underline-offset-4 hover:underline" onClick={() => setTargetIndex(index)}>Wybierz pokój z puli →</button></div>}
              <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-3 py-2">
                <span className="text-xs text-muted-foreground tabular-nums">{roomIds.length} {plural(roomIds.length, ['pokój', 'pokoje', 'pokoi'])}</span>
                <Button type="button" variant="ghost" size="sm" className="text-primary hover:text-primary" id={`content-chapters.${index}.rooms`} aria-label={chapters.length === 1 ? 'Utwórz pokój' : `Utwórz pokój w rozdziale ${index + 1}`} onClick={() => onCreateRoom(index)}><Plus className="size-3.5" />Utwórz pokój</Button>
              </footer>
              {problem && <p role="alert" className="border-t border-destructive/30 px-4 py-2 text-sm text-destructive">{problem}</p>}
            </div>
          </li>;
        })}
        <li className="pl-10"><Button type="button" variant="outline" data-field="chapters" onClick={() => { setTargetIndex(chapters.length); onChange([...chapters, { id: null, title: `Rozdział ${chapters.length + 1}`, roomIds: [] }]); }}><Plus />Dodaj rozdział</Button></li>
      </ol>
      <aside aria-label="Pula pokoi" className="h-fit min-w-0 rounded-lg border bg-muted/20 p-4 lg:sticky lg:top-20">
        <div className="mb-1 flex items-center gap-2"><LibraryBig className="size-4 text-muted-foreground" /><h3 className="text-sm font-semibold">Pula pokoi</h3><span className="ml-auto text-xs text-muted-foreground tabular-nums">{pool.length}</span></div>
        <p className="mb-4 text-xs leading-relaxed text-muted-foreground">Wolne pokoje ścieżek. Dodaj je do wybranego rozdziału.</p>
        <div className="mb-3 grid gap-1.5"><Label htmlFor="content-chapter-target" className="text-xs">Dodawaj do rozdziału</Label>
          <Select value={chapters.length ? String(target) : ''} onValueChange={value => { if (value) setTargetIndex(Number(value)); }} disabled={!chapters.length}><SelectTrigger id="content-chapter-target" size="sm" className="w-full"><SelectValue placeholder="Dodaj najpierw rozdział" /></SelectTrigger><SelectContent>{chapters.map((c, i) => <SelectItem key={i} value={String(i)}>{i + 1}. {c.title.trim() || 'Bez nazwy'}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="relative mb-3"><Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input aria-label="Szukaj w puli" value={query} onChange={e => setQuery(e.target.value)} placeholder="Szukaj pokoju…" className="h-8 pl-8 text-sm" /></div>
        {pool.length ? <ul className="max-h-96 space-y-1 overflow-y-auto" aria-label="Dostępne pokoje">{pool.map(r => <li key={r.id} className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-accent/50"><span className="min-w-0 flex-1 truncate text-sm" title={r.title}>{r.title}</span><span className="text-[10px] text-muted-foreground">{r.published === false ? 'Szkic' : 'Opublikowany'}</span><Button type="button" variant="ghost" size="icon-xs" disabled={!chapters.length} aria-label={`Dodaj ${r.title} do rozdziału`} onClick={() => update(target, { roomIds: [...(chapters[target]?.roomIds ?? []), r.id] })}><Plus /></Button></li>)}</ul> : <p className="rounded-md border border-dashed px-3 py-5 text-center text-xs leading-relaxed text-muted-foreground">{query ? 'Brak pasujących pokoi.' : 'Brak wolnych pokoi. Utwórz nowy bezpośrednio w rozdziale.'}</p>}

      </aside>
    </div>
  </Section>;
}
export function ContentTasks({ tasks, errors, published, onChange }: { tasks: RoomTaskRequest[]; errors: FieldErrors; published: boolean; onChange: (tasks: RoomTaskRequest[]) => void }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const update = (index: number, field: keyof RoomTaskRequest, value: string) => onChange(tasks.map((t, i) => i === index ? { ...t, [field]: value } : t));
  const toggle = (index: number) => setOpen(current => { const next = new Set(current); if (next.has(index)) next.delete(index); else next.add(index); return next; });
  return <Section title="Zadania" description="Ułóż kolejne kroki pokoju. Postępy w zachowanych zadaniach pozostają bez zmian.">
    {tasks.length === 0 && <p className="mb-4 rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Dodaj zadania, aby poprowadzić gracza krok po kroku. Pokój bez zadań rozwiązuje się flagą.</p>}
    <ol className="grid gap-3">{tasks.map((task, index) => {
      const hasError = Object.keys(errors).some(key => key.startsWith(`tasks.${index}.`));
      const expanded = open.has(index) || hasError;
      return <li key={task.id ?? `new-${index}`} className={cn('overflow-hidden rounded-lg border bg-background/30', hasError && 'border-destructive/60')}>
        <header className="flex items-center gap-2 px-3 py-2.5">
          <span className="w-6 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">{String(index + 1).padStart(2, '0')}.</span>
          <button type="button" className="flex min-w-0 flex-1 items-center gap-2 rounded py-1 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-expanded={expanded} aria-controls={`content-task-${index}-panel`} onClick={() => toggle(index)}>
            <span className={cn('truncate font-medium', !task.title.trim() && 'text-muted-foreground italic')}>{task.title.trim() || 'Zadanie bez tytułu'}</span>
            <Badge variant="outline" className="hidden text-[10px] text-muted-foreground sm:inline-flex">{task.question?.trim() ? 'Z pytaniem' : 'Lektura'}</Badge>
            <ChevronDown className={cn('ml-auto size-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
          </button>
          <div className="flex shrink-0 items-center">
            <Button type="button" variant="ghost" size="icon-sm" disabled={index === 0} aria-label={`Przesuń zadanie ${index + 1} w górę`} onClick={() => { onChange(move(tasks, index, -1)); setOpen(new Set([index - 1])); }}><ArrowUp /></Button>
            <Button type="button" variant="ghost" size="icon-sm" disabled={index === tasks.length - 1} aria-label={`Przesuń zadanie ${index + 1} w dół`} onClick={() => { onChange(move(tasks, index, 1)); setOpen(new Set([index + 1])); }}><ArrowDown /></Button>
            <Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" aria-label={`Usuń zadanie ${index + 1}`} onClick={() => onChange(tasks.filter((_, i) => i !== index))}><Trash2 /></Button>
          </div>
        </header>
        {expanded && <div id={`content-task-${index}-panel`} className="grid gap-4 border-t px-4 py-4 md:grid-cols-2">
          {(['title', 'content', 'question', 'answer'] as const).map(field => <div key={field} className={field === 'title' || field === 'content' ? 'md:col-span-2' : ''}><TextField name={`tasks.${index}.${field}`} label={{ title: 'Tytuł zadania', content: 'Treść', question: 'Pytanie', answer: 'Odpowiedź' }[field]} value={task[field] ?? ''} limit={{ title: 255, content: 20000, question: 2000, answer: 255 }[field]} multiline={field === 'content'} required={field === 'title' || (published && (field === 'content' || field === 'answer' && !!task.question?.trim() || field === 'question' && !!task.answer?.trim()))} error={errors[`tasks.${index}.${field}`]} onChange={value => update(index, field, value)} /></div>)}
          <p className="text-xs leading-relaxed text-muted-foreground md:col-span-2">Treść obsługuje podstawowe formatowanie HTML. Usunięcie zadania usuwa również postęp graczy w tym zadaniu.</p>
        </div>}
      </li>;
    })}</ol>
    <Button type="button" variant="outline" className="mt-4" onClick={() => { setOpen(current => new Set(current).add(tasks.length)); onChange([...tasks, { id: null, title: '', content: '', question: null, answer: null }]); }}><Plus />Dodaj zadanie</Button>
  </Section>;
}
