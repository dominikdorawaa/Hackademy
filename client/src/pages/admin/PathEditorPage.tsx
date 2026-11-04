import { request } from '../../services/http';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Eye, Lock, Trash2, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import API_URL from '../../apiConfig';
import { useAuth } from '../../context/AuthContext';
import * as adminApi from '../../services/adminApi';
import * as contentApi from '../../services/contentApi';
import type { PathSave } from '../../services/contentApi';
import type { PathAdminDetailDto, PathUnlockMode, RoomAdminSummaryDto } from '../../types/api';
import { ConfirmAction, FilePicker, LoadingRows, PageHeader, Section, StatusMessage } from '../../components/admin/AdminUi';
import { TextField, checkText, focusError } from '../../components/admin/ContentFields';
import type { FieldErrors } from '../../components/admin/ContentFields';
import { ContentChapters } from '../../components/admin/ContentStructure';
import { useUnsavedChanges } from '../../components/admin/UnsavedChanges';
import { useAdminAccess } from './adminAccess';
import PathImportDialog from './PathImportDialog';

const empty: PathSave = { revision: 0, chaptersRevision: 0, title: '', description: '', bannerUrl: null, published: false, chapters: [{ id: null, title: 'Rozdział 1', roomIds: [] }], unlockMode: 'OPEN' };
const unlockModes: Record<PathUnlockMode, { label: string; description: string }> = {
  OPEN: { label: 'Otwarta', description: 'Wszystkie pokoje są dostępne od razu.' },
  CHAPTER: { label: 'Rozdziałami', description: 'Rozdział otwiera się po ukończeniu wszystkich pokoi poprzednich rozdziałów.' },
  ROOM: { label: 'Pokój po pokoju', description: 'Pokoje tworzą jedną kolejkę przez całą ścieżkę; kolejny otwiera się po ukończeniu poprzedniego.' },
};
function fromDetail(d: PathAdminDetailDto): PathSave {
  return { revision: d.contentRevision ?? 0, chaptersRevision: d.revision, title: d.title, description: d.description ?? '', bannerUrl: d.hasBanner ? null : d.bannerUrl, published: d.published ?? true, chapters: d.chapters, unlockMode: d.unlockMode ?? 'OPEN' };
}
export default function PathEditorPage() {
  const { pathId } = useParams();
  return <PathEditor key={pathId} pathId={pathId ?? 'new'} />;
}
function PathEditor({ pathId }: { pathId: string }) {
  const { sessionKey } = useAuth();
  const { isAdmin } = useAdminAccess();
  const navigate = useNavigate();
  const location = useLocation();
  const [id, setId] = useState<number | null>(pathId === 'new' ? null : Number(pathId));
  const idRef = useRef(id);
  const [form, setForm] = useState<PathSave>(empty);
  const formRef = useRef(form);
  useLayoutEffect(() => { formRef.current = form; }, [form]);
  const [baseline, setBaseline] = useState(empty);
  const [rooms, setRooms] = useState<RoomAdminSummaryDto[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const arrival = location.state as { flash?: string; arrivedRoomId?: number } | null;
  const [success, setSuccess] = useState<string | null>(arrival?.flash ?? null);
  const [arrived, setArrived] = useState<number | null>(arrival?.arrivedRoomId ?? null);
  const [attempt, setAttempt] = useState(0);
  const [systemKey, setSystemKey] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    Promise.all([idRef.current == null ? Promise.resolve(null) : adminApi.getPath(idRef.current, sessionKey), adminApi.getAllRoomsAdmin(sessionKey)])
      .then(([detail, pool]) => {
        if (!active) return;
        if (idRef.current != null && !detail) throw new Error('Nie znaleziono ścieżki.');
        if (detail) { const next = fromDetail(detail); setForm(next); setBaseline(next); setSystemKey(detail.systemKey ?? null); if (detail.hasBanner) setBanner(`${API_URL}/api/admin/content/paths/${detail.id}/banner`); }
        setRooms(pool ?? []); setError(null);
      }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [sessionKey, attempt]);
  // A room just created from a chapter lights up for a moment where it landed.
  useEffect(() => {
    if (arrived == null || loading) return;
    document.querySelector(`[data-room-id="${arrived}"]`)?.scrollIntoView?.({ block: 'center' });
    const timer = setTimeout(() => setArrived(null), 2400);
    return () => clearTimeout(timer);
  }, [arrived, loading]);
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline) || !!file;
  const change = (values: Partial<PathSave>) => { setForm(current => ({ ...current, ...values })); setSuccess(null); };
  const validate = (published: boolean, roomComing: number | null = null) => {
    const current = formRef.current;
    const nextErrors: FieldErrors = {};
    checkText(nextErrors, 'title', current.title, 120, true);
    checkText(nextErrors, 'description', current.description, 20000, published);
    checkText(nextErrors, 'bannerUrl', current.bannerUrl ?? '', 2048);
    if (current.bannerUrl) { try { const url = new URL(current.bannerUrl); if (!['http:', 'https:'].includes(url.protocol)) throw new Error(); } catch { nextErrors.bannerUrl = 'Podaj poprawny adres http:// lub https://'; } }
    if (file && (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 5 * 1024 * 1024)) nextErrors.bannerFile = 'Wybierz obraz PNG, JPEG, WebP lub GIF do 5 MB';
    if (published && !current.chapters.length) nextErrors.chapters = 'Dodaj przynajmniej jeden rozdział';
    current.chapters.forEach((c, i) => {
      checkText(nextErrors, `chapters.${i}.title`, c.title, 120, true);
      if (published && !c.roomIds?.length && i !== roomComing) nextErrors[`chapters.${i}.rooms`] = 'Dodaj pokój do rozdziału przed publikacją';
    });
    setSuccess(null); setErrors(nextErrors); setError(null);
    if (Object.keys(nextErrors).length) { focusError(nextErrors); return false; }
    return true;
  };
  const save = async (published = formRef.current.published, notify = true) => {
    if (savingRef.current) return false;
    const current = formRef.current;
    if (!validate(published)) return false;
    savingRef.current = true; setSaving(true);
    try {
      const detail = await contentApi.savePath(idRef.current, { ...current, published }, file, sessionKey);
      const saved = fromDetail(detail);
      idRef.current = detail.id; setId(detail.id); formRef.current = saved;
      setForm(saved); setBaseline(saved); setFile(null);
      if (notify) setSuccess(published ? 'Zapisano opublikowany materiał.' : 'Zapisano szkic.');
      if (detail.hasBanner) setBanner(`${API_URL}/api/admin/content/paths/${detail.id}/banner?v=${detail.contentRevision}`);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się zapisać ścieżki.');
      if (e instanceof contentApi.ContentError) { setErrors(e.fields); focusError(e.fields); }
      return false;
    } finally { savingRef.current = false; setSaving(false); }
  };
  const guard = useUnsavedChanges(dirty, () => save(), saving);
  const normalSave = async (published = formRef.current.published) => {
    const wasNew = idRef.current == null;
    if (await save(published, !wasNew) && wasNew) {
      guard.allowNavigation();
      navigate(`/admin/paths/${idRef.current}`, { replace: true, state: { flash: published ? 'Zapisano opublikowany materiał.' : 'Zapisano szkic.' } });
    }
  };
  // A new room starts from its chapter: a draft path is saved quietly first, so the room editor gets a real chapter.
  // A published path cannot be saved with an empty chapter, so its edits travel with the room and are saved together.
  const createRoom = async (index: number) => {
    if (savingRef.current) return;
    const crumbs = (chapter: string) => ({ pathTitle: formRef.current.title.trim(), chapterTitle: chapter.trim() });
    if (formRef.current.published) {
      const chapter = formRef.current.chapters[index];
      if (!dirty && chapter.id != null) {
        navigate(`/admin/paths/rooms/new?pathId=${idRef.current}&chapterId=${chapter.id}&pathRevision=${formRef.current.revision}`, { state: crumbs(chapter.title) });
        return;
      }
      if (file) { setError('Zapisz najpierw nowy banner ścieżki.'); return; }
      if (!validate(true, index)) return;
      guard.allowNavigation();
      navigate('/admin/paths/rooms/new', { state: { parentDraft: formRef.current, parentId: idRef.current, chapterIndex: index, ...crumbs(chapter.title) } });
      return;
    }
    if ((dirty || idRef.current == null) && !await save(false, false)) return;
    const chapter = formRef.current.chapters[index];
    guard.allowNavigation();
    navigate(`/admin/paths/rooms/new?pathId=${idRef.current}&chapterId=${chapter.id}&pathRevision=${formRef.current.revision}`, { state: crumbs(chapter.title) });
  };
  const openRoom = (roomId: number, chapterIndex: number) => guard.request(() => navigate(`/admin/paths/rooms/${roomId}`,
    { state: { returnPathId: idRef.current, pathTitle: formRef.current.title.trim(), chapterTitle: formRef.current.chapters[chapterIndex]?.title.trim() } }));
  if (systemKey) return <SystemPath title={form.title} description={form.description} systemKey={systemKey} />;
  const published = baseline.published;
  return <>
    {guard.dialog}
    <div className={cn('sticky top-14 z-[5] -mx-4 -mt-6 mb-6 border-b px-4 py-2.5 backdrop-blur md:-mx-8 md:-mt-8 md:px-8',
      published ? 'border-amber-500/40 bg-amber-50/95 dark:bg-[#2a2113]/95' : 'bg-background/95')} role="region" aria-label="Stan ścieżki">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-1 basis-64 items-center gap-2">
          <Link to="/admin/paths" className="shrink-0 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Ścieżki</Link>
          <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <h1 className="min-w-0 truncate text-lg font-semibold text-foreground">{id == null ? 'Nowa ścieżka' : baseline.title || 'Ścieżka'}</h1>
          <span className={cn('shrink-0 rounded-[4px] px-2 py-0.5 text-xs font-medium',
            published ? 'bg-emerald-600 text-white dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-muted text-muted-foreground')}>{published ? 'Opublikowana' : 'Szkic'}</span>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Button type="button" variant="ghost" size="sm" aria-label="Podgląd" disabled={saving} onClick={() => guard.request(() => { if (idRef.current != null) navigate(`/admin/preview/paths/${idRef.current}`); else setError('Zapisz szkic przed podglądem.'); })}><Eye /><span className="hidden sm:inline">Podgląd</span></Button>
          <ConfirmAction tone={published ? 'destructive' : 'default'} title={published ? 'Przenieść ścieżkę do szkiców?' : 'Opublikować ścieżkę?'} confirmLabel={published ? 'Przenieś do szkiców' : 'Opublikuj'}
            description={`${published ? 'Ścieżka i jej rozdziały znikną graczom. Pokoje, które są też w innej opublikowanej ścieżce, zostaną tam widoczne.' : 'Gracze od razu zobaczą ścieżkę i wszystkie jej pokoje.'}${dirty ? ' Niezapisane zmiany zapiszą się razem z nią.' : ''}`}
            onConfirm={() => normalSave(!published)}
            trigger={<Button type="button" variant="outline" size="sm" className="bg-background dark:bg-background/40" disabled={saving || loading}>{published ? 'Przenieś do szkiców' : 'Opublikuj'}</Button>} />
          <Button type="submit" form="path-editor" size="sm" className="min-w-20" disabled={saving || loading || !dirty}>{saving ? 'Zapisywanie…' : 'Zapisz'}</Button>
        </div>
      </div>
      {published && <p className="mt-2 flex items-start gap-2 text-xs text-amber-900 sm:text-sm dark:text-amber-100">
        <TriangleAlert aria-hidden="true" className="mt-px size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        Edytujesz opublikowaną ścieżkę. Zmiany po zapisie od razu zobaczą użytkownicy.
      </p>}
    </div>
    <div className="grid gap-3 empty:hidden">{error && <StatusMessage kind="error">{error}</StatusMessage>}{success && <StatusMessage kind="success">{success}</StatusMessage>}</div>
    {loading ? <LoadingRows label="Ładowanie ścieżki" /> : error && id != null && !form.title ? <Button onClick={() => setAttempt(a => a + 1)}>Spróbuj ponownie</Button> :
      <form id="path-editor" noValidate onSubmit={e => { e.preventDefault(); void normalSave(); }} className="mt-4 grid gap-8" aria-label="Edytor ścieżki">
        <fieldset disabled={saving} className="grid min-w-0 gap-8">
          <Section title="Informacje" description="Tytuł i nazwy rozdziałów są wymagane do zapisu szkicu. Opis i gotowe pokoje są wymagane przy publikacji.">
            <div className="grid gap-5">
              <TextField name="title" label="Tytuł" value={form.title} limit={120} required error={errors.title} onChange={title => change({ title })} />
              <TextField name="description" label="Opis" value={form.description} limit={20000} required={form.published} multiline error={errors.description} onChange={description => change({ description })} />
              <TextField name="bannerUrl" label="Banner z adresu URL" value={form.bannerUrl ?? ''} limit={2048} error={errors.bannerUrl} onChange={bannerUrl => change({ bannerUrl })} />
              <label htmlFor="content-bannerFile">Banner z pliku</label><FilePicker key={form.revision} id="content-bannerFile" accept="image/png,image/jpeg,image/webp,image/gif" file={file} onChange={setFile} />
              {errors.bannerFile && <p role="alert" className="text-destructive">{errors.bannerFile}</p>}
              <p className="text-xs text-muted-foreground">Do 5 MB. Wgrany plik ma pierwszeństwo przed URL.</p>
              <BannerImage source={banner} file={file} url={form.bannerUrl} sessionKey={sessionKey} />
            </div>
          </Section>
          <ContentChapters chapters={form.chapters} rooms={rooms} pathId={id} errors={errors} canDelete={isAdmin} highlightRoomId={arrived}
            onChange={chapters => change({ chapters })} onCreateRoom={index => void createRoom(index)} onRoom={openRoom}
            // The import dialog has its own form; React would bubble its submit out of the portal into this editor's form.
            actions={id != null && isAdmin && <span className="contents" onSubmit={e => e.stopPropagation()}><PathImportDialog disabled={loading || saving}
              existing={{ id, title: baseline.title, contentRevision: baseline.revision, chaptersRevision: baseline.chaptersRevision, chapters: baseline.chapters }}
              requestOpen={open => guard.request(open)} onImported={detail => {
                const next = fromDetail(detail); formRef.current = next; setForm(next); setBaseline(next); setFile(null);
                setSuccess(form.published ? 'Dodano pokoje. Ścieżka jest opublikowana, więc gracze już je widzą.' : 'Dodano pokoje. Gracze zobaczą je po publikacji ścieżki.');
                setErrors({}); setError(null); setLoading(true); setAttempt(value => value + 1);
              }} /></span>} />
          <Section title="Odblokowywanie" description="Ukończone pokoje pozostają dostępne. Blokady samouczków VM i VPN obowiązują dodatkowo.">
            <div className="grid gap-2">
              <label htmlFor="content-unlockMode">Tryb odblokowania</label>
              <select id="content-unlockMode" className="rounded border bg-background p-2" value={form.unlockMode} aria-describedby="content-unlockMode-help" onChange={e => change({ unlockMode: e.target.value as PathUnlockMode })}>
                {Object.entries(unlockModes).map(([mode, { label }]) => <option key={mode} value={mode}>{label}</option>)}
              </select>
              <span id="content-unlockMode-help" className="text-xs text-muted-foreground">{unlockModes[form.unlockMode].description}</span>
            </div>
          </Section>
          {id != null && isAdmin && <div className="flex justify-end border-t pt-5">
            <ConfirmAction title="Usunąć tę ścieżkę?" description="Rozdziały i zapisy graczy zostaną usunięte. Pokoje zostaną w puli." confirmLabel="Usuń ścieżkę" onConfirm={async () => { await adminApi.deletePath(id, sessionKey); guard.allowNavigation(); navigate('/admin/paths'); }}
              trigger={<Button type="button" variant="ghost" className="text-muted-foreground hover:text-destructive"><Trash2 />Usuń ścieżkę</Button>} />
          </div>}
        </fieldset>
      </form>}
  </>;
}
const systemRoutes: Record<string, string> = { ukos: '/learn/ukos' };
function SystemPath({ title, description, systemKey }: { title: string; description: string; systemKey: string }) {
  const route = systemRoutes[systemKey];
  return <>
    <Button asChild variant="ghost" className="mb-3"><Link to="/admin/paths">← Ścieżki</Link></Button>
    <PageHeader title={title} description="Status: Opublikowany · Ścieżka systemowa" actions={route && <Button asChild variant="outline"><Link to={route}>Otwórz ścieżkę</Link></Button>} />
    <StatusMessage kind="warning">Ta ścieżka jest utrzymywana w kodzie aplikacji. Nie można jej edytować ani usunąć w panelu. Usunąć ją może tylko developer z dostępem do bazy danych.</StatusMessage>
    <Section title="Informacje" className="mt-4">
      <dl className="grid gap-4">
        <div><dt className="text-xs text-muted-foreground">Tytuł</dt><dd className="flex items-center gap-2 font-medium"><Lock className="size-4" aria-hidden="true" />{title}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Opis</dt><dd>{description || 'Bez opisu'}</dd></div>
      </dl>
    </Section>
  </>;
}
export function BannerImage({ source, file, url, sessionKey }: { source: string | null; file: File | null; url: string | null; sessionKey: string | null }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let active = true; let objectUrl: string | null = null;
    if (file) { objectUrl = URL.createObjectURL(file); setSrc(objectUrl); }
    else if (source) { request(source, { auth: { sessionKey } }).then(r => { if (!r.ok) throw new Error(); return r.blob(); }).then(blob => { if (active) { objectUrl = URL.createObjectURL(blob); setSrc(objectUrl); } }).catch(() => { if (active) setSrc(null); }); }
    else setSrc(url);
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [source, file, url, sessionKey]);
  return src ? <img src={src} alt="Banner ścieżki" className="aspect-video max-w-lg rounded-lg border object-cover" /> : null;
}
