import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { useAuth } from '../../context/AuthContext';
import * as adminApi from '../../services/adminApi';
import * as contentApi from '../../services/contentApi';
import type { RoomSave, PathSave } from '../../services/contentApi';
import type { PathAdminDetailDto, RoomPathDto, RoomType, DifficultyLevel } from '../../types/api';
import { ConfirmAction, FilePicker, LoadingRows, PageHeader, Section, StatusMessage } from '../../components/admin/AdminUi';
import { TextField, checkText, focusError } from '../../components/admin/ContentFields';
import type { FieldErrors } from '../../components/admin/ContentFields';
import { ContentTasks } from '../../components/admin/ContentStructure';
import { RoomTypeHelp, RoomTypeSwitch } from '../../components/admin/RoomType';
import { DeleteRoomDescription, publishedPathsWarning } from '../../components/admin/RoomPaths';
import { useUnsavedChanges } from '../../components/admin/UnsavedChanges';
import { roomsPath as base, pointsForDifficulty, reservedRoomTitles } from './adminConfig';
import { useAdminAccess } from './adminAccess';
import { difficultyLabels } from '../../components/admin/adminFormat';
import { formatXp } from '../../lib/units';

const defaultCategory = (kind: RoomType) => kind === 'PATH' ? 'Path' : 'Web';
function empty(kind: RoomType): RoomSave {
  return { revision: 0, tasksRevision: 0, title: '', description: '', shortDescription: '', category: defaultCategory(kind), difficulty: 'EASY', points: kind === 'CTF' ? 50 : 0, requiresVpn: false, roomType: kind, tasks: [] };
}
function fromDetail(d: contentApi.RoomEditor): RoomSave {
  return { ...d.room, points: d.room.roomType === 'CTF' ? pointsForDifficulty[d.room.difficulty] : d.room.points, revision: d.room.contentRevision ?? 0, tasksRevision: d.tasks.revision, tasks: d.tasks.tasks.map(task => ({ ...task, hints: task.hints ?? [] })) };
}
export default function RoomEditorPage() {
  const { roomId } = useParams();
  const [query] = useSearchParams();
  return <RoomEditor key={`${roomId}:${query.toString()}`} roomId={roomId ?? 'new'} />;
}
function RoomEditor({ roomId }: { roomId: string }) {
  const { sessionKey } = useAuth();
  const { isAdmin } = useAdminAccess();
  const navigate = useNavigate();
  const [query] = useSearchParams();
  const location = useLocation();
  const creation = location.state as { parentDraft?: PathSave; parentId?: number | null; chapterIndex?: number; returnPathId?: number | null; pathTitle?: string; chapterTitle?: string } | null;
  const [parentDraft, setParentDraft] = useState(creation?.parentDraft ?? null);
  const [parentId, setParentId] = useState<number | null>(creation?.parentId ?? creation?.returnPathId ?? null);
  const presetType = query.get('type') === 'CTF' || query.get('type') === 'PATH' ? query.get('type') as RoomType : null;
  const initial = empty(presetType ?? 'PATH');
  const [id, setId] = useState<number | null>(roomId === 'new' ? null : Number(roomId));
  const idRef = useRef(id);
  const [form, setForm] = useState(initial);
  const kind = form.roomType ?? 'PATH';
  const formRef = useRef(form);
  useLayoutEffect(() => { formRef.current = form; }, [form]);
  const [baseline, setBaseline] = useState(initial);
  const [file, setFile] = useState<File | null>(null);
  const [context, setContext] = useState<PathAdminDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>((location.state as { flash?: string } | null)?.flash ?? null);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [paths, setPaths] = useState<RoomPathDto[]>([]);
  const [live, setLive] = useState(false);
  const contextPath = query.get('pathId');
  const contextChapter = query.get('chapterId');
  const contextRevision = query.get('pathRevision');
  useEffect(() => {
    let active = true;
    Promise.all([idRef.current == null ? Promise.resolve(null) : contentApi.contentRequest<contentApi.RoomEditor>(`/rooms/${idRef.current}`, sessionKey), contextPath ? adminApi.getPath(contextPath, sessionKey) : Promise.resolve(null)])
      .then(([detail, path]) => {
        if (!active) return;
        if (detail) {
          const next = fromDetail(detail); setForm(next); setBaseline(next); setParentId(current => current ?? detail.pathId ?? null); setPaths(detail.paths ?? []); setLive(detail.live ?? false);
        }
        if (contextPath) {
          if (!path || !path.chapters.some(c => c.id === Number(contextChapter)) || Number(contextRevision) !== (path.contentRevision ?? 0)) throw new Error('Ścieżka lub rozdział zmieniły się. Wróć do edytora ścieżki i ponownie wybierz „Utwórz pokój”.');
          setContext(path);
        }
        setLoaded(true); setError(null);
      }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [sessionKey, contextPath, contextChapter, contextRevision, attempt]);
  // Unsaved path edits carried with a new room live only here, so leaving before the room is saved would drop them.
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline) || !!file || (parentDraft != null && id == null);
  const change = (values: Partial<RoomSave>) => { setForm(current => ({ ...current, ...values })); setSuccess(null); };
  const changeType = (roomType: RoomType) => {
    const current = formRef.current;
    const category = current.category === defaultCategory(current.roomType ?? 'PATH') ? { category: defaultCategory(roomType) } : {};
    change({ roomType, ...category, ...(roomType === 'CTF' ? { points: pointsForDifficulty[current.difficulty] } : {}) });
  };
  // A room inside a published path is seen by players at once, so it has to stay complete.
  const ready = live || !!parentDraft?.published || !!context?.published;
  const save = async (notify = true) => {
    if (savingRef.current || !loaded) return false;
    const current = formRef.current;
    const nextErrors: FieldErrors = {};
    checkText(nextErrors, 'title', current.title, 255, true);
    if (!nextErrors.title && current.title.trim() !== baseline.title && reservedRoomTitles.includes(current.title.trim().toLowerCase())) nextErrors.title = 'Tytuły „Tutorial VM” i „Tutorial VPN” są zarezerwowane dla pokoi samouczka';
    checkText(nextErrors, 'shortDescription', current.shortDescription ?? '', 100);
    checkText(nextErrors, 'description', current.description, 20000, ready);
    checkText(nextErrors, 'category', current.category, 255, true);
    if (!Number.isSafeInteger(current.points) || current.points < 0 || current.points > 2147483647) nextErrors.points = 'Podaj nieujemną liczbę całkowitą do 2147483647';
    if (ready && !current.tasks.length) nextErrors.tasks = 'Dodaj przynajmniej jedno zadanie';
    current.tasks.forEach((task, i) => {
      checkText(nextErrors, `tasks.${i}.title`, task.title, 255, true);
      checkText(nextErrors, `tasks.${i}.content`, task.content, 20000, ready);
      checkText(nextErrors, `tasks.${i}.question`, task.question ?? '', 2000, ready && current.roomType === 'PATH' && !!task.answer?.trim() && !task.question?.trim());
      checkText(nextErrors, `tasks.${i}.answer`, task.answer ?? '', 255, ready && (current.roomType === 'CTF' || !!task.question?.trim()));
      task.hints?.forEach((hint, h) => checkText(nextErrors, `tasks.${i}.hints.${h}`, hint, 2000, true));
    });
    if (file && file.size > 50 * 1024 * 1024) nextErrors.file = 'Plik może mieć maksymalnie 50 MB';
    setErrors(nextErrors); setError(null); setSuccess(null);
    if (Object.keys(nextErrors).length) { focusError(nextErrors); return false; }
    savingRef.current = true; setSaving(true);
    try {
      const parent = idRef.current == null && parentDraft ? { parentDraft, chapterIndex: creation?.chapterIndex ?? 0, ...(parentId != null ? { pathId: parentId } : {}) } : idRef.current == null && context ? { pathId: context.id, chapterId: Number(contextChapter), pathRevision: context.contentRevision ?? 0 } : {};
      const detail = await contentApi.saveRoom(idRef.current, { ...current, ...parent }, file, sessionKey);
      const saved = fromDetail(detail);
      idRef.current = detail.room.id; setId(detail.room.id); formRef.current = saved;
      setForm(saved); setBaseline(saved); setFile(null); setPaths(detail.paths ?? []); setLive(detail.live ?? false);
      if (detail.pathId != null) { setParentId(detail.pathId); setParentDraft(null); }
      if (notify) setSuccess('Zapisano pokój.');
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się zapisać pokoju.');
      if (e instanceof contentApi.ContentError) { setErrors(e.fields); focusError(e.fields); }
      return false;
    } finally { savingRef.current = false; setSaving(false); }
  };
  const guard = useUnsavedChanges(dirty, () => save(), saving);
  const normalSave = async () => {
    const wasNew = idRef.current == null;
    const fromChapter = wasNew && (contextPath != null || parentDraft != null);
    if (await save(!wasNew) && wasNew) {
      guard.allowNavigation();
      // A room created from a chapter goes straight back to its path, where it is already in place.
      if (fromChapter) navigate(`/admin/paths/${contextPath ?? parentId}`, { replace: true, state: { arrivedRoomId: idRef.current } });
      else navigate(`${base}/${idRef.current}`, { replace: true, state: { flash: 'Zapisano pokój.' } });
    }
  };
  const returnPath = contextPath || parentId ? `/admin/paths/${contextPath ?? parentId}` : base;
  const pathTitle = context?.title ?? parentDraft?.title ?? creation?.pathTitle;
  const chapterTitle = context?.chapters.find(c => c.id === Number(contextChapter))?.title ?? parentDraft?.chapters[creation?.chapterIndex ?? 0]?.title ?? creation?.chapterTitle;
  return <>
    {guard.dialog}
    {(contextPath || parentId) && pathTitle ? <nav aria-label="Okruszki" className="mb-3">
      <ol className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
        <li className="min-w-0"><Link to={returnPath} className="block truncate underline-offset-4 hover:text-foreground hover:underline">{pathTitle}</Link></li>
        {chapterTitle && <><li aria-hidden="true"><ChevronRight className="size-4" /></li><li className="min-w-0 truncate">{chapterTitle}</li></>}
        <li aria-hidden="true"><ChevronRight className="size-4" /></li>
        <li aria-current="page" className="min-w-0 truncate font-medium text-foreground">{id == null ? 'Nowy pokój' : form.title || 'Pokój'}</li>
      </ol>
    </nav> : <Button asChild variant="ghost" className="mb-3"><Link to={returnPath}>← {contextPath || parentId ? 'Wróć do edytora ścieżki' : 'Pokoje'}</Link></Button>}
    <PageHeader title={id == null ? 'Nowy pokój' : form.title || 'Edycja pokoju'} actions={<><Button variant="outline" disabled={saving} onClick={() => guard.request(() => { if (idRef.current != null) navigate(`/admin/preview/rooms/${idRef.current}${contextPath ? `?pathId=${contextPath}` : ''}`); else setError('Zapisz pokój przed podglądem.'); })}>Podgląd</Button>{id != null && isAdmin && <ConfirmAction title="Usunąć ten pokój?" description={<DeleteRoomDescription paths={paths} />} confirmLabel="Usuń pokój" onConfirm={async () => { await adminApi.deleteRoom(id, sessionKey); guard.allowNavigation(); navigate(returnPath); }} trigger={<Button variant="outline">Usuń pokój</Button>} />}</>} />
    {publishedPathsWarning(paths) && <StatusMessage kind="warning">{publishedPathsWarning(paths)} Przypisania zmienisz w edytorze ścieżki.</StatusMessage>}
    {error && <StatusMessage kind="error">{error}</StatusMessage>}{success && <StatusMessage kind="success">{success}</StatusMessage>}
    {loading ? <LoadingRows label="Ładowanie pokoju" /> : !loaded ? <Button onClick={() => setAttempt(a => a + 1)}>Spróbuj ponownie</Button> :
      <form noValidate onSubmit={e => { e.preventDefault(); void normalSave(); }} className="mt-4 grid gap-6" aria-label="Edytor pokoju">
        <fieldset disabled={saving} className="grid min-w-0 gap-6">
          <Section title="Dane pokoju">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="grid gap-2 md:col-span-2"><span className="flex items-center gap-1 text-sm font-medium">Typ pokoju<RoomTypeHelp /></span><RoomTypeSwitch label="Typ pokoju" value={kind} onChange={changeType} /><p className="text-xs text-muted-foreground">Zmiana typu zachowuje zadania i postępy graczy.</p></div>
              <div className="md:col-span-2"><TextField name="title" label="Tytuł" value={form.title} limit={255} required error={errors.title} onChange={title => change({ title })} /></div>
              <div className="md:col-span-2"><TextField name="shortDescription" label="Krótki opis" value={form.shortDescription ?? ''} limit={100} error={errors.shortDescription} onChange={shortDescription => change({ shortDescription })} /></div>
              <div className="md:col-span-2"><TextField name="description" label="Opis" value={form.description} limit={20000} required={ready} multiline error={errors.description} onChange={description => change({ description })} /></div>
              {kind === 'CTF' && <>
                <TextField name="category" label="Kategoria" value={form.category} limit={255} required error={errors.category} onChange={category => change({ category })} />
                <div className="grid gap-2"><label htmlFor="content-difficulty">Trudność *</label><select id="content-difficulty" className="rounded border bg-background p-2" value={form.difficulty} onChange={e => change({ difficulty: e.target.value as DifficultyLevel, points: pointsForDifficulty[e.target.value as DifficultyLevel] })}>{Object.entries(difficultyLabels).map(([level, label]) => <option key={level} value={level}>{label}</option>)}</select><span className="text-xs text-muted-foreground">{formatXp(pointsForDifficulty[form.difficulty])}</span></div>
              </>}
              {kind === 'PATH' && <div className="grid gap-2"><label htmlFor="content-points">XP *</label><Input id="content-points" type="number" min={0} value={Number.isNaN(form.points) ? '' : form.points} onChange={e => change({ points: e.target.value === '' ? NaN : Number(e.target.value) })} aria-invalid={!!errors.points} />{errors.points && <p role="alert" className="text-destructive">{errors.points}</p>}</div>}
            </div>
          </Section>
          {(kind === 'CTF' || form.requiresVpn) && <Section title="Dodatki CTF" description="Opcjonalne. Plik i wymóg VPN widzi gracz na początku pokoju.">
            <div className="grid gap-5 md:grid-cols-2">
              {kind === 'CTF' && <div className="grid gap-2"><label htmlFor="content-file">Plik do pobrania</label><FilePicker key={form.revision} id="content-file" file={file} onChange={setFile} /><p className="text-xs text-muted-foreground">Do 50 MB. Pozostaw puste, aby zachować zapisany plik.</p>{errors.file && <p role="alert" className="text-destructive">{errors.file}</p>}</div>}
              <div className="grid content-start gap-2"><div className="flex items-center gap-3"><Switch id="room-vpn" checked={form.requiresVpn} onCheckedChange={requiresVpn => change({ requiresVpn })} /><label htmlFor="room-vpn">Wymaga VPN</label></div><p className="text-xs text-muted-foreground">Gracz otworzy pokój po ukończeniu samouczka VPN.</p></div>
            </div>
          </Section>}
          <ContentTasks tasks={form.tasks} kind={kind} errors={errors} ready={ready} onChange={tasks => change({ tasks })} />
          {errors.path && <p role="alert" className="text-destructive">{errors.path}</p>}
          <div className="flex flex-wrap justify-end gap-3 border-t pt-5">
            <Button type="submit" data-field="path">{saving ? 'Zapisywanie…' : 'Zapisz'}</Button>
          </div>
        </fieldset>
      </form>}
  </>;
}
