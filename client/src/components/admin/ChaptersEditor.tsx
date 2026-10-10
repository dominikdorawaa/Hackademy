import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Lock, Plus, Search, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useAuth } from '../../context/AuthContext';
import * as adminApi from '../../services/adminApi';
import type { ChapterRequest, PathAdminDetailDto, PathChapterAdminDto, RoomAdminSummaryDto } from '../../types/api';
import { Section, StatusMessage } from './AdminUi';
import { errorText, plural } from './adminFormat';

interface DraftChapter {
  key: string;
  id: number | null;
  title: string;
  roomIds: number[];
}

let chapterCounter = 0;
const newKey = () => `chapter-${++chapterCounter}`;

const toDrafts = (chapters: PathChapterAdminDto[]): DraftChapter[] =>
  chapters.map((chapter) => ({ key: `saved-${chapter.id}`, id: chapter.id, title: chapter.title, roomIds: [...chapter.roomIds] }));

const toRequest = (chapters: DraftChapter[]): ChapterRequest[] =>
  chapters.map((chapter) => ({ id: chapter.id, title: chapter.title.trim(), roomIds: chapter.roomIds }));

function moveItem<T>(items: T[], index: number, offset: number) {
  const target = index + offset;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export default function ChaptersEditor({
  pathId,
  chapters: savedChapters,
  rooms,
  canDeleteChapters,
  onSaved,
  roomHref,
  newRoomHref,
}: {
  pathId: number;
  chapters: PathChapterAdminDto[];
  rooms: RoomAdminSummaryDto[];
  canDeleteChapters: boolean;
  onSaved: (detail: PathAdminDetailDto) => void;
  roomHref?: (roomId: number) => string;
  newRoomHref?: string;
}) {
  const { token } = useAuth();
  const [chapters, setChapters] = useState<DraftChapter[]>(() => toDrafts(savedChapters));
  const [baseline, setBaseline] = useState(savedChapters);
  const [targetKey, setTargetKey] = useState<string | null>(null);
  const [poolQuery, setPoolQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showProblems, setShowProblems] = useState(false);

  if (baseline !== savedChapters) {
    setBaseline(savedChapters);
    setChapters(toDrafts(savedChapters));
  }

  const roomsById = useMemo(() => new Map(rooms.map((room) => [room.id, room])), [rooms]);
  const assigned = useMemo(() => new Set(chapters.flatMap((chapter) => chapter.roomIds)), [chapters]);
  const pool = useMemo(() => {
    const term = poolQuery.trim().toLowerCase();
    return rooms
      .filter((room) => room.roomType === 'PATH' && !assigned.has(room.id) && (room.pathId === null || room.pathId === pathId))
      .filter((room) => !term || room.title.toLowerCase().includes(term))
      .sort((a, b) => a.title.localeCompare(b.title, 'pl'));
  }, [rooms, assigned, pathId, poolQuery]);

  const dirty = JSON.stringify(toRequest(chapters)) !== JSON.stringify(toRequest(toDrafts(savedChapters)));
  const removedChapters = savedChapters.filter((chapter) => !chapters.some((draft) => draft.id === chapter.id));
  const invalidTitles = chapters.some((chapter) => !chapter.title.trim());
  const target = chapters.find((chapter) => chapter.key === targetKey) ?? chapters[chapters.length - 1];

  const edit = (update: (current: DraftChapter[]) => DraftChapter[]) => {
    if (saving) return;
    setChapters(update);
    setSuccess(null);
  };

  const updateChapter = (key: string, change: (chapter: DraftChapter) => DraftChapter) =>
    edit((current) => current.map((chapter) => (chapter.key === key ? change(chapter) : chapter)));

  const addChapter = () => {
    const key = newKey();
    edit((current) => [...current, { key, id: null, title: `Rozdział ${current.length + 1}`, roomIds: [] }]);
    setTargetKey(key);
  };

  const deleteChapter = (key: string) => {
    edit((current) => current.filter((chapter) => chapter.key !== key));
    if (targetKey === key) setTargetKey(null);
  };

  const moveRoomTo = (roomId: number, fromKey: string, toKey: string) =>
    edit((current) => current.map((chapter) => {
      if (chapter.key === fromKey) return { ...chapter, roomIds: chapter.roomIds.filter((id) => id !== roomId) };
      if (chapter.key === toKey) return { ...chapter, roomIds: [...chapter.roomIds, roomId] };
      return chapter;
    }));

  const addRoom = (roomId: number) => {
    if (!target) return;
    updateChapter(target.key, (chapter) => ({ ...chapter, roomIds: [...chapter.roomIds, roomId] }));
  };

  const save = async () => {
    if (saving) return;
    setShowProblems(true);
    setSuccess(null);
    if (invalidTitles) {
      setError('Każdy rozdział musi mieć nazwę.');
      return;
    }
    setSaving(true);
    try {
      const detail = await adminApi.updatePathChapters(pathId, toRequest(chapters), token);
      if (detail) onSaved(detail);
      setShowProblems(false);
      setError(null);
      setSuccess('Zapisano rozdziały.');
    } catch (err) {
      setError(errorText(err, 'Nie udało się zapisać rozdziałów.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section
      title="Rozdziały i pokoje"
      description="Gracz przechodzi rozdziały od góry. Pokój może należeć tylko do jednego rozdziału."
      actions={
        <>
          {dirty && (
            <Button variant="ghost" disabled={saving} onClick={() => { setChapters(toDrafts(savedChapters)); setShowProblems(false); setError(null); }}>
              Odrzuć zmiany
            </Button>
          )}
          <Button onClick={() => void save()} disabled={saving || !dirty}>{saving ? 'Zapisywanie…' : 'Zapisz rozdziały'}</Button>
        </>
      }
    >
      <div className="mb-4 space-y-2">
        {error && <StatusMessage kind="error">{error}</StatusMessage>}
        {success && <StatusMessage kind="success">{success}</StatusMessage>}
        {removedChapters.length > 0 && (
          <StatusMessage kind="warning">
            Po zapisaniu zniknie {removedChapters.length} {plural(removedChapters.length, ['rozdział', 'rozdziały', 'rozdziałów'])}. Pokoje z nich wrócą do puli.
          </StatusMessage>
        )}
      </div>

      <fieldset disabled={saving} className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]" aria-busy={saving}>
        <ol className="relative space-y-4" aria-label="Rozdziały ścieżki">
          {chapters.map((chapter, chapterIndex) => {
            const titleId = `${chapter.key}-title`;
            const titleProblem = showProblems && !chapter.title.trim();
            return (
              <li key={chapter.key} className="relative pl-10">
                <span
                  aria-hidden="true"
                  className="absolute top-2 left-0 flex size-7 items-center justify-center rounded-full border-2 border-primary bg-background font-mono text-xs font-semibold text-primary tabular-nums"
                >
                  {chapterIndex + 1}
                </span>
                {chapterIndex < chapters.length - 1 && (
                  <span aria-hidden="true" className="absolute top-10 bottom-[-1rem] left-[13px] border-l-2 border-primary/40" />
                )}
                <div className={cn('rounded-lg border bg-background/40', titleProblem && 'border-destructive/60')}>
                  <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
                    <Label htmlFor={titleId} className="sr-only">Nazwa rozdziału {chapterIndex + 1}</Label>
                    <Input
                      id={titleId}
                      value={chapter.title}
                      maxLength={120}
                      aria-invalid={titleProblem || undefined}
                      onChange={(event) => updateChapter(chapter.key, (current) => ({ ...current, title: event.target.value }))}
                      className="h-8 min-w-0 flex-1 basis-48 font-medium"
                    />
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {chapter.roomIds.length} {plural(chapter.roomIds.length, ['pokój', 'pokoje', 'pokoi'])}
                    </span>
                    <div className="ml-auto flex items-center">
                      <Button variant="ghost" size="icon-sm" aria-label={`Przesuń rozdział ${chapterIndex + 1} w górę`} disabled={chapterIndex === 0}
                        onClick={() => edit((current) => moveItem(current, chapterIndex, -1))}>
                        <ArrowUp />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label={`Przesuń rozdział ${chapterIndex + 1} w dół`} disabled={chapterIndex === chapters.length - 1}
                        onClick={() => edit((current) => moveItem(current, chapterIndex, 1))}>
                        <ArrowDown />
                      </Button>
                      {canDeleteChapters && (
                        <Button variant="ghost" size="icon-sm" aria-label={`Usuń rozdział ${chapterIndex + 1}`} disabled={chapters.length === 1}
                          className="text-muted-foreground hover:text-destructive" onClick={() => deleteChapter(chapter.key)}>
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  </div>
                  {chapter.roomIds.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-muted-foreground">Brak pokoi. Dodaj je z puli obok.</p>
                  ) : (
                    <ol className="divide-y" aria-label={`Pokoje rozdziału ${chapterIndex + 1}`}>
                      {chapter.roomIds.map((roomId, roomIndex) => {
                        const room = roomsById.get(roomId);
                        const title = room?.title ?? `Pokój ${roomId}`;
                        return (
                          <li key={roomId} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                            <span className="w-8 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                              {chapterIndex + 1}.{roomIndex + 1}
                            </span>
                            {roomHref ? (
                              <Link to={roomHref(roomId)} className="min-w-0 flex-1 truncate hover:text-primary hover:underline underline-offset-4">
                                {title}
                              </Link>
                            ) : (
                              <span className="min-w-0 flex-1 truncate">{title}</span>
                            )}
                            {room?.requiresVpn && <Lock aria-label="Wymaga VPN" className="size-3.5 text-muted-foreground" />}
                            <div className="flex items-center">
                              {chapters.length > 1 && (
                                <Select disabled={saving} value="" onValueChange={(toKey) => moveRoomTo(roomId, chapter.key, toKey)}>
                                  <SelectTrigger size="sm" aria-label={`Przenieś ${title} do innego rozdziału`} className="mr-1 h-8 w-32 text-xs">
                                    <SelectValue placeholder="Przenieś do…" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {chapters.map((option, optionIndex) => option.key !== chapter.key && (
                                      <SelectItem key={option.key} value={option.key}>
                                        {optionIndex + 1}. {option.title.trim() || 'Bez nazwy'}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                              <Button variant="ghost" size="icon-sm" aria-label={`Przesuń ${title} w górę`} disabled={roomIndex === 0}
                                onClick={() => updateChapter(chapter.key, (current) => ({ ...current, roomIds: moveItem(current.roomIds, roomIndex, -1) }))}>
                                <ArrowUp />
                              </Button>
                              <Button variant="ghost" size="icon-sm" aria-label={`Przesuń ${title} w dół`} disabled={roomIndex === chapter.roomIds.length - 1}
                                onClick={() => updateChapter(chapter.key, (current) => ({ ...current, roomIds: moveItem(current.roomIds, roomIndex, 1) }))}>
                                <ArrowDown />
                              </Button>
                              <Button variant="ghost" size="icon-sm" aria-label={`Wyjmij ${title} z rozdziału`}
                                className="text-muted-foreground hover:text-destructive"
                                onClick={() => updateChapter(chapter.key, (current) => ({ ...current, roomIds: current.roomIds.filter((id) => id !== roomId) }))}>
                                <X />
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </div>
              </li>
            );
          })}
          <li className="pl-10">
            <Button variant="outline" onClick={addChapter}><Plus />Dodaj rozdział</Button>
          </li>
        </ol>

        <aside aria-label="Pula pokoi" className="h-fit rounded-lg border bg-muted/30 p-3 lg:sticky lg:top-20">
          <h3 className="text-sm font-semibold text-foreground">Pula pokoi</h3>
          <p className="mb-3 text-xs text-muted-foreground">Pokoje ścieżek bez przypisanego rozdziału.</p>
          <div className="mb-3 grid gap-1.5">
            <Label htmlFor={`target-${pathId}`} className="text-xs">Dodawaj do</Label>
            <Select disabled={saving} value={target?.key ?? ''} onValueChange={setTargetKey}>
              <SelectTrigger id={`target-${pathId}`} size="sm" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {chapters.map((chapter, index) => (
                  <SelectItem key={chapter.key} value={chapter.key}>{index + 1}. {chapter.title.trim() || 'Bez nazwy'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="relative mb-2">
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Szukaj w puli" placeholder="Szukaj…" value={poolQuery} onChange={(event) => setPoolQuery(event.target.value)} className="h-8 pl-8 text-sm" />
          </div>
          {pool.length === 0 ? (
            <p className="px-1 py-3 text-xs text-muted-foreground">
              {poolQuery ? 'Brak pasujących pokoi.' : 'Wszystkie wolne pokoje są już w rozdziałach.'}
              {newRoomHref && (
                <>
                  {' '}
                  <Link to={newRoomHref} className="text-primary underline-offset-4 hover:underline">Utwórz pokój</Link>
                </>
              )}
            </p>
          ) : (
            <ul className="max-h-96 space-y-1 overflow-y-auto pr-1">
              {pool.map((room) => (
                <li key={room.id} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-accent/60">
                  <span className="min-w-0 flex-1 truncate">{room.title}</span>
                  <Button variant="ghost" size="icon-xs" aria-label={`Dodaj ${room.title} do rozdziału`} disabled={!target} onClick={() => addRoom(room.id)}>
                    <Plus />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </fieldset>
    </Section>
  );
}
