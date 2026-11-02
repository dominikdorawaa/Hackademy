import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  return { revision: 0, tasksRevision: 0, title: '', description: '', shortDescription: '', category: defaultCategory(kind), difficulty: 'EASY', points: kind === 'CTF' ? 50 : 0, requiresVpn: false, roomType: kind, hints: [], tasks: [] };
}
function fromDetail(d: contentApi.RoomEditor): RoomSave {
  return { ...d.room, points: d.room.roomType === 'CTF' ? pointsForDifficulty[d.room.difficulty] : d.room.points, hints: d.room.hints ?? [], revision: d.room.contentRevision ?? 0, tasksRevision: d.tasks.revision, tasks: d.tasks.tasks };
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
  const creation = location.state as { parentDraft?: PathSave; parentId?: number | null; chapterIndex?: number; returnPathId?: number | null } | null;
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
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline) || !!file || (parentDraft != null && JSON.stringify(parentDraft) !== JSON.stringify(creation?.parentDraft));
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
    if (parentDraft) { checkText(nextErrors, 'parentTitle', parentDraft.title, 120, true); checkText(nextErrors, 'parentDescription', parentDraft.description, 20000, parentDraft.published); checkText(nextErrors, 'parentChapter', parentDraft.chapters[creation?.chapterIndex ?? 0]?.title ?? '', 120, true); }
    checkText(nextErrors, 'title', current.title, 255, true);
    if (!nextErrors.title && current.title.trim() !== baseline.title && reservedRoomTitles.includes(current.title.trim().toLowerCase())) nextErrors.title = 'Tytuły „Tutorial VM” i „Tutorial VPN” są zarezerwowane dla pokoi samouczka';
    checkText(nextErrors, 'shortDescription', current.shortDescription ?? '', 100);
    checkText(nextErrors, 'description', current.description, 20000, ready);
    checkText(nextErrors, 'category', current.category, 255, true);
    if (!Number.isSafeInteger(current.points) || current.points < 0 || current.points > 2147483647) nextErrors.points = 'Podaj nieujemną liczbę całkowitą do 2147483647';
    if (ready && !current.tasks.length) nextErrors.tasks = 'Dodaj przynajmniej jedno zadanie';
    current.hints.forEach((hint, i) => checkText(nextErrors, `hints.${i}`, hint, 2000, true));
    current.tasks.forEach((task, i) => {
      checkText(nextErrors, `tasks.${i}.title`, task.title, 255, true);
      checkText(nextErrors, `tasks.${i}.content`, task.content, 20000, ready);
      checkText(nextErrors, `tasks.${i}.question`, task.question ?? '', 2000, ready && current.roomType === 'PATH' && !!task.answer?.trim() && !task.question?.trim());
      checkText(nextErrors, `tasks.${i}.answer`, task.answer ?? '', 255, ready && (current.roomType === 'CTF' || !!task.question?.trim()));
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
    if (await save(!wasNew) && wasNew) {
      guard.allowNavigation();
      navigate(`${base}/${idRef.current}`, { replace: true, state: { flash: 'Zapisano pokój.' } });
    }
  };
  const returnPath = contextPath || parentId ? `/admin/paths/${contextPath ?? parentId}` : base;
  return <>
    {guard.dialog}
    <Button asChild variant="ghost" className="mb-3"><Link to={returnPath}>← {contextPath || parentId ? 'Wróć do edytora ścieżki' : 'Pokoje'}</Link></Button>
    <PageHeader title={id == null ? 'Nowy pokój' : form.title || 'Edycja pokoju'} actions={<><Button variant="outline" disabled={saving} onClick={() => guard.request(() => { if (idRef.current != null) navigate(`/admin/preview/rooms/${idRef.current}${contextPath ? `?pathId=${contextPath}` : ''}`); else setError('Zapisz pokój przed podglądem.'); })}>Podgląd</Button>{id != null && isAdmin && <ConfirmAction title="Usunąć ten pokój?" description={<DeleteRoomDescription paths={paths} />} confirmLabel="Usuń pokój" onConfirm={async () => { await adminApi.deleteRoom(id, sessionKey); guard.allowNavigation(); navigate(returnPath); }} trigger={<Button variant="outline">Usuń pokój</Button>} />}</>} />
    {context && <StatusMessage kind="warning">Ścieżka: {context.title} → Rozdział: {context.chapters.find(c => c.id === Number(contextChapter))?.title}. Pokój zostanie przypisany automatycznie.</StatusMessage>}
    {publishedPathsWarning(paths) && <StatusMessage kind="warning">{publishedPathsWarning(paths)} Przypisania zmienisz w edytorze ścieżki.</StatusMessage>}
    {error && <StatusMessage kind="error">{error}</StatusMessage>}{success && <StatusMessage kind="success">{success}</StatusMessage>}
    {loading ? <LoadingRows label="Ładowanie pokoju" /> : !loaded ? <Button onClick={() => setAttempt(a => a + 1)}>Spróbuj ponownie</Button> :
      <form noValidate onSubmit={e => { e.preventDefault(); void normalSave(); }} className="mt-4 grid gap-6" aria-label="Edytor pokoju">
        <fieldset disabled={saving} className="grid min-w-0 gap-6">
          {parentDraft && <Section title="Ścieżka i rozdział" description={parentDraft.published ? "Ścieżka jest opublikowana, więc gracze zobaczą nowy rozdział od razu. Uzupełnij opis pokoju i dodaj przynajmniej jedno zadanie." : "Nowy kontekst i pokój zostaną zapisane razem. Nieudany zapis nie pozostawi nieprzypisanego pokoju."}>
            <div className="grid gap-4">
              <TextField name="parentTitle" label="Tytuł ścieżki" value={parentDraft.title} limit={120} required error={errors.parentTitle} onChange={title => setParentDraft({ ...parentDraft, title })} />
              <TextField name="parentDescription" label="Opis ścieżki" value={parentDraft.description} limit={20000} multiline required={parentDraft.published} error={errors.parentDescription} onChange={description => setParentDraft({ ...parentDraft, description })} />
              <TextField name="parentChapter" label="Nazwa rozdziału" value={parentDraft.chapters[creation?.chapterIndex ?? 0]?.title ?? ''} limit={120} required error={errors.parentChapter} onChange={title => setParentDraft({ ...parentDraft, chapters: parentDraft.chapters.map((c, i) => i === (creation?.chapterIndex ?? 0) ? { ...c, title } : c) })} />
            </div>
          </Section>}
          <Section title="Dane pokoju" description={ready ? 'Gracze widzą ten pokój, więc opis i przynajmniej jedno zadanie są wymagane.' : 'Do zapisu wystarczy tytuł. Opis i przynajmniej jedno zadanie będą potrzebne, gdy opublikujesz ścieżkę z tym pokojem.'}>
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
          <Section title="Podpowiedzi" description="Każda odblokowana podpowiedź zmniejsza nagrodę gracza o 25%.">
            <div className="grid gap-4">{form.hints.map((hint, index) => <div key={index} className="grid gap-2 rounded border p-3"><TextField name={`hints.${index}`} label={`Podpowiedź ${index + 1}`} value={hint} limit={2000} required error={errors[`hints.${index}`]} onChange={value => change({ hints: form.hints.map((h, i) => i === index ? value : h) })} /><Button type="button" variant="outline" onClick={() => change({ hints: form.hints.filter((_, i) => i !== index) })}>Usuń podpowiedź</Button></div>)}
              <Button type="button" variant="outline" onClick={() => change({ hints: [...form.hints, ''] })}>Dodaj podpowiedź</Button>
            </div>
          </Section>
          <ContentTasks tasks={form.tasks} kind={kind} errors={errors} ready={ready} onChange={tasks => change({ tasks })} />
          {errors.path && <p role="alert" className="text-destructive">{errors.path}</p>}
          <div className="flex flex-wrap justify-end gap-3 border-t pt-5">
            <Button type="submit" data-field="path">{saving ? 'Zapisywanie…' : 'Zapisz'}</Button>
          </div>
        </fieldset>
      </form>}
  </>;
}
