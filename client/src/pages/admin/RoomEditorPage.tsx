import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { useAuth } from '../../context/AuthContext';
import * as adminApi from '../../services/adminApi';
import * as contentApi from '../../services/contentApi';
import type { RoomSave, PathSave } from '../../services/contentApi';
import type { PathAdminDetailDto, RoomType, DifficultyLevel } from '../../types/api';
import { ConfirmAction, FilePicker, LoadingRows, PageHeader, Section, StatusMessage } from '../../components/admin/AdminUi';
import { TextField, checkText, focusError } from '../../components/admin/ContentFields';
import type { FieldErrors } from '../../components/admin/ContentFields';
import { ContentTasks } from '../../components/admin/ContentStructure';
import { useUnsavedChanges } from '../../components/admin/UnsavedChanges';
import { roomBasePath, pointsForDifficulty, reservedRoomTitles } from './adminConfig';
import { useAdminAccess } from './adminAccess';
import { difficultyLabels } from '../../components/admin/adminFormat';

function empty(kind: RoomType): RoomSave {
  return { revision: 0, tasksRevision: 0, title: '', description: '', shortDescription: '', category: kind === 'PATH' ? 'Path' : 'Web', difficulty: 'EASY', points: kind === 'CTF' ? 50 : 0, flag: '', requiresVpn: false, roomType: kind, hints: [], published: false, tasks: [] };
}
function fromDetail(d: contentApi.RoomEditor): RoomSave {
  return { ...d.room, points: d.room.roomType === 'CTF' ? pointsForDifficulty[d.room.difficulty] : d.room.points, hints: d.room.hints ?? [], revision: d.room.contentRevision ?? 0, tasksRevision: d.tasks.revision, published: d.room.published ?? true, tasks: d.tasks.tasks };
}
export default function RoomEditorPage({ kind }: { kind: RoomType }) {
  const { roomId } = useParams();
  const [query] = useSearchParams();
  return <RoomEditor key={`${kind}:${roomId}:${query.toString()}`} kind={kind} roomId={roomId ?? 'new'} />;
}
function RoomEditor({ kind, roomId }: { kind: RoomType; roomId: string }) {
  const { sessionKey } = useAuth();
  const { isAdmin } = useAdminAccess();
  const navigate = useNavigate();
  const [query] = useSearchParams();
  const base = roomBasePath[kind];
  const location = useLocation();
  const creation = location.state as { parentDraft?: PathSave; parentId?: number | null; chapterIndex?: number } | null;
  const [parentDraft, setParentDraft] = useState(creation?.parentDraft ?? null);
  const [parentId, setParentId] = useState<number | null>(creation?.parentId ?? null);
  const initial = empty(kind);
  const [id, setId] = useState<number | null>(roomId === 'new' ? null : Number(roomId));
  const idRef = useRef(id);
  const [form, setForm] = useState(initial);
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
  const contextPath = query.get('pathId');
  const contextChapter = query.get('chapterId');
  const contextRevision = query.get('pathRevision');
  useEffect(() => {
    let active = true;
    Promise.all([idRef.current == null ? Promise.resolve(null) : contentApi.contentRequest<contentApi.RoomEditor>(`/rooms/${idRef.current}`, sessionKey), contextPath ? adminApi.getPath(contextPath, sessionKey) : Promise.resolve(null)])
      .then(([detail, path]) => {
        if (!active) return;
        if (detail) {
          if (detail.room.roomType !== kind) throw new Error('Nie znaleziono pokoju tego typu.');
          const next = fromDetail(detail); setForm(next); setBaseline(next); setParentId(detail.pathId ?? null);
        }
        if (contextPath) {
          if (kind !== 'PATH' || !path || !path.chapters.some(c => c.id === Number(contextChapter)) || Number(contextRevision) !== (path.contentRevision ?? 0)) throw new Error('Ścieżka lub rozdział zmieniły się. Wróć do edytora ścieżki i ponownie wybierz „Utwórz pokój”.');
          setContext(path);
        }
        setLoaded(true); setError(null);
      }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [sessionKey, kind, contextPath, contextChapter, contextRevision, attempt]);
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline) || !!file || (parentDraft != null && JSON.stringify(parentDraft) !== JSON.stringify(creation?.parentDraft));
  const change = (values: Partial<RoomSave>) => { setForm(current => ({ ...current, ...values })); setSuccess(null); };
  const save = async (published = formRef.current.published, notify = true) => {
    if (savingRef.current || !loaded) return false;
    const current = formRef.current;
    const nextErrors: FieldErrors = {};
    if (parentDraft) { checkText(nextErrors, 'parentTitle', parentDraft.title, 120, true); checkText(nextErrors, 'parentDescription', parentDraft.description, 20000, parentDraft.published); checkText(nextErrors, 'parentChapter', parentDraft.chapters[creation?.chapterIndex ?? 0]?.title ?? '', 120, true); }
    checkText(nextErrors, 'title', current.title, 255, true);
    if (!nextErrors.title && current.title.trim() !== baseline.title && reservedRoomTitles.includes(current.title.trim().toLowerCase())) nextErrors.title = 'Tytuły „Tutorial VM” i „Tutorial VPN” są zarezerwowane dla pokoi samouczka';
    checkText(nextErrors, 'shortDescription', current.shortDescription ?? '', 100);
    checkText(nextErrors, 'description', current.description, 20000, published);
    checkText(nextErrors, 'category', current.category, 255, true);
    if (!Number.isSafeInteger(current.points) || current.points < 0 || current.points > 2147483647) nextErrors.points = 'Podaj nieujemną liczbę całkowitą do 2147483647';
    checkText(nextErrors, 'flag', current.flag, 255, published && !current.tasks.length);
    current.hints.forEach((hint, i) => checkText(nextErrors, `hints.${i}`, hint, 2000, true));
    current.tasks.forEach((task, i) => {
      checkText(nextErrors, `tasks.${i}.title`, task.title, 255, true);
      checkText(nextErrors, `tasks.${i}.content`, task.content, 20000, published);
      checkText(nextErrors, `tasks.${i}.question`, task.question ?? '', 2000, published && !!task.answer?.trim() && !task.question?.trim());
      checkText(nextErrors, `tasks.${i}.answer`, task.answer ?? '', 255, published && !!task.question?.trim());
    });
    if (file && file.size > 50 * 1024 * 1024) nextErrors.file = 'Plik może mieć maksymalnie 50 MB';
    setErrors(nextErrors); setError(null); setSuccess(null);
    if (Object.keys(nextErrors).length) { focusError(nextErrors); return false; }
    savingRef.current = true; setSaving(true);
    try {
      const parent = idRef.current == null && parentDraft ? { parentDraft, chapterIndex: creation?.chapterIndex ?? 0, ...(parentId != null ? { pathId: parentId } : {}) } : idRef.current == null && context ? { pathId: context.id, chapterId: Number(contextChapter), pathRevision: context.contentRevision ?? 0 } : {};
      const detail = await contentApi.saveRoom(idRef.current, { ...current, published, ...parent }, file, sessionKey);
      const saved = fromDetail(detail);
      idRef.current = detail.room.id; setId(detail.room.id); formRef.current = saved;
      setForm(saved); setBaseline(saved); setFile(null);
      if (detail.pathId != null) { setParentId(detail.pathId); setParentDraft(null); }
      if (notify) setSuccess(published ? 'Zapisano opublikowany pokój.' : 'Zapisano szkic pokoju.');
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się zapisać pokoju.');
      if (e instanceof contentApi.ContentError) { setErrors(e.fields); focusError(e.fields); }
      return false;
    } finally { savingRef.current = false; setSaving(false); }
  };
  const guard = useUnsavedChanges(dirty, () => save(), saving);
  const normalSave = async (published = formRef.current.published) => {
    const wasNew = idRef.current == null;
    if (await save(published, !wasNew) && wasNew) {
      guard.allowNavigation();
      navigate(`${base}/${idRef.current}`, { replace: true, state: { flash: published ? 'Zapisano opublikowany pokój.' : 'Zapisano szkic pokoju.' } });
    }
  };
  const returnPath = contextPath || parentId ? `/admin/paths/${contextPath ?? parentId}` : base;
  return <>
    {guard.dialog}
    <Button asChild variant="ghost" className="mb-3"><Link to={returnPath}>← {contextPath || parentId ? 'Wróć do edytora ścieżki' : kind === 'PATH' ? 'Pokoje ścieżek' : 'Pokoje CTF'}</Link></Button>
    <PageHeader title={id == null ? 'Nowy pokój' : form.title || 'Edycja pokoju'} description={`Status: ${form.published ? 'Opublikowany' : 'Szkic'}`} actions={<><Button variant="outline" disabled={saving} onClick={() => guard.request(() => { if (idRef.current != null) navigate(`/admin/preview/rooms/${idRef.current}?kind=${kind}${contextPath ? `&pathId=${contextPath}` : ''}`); else setError('Zapisz szkic przed podglądem.'); })}>Podgląd</Button>{id != null && isAdmin && <ConfirmAction title="Usunąć ten pokój?" description="Pokój, zadania i postępy graczy zostaną trwale usunięte." confirmLabel="Usuń pokój" onConfirm={async () => { await adminApi.deleteRoom(id, sessionKey); guard.allowNavigation(); navigate(returnPath); }} trigger={<Button variant="outline">Usuń pokój</Button>} />}</>} />
    {context && <StatusMessage kind="warning">Ścieżka: {context.title} → Rozdział: {context.chapters.find(c => c.id === Number(contextChapter))?.title}. Pokój zostanie przypisany automatycznie.</StatusMessage>}
    {error && <StatusMessage kind="error">{error}</StatusMessage>}{success && <StatusMessage kind="success">{success}</StatusMessage>}
    {loading ? <LoadingRows label="Ładowanie pokoju" /> : !loaded ? <Button onClick={() => setAttempt(a => a + 1)}>Spróbuj ponownie</Button> :
      <form noValidate onSubmit={e => { e.preventDefault(); void normalSave(); }} className="mt-4 grid gap-6" aria-label="Edytor pokoju">
        <fieldset disabled={saving} className="grid min-w-0 gap-6">
          {parentDraft && <Section title="Ścieżka i rozdział" description={parentDraft.published ? "Ścieżka jest opublikowana. Nowy rozdział wymaga gotowego opublikowanego pokoju; szkic pokoju możesz przygotować po przeniesieniu ścieżki do szkiców." : "Nowy kontekst i pokój zostaną zapisane razem. Nieudany zapis nie pozostawi nieprzypisanego pokoju."}>
            <div className="grid gap-4">
              <TextField name="parentTitle" label="Tytuł ścieżki" value={parentDraft.title} limit={120} required error={errors.parentTitle} onChange={title => setParentDraft({ ...parentDraft, title })} />
              <TextField name="parentDescription" label="Opis ścieżki" value={parentDraft.description} limit={20000} multiline required={parentDraft.published} error={errors.parentDescription} onChange={description => setParentDraft({ ...parentDraft, description })} />
              <TextField name="parentChapter" label="Nazwa rozdziału" value={parentDraft.chapters[creation?.chapterIndex ?? 0]?.title ?? ''} limit={120} required error={errors.parentChapter} onChange={title => setParentDraft({ ...parentDraft, chapters: parentDraft.chapters.map((c, i) => i === (creation?.chapterIndex ?? 0) ? { ...c, title } : c) })} />
            </div>
          </Section>}
          <Section title="Dane pokoju" description="Tytuł jest wymagany do zapisu szkicu. Przy publikacji uzupełnij opis i flagę lub gotowe zadania.">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2"><TextField name="title" label="Tytuł" value={form.title} limit={255} required error={errors.title} onChange={title => change({ title })} /></div>
              <div className="md:col-span-2"><TextField name="shortDescription" label="Krótki opis" value={form.shortDescription ?? ''} limit={100} error={errors.shortDescription} onChange={shortDescription => change({ shortDescription })} /></div>
              <div className="md:col-span-2"><TextField name="description" label="Opis" value={form.description} limit={20000} required={form.published} multiline error={errors.description} onChange={description => change({ description })} /></div>
              {kind === 'CTF' && <>
                <TextField name="category" label="Kategoria" value={form.category} limit={255} required error={errors.category} onChange={category => change({ category })} />
                <div className="grid gap-2"><label htmlFor="content-difficulty">Trudność *</label><select id="content-difficulty" className="rounded border bg-background p-2" value={form.difficulty} onChange={e => change({ difficulty: e.target.value as DifficultyLevel, points: pointsForDifficulty[e.target.value as DifficultyLevel] })}>{Object.entries(difficultyLabels).map(([level, label]) => <option key={level} value={level}>{label}</option>)}</select><span className="text-xs text-muted-foreground">{pointsForDifficulty[form.difficulty]} pkt</span></div>
              </>}
              {kind === 'PATH' && <div className="grid gap-2"><label htmlFor="content-points">Punkty *</label><Input id="content-points" type="number" min={0} value={Number.isNaN(form.points) ? '' : form.points} onChange={e => change({ points: e.target.value === '' ? NaN : Number(e.target.value) })} aria-invalid={!!errors.points} />{errors.points && <p role="alert" className="text-destructive">{errors.points}</p>}</div>}
              <TextField name="flag" label="Flaga" value={form.flag} limit={255} required={form.published && !form.tasks.length} error={errors.flag} onChange={flag => change({ flag })} />
              <div className="grid gap-2"><label htmlFor="content-file">Plik do pobrania</label><FilePicker key={form.revision} id="content-file" file={file} onChange={setFile} /><p className="text-xs text-muted-foreground">Do 50 MB. Pozostaw puste, aby zachować zapisany plik.</p>{errors.file && <p role="alert" className="text-destructive">{errors.file}</p>}</div>
              <div className="flex items-center gap-3"><Switch id="room-vpn" checked={form.requiresVpn} onCheckedChange={requiresVpn => change({ requiresVpn })} /><label htmlFor="room-vpn">Wymaga VPN</label></div>
            </div>
          </Section>
          <Section title="Podpowiedzi" description="Każda odblokowana podpowiedź zmniejsza nagrodę gracza o 25%.">
            <div className="grid gap-4">{form.hints.map((hint, index) => <div key={index} className="grid gap-2 rounded border p-3"><TextField name={`hints.${index}`} label={`Podpowiedź ${index + 1}`} value={hint} limit={2000} required error={errors[`hints.${index}`]} onChange={value => change({ hints: form.hints.map((h, i) => i === index ? value : h) })} /><Button type="button" variant="outline" onClick={() => change({ hints: form.hints.filter((_, i) => i !== index) })}>Usuń podpowiedź</Button></div>)}
              <Button type="button" variant="outline" onClick={() => change({ hints: [...form.hints, ''] })}>Dodaj podpowiedź</Button>
            </div>
          </Section>
          {kind === 'PATH' && <ContentTasks tasks={form.tasks} errors={errors} published={form.published} onChange={tasks => change({ tasks })} />}
          {errors.published && <p role="alert" className="text-destructive">{errors.published}</p>}
          <div className="flex flex-wrap justify-end gap-3 border-t pt-5">
            {form.published ? <Button type="button" variant="outline" onClick={() => void normalSave(false)}>Przenieś do szkiców</Button> : <Button type="button" variant="outline" data-field="published" onClick={() => void normalSave(true)}>Opublikuj</Button>}
            <Button type="submit">{saving ? 'Zapisywanie…' : form.published ? 'Zapisz zmiany' : 'Zapisz szkic'}</Button>
          </div>
        </fieldset>
      </form>}
  </>;
}
