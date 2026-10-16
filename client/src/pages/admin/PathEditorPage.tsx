import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
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
  const { token } = useAuth();
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
  const [success, setSuccess] = useState<string | null>((location.state as { flash?: string } | null)?.flash ?? null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.all([idRef.current == null ? Promise.resolve(null) : adminApi.getPath(idRef.current, token), adminApi.getAllRoomsAdmin(token)])
      .then(([detail, pool]) => {
        if (!active) return;
        if (idRef.current != null && !detail) throw new Error('Nie znaleziono ścieżki.');
        if (detail) { const next = fromDetail(detail); setForm(next); setBaseline(next); if (detail.hasBanner) setBanner(`${API_URL}/api/admin/content/paths/${detail.id}/banner`); }
        setRooms(pool ?? []); setError(null);
      }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, attempt]);
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline) || !!file;
  const change = (values: Partial<PathSave>) => { setForm(current => ({ ...current, ...values })); setSuccess(null); };
  const save = async (published = formRef.current.published, notify = true) => {
    if (savingRef.current) return false;
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
      if (published && !c.roomIds?.length) nextErrors[`chapters.${i}.rooms`] = 'Dodaj pokój do rozdziału przed publikacją';
      else if (published && c.roomIds?.some(roomId => rooms.find(r => r.id === roomId)?.published === false)) nextErrors[`chapters.${i}.rooms`] = 'Opublikuj pokoje rozdziału przed publikacją ścieżki';
    });
    setSuccess(null); setErrors(nextErrors); setError(null);
    if (Object.keys(nextErrors).length) { focusError(nextErrors); return false; }
    savingRef.current = true; setSaving(true);
    try {
      const detail = await contentApi.savePath(idRef.current, { ...current, published }, file, token);
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
  const createRoom = (index: number) => guard.request(() => {
    const chapter = formRef.current.chapters[index];
    const savedChapter = chapter?.id != null ? baseline.chapters.find(c => c.id === chapter.id) ?? chapter : null;
    if (idRef.current != null && savedChapter?.id) {
      navigate(`/admin/paths/rooms/new?pathId=${idRef.current}&chapterId=${savedChapter.id}&pathRevision=${formRef.current.revision}`);
    } else {
      const source = idRef.current == null ? empty : baseline;
      const list = [...source.chapters];
      const targetIndex = Math.min(index, list.length);
      if (!list[targetIndex] || list[targetIndex].id != null) list.splice(targetIndex, 0, { id: null, title: `Rozdział ${targetIndex + 1}`, roomIds: [] });
      navigate('/admin/paths/rooms/new', { state: { parentDraft: { ...source, chapters: list }, parentId: idRef.current, chapterIndex: targetIndex } });
    }
  });
  return <>
    {guard.dialog}
    <Button asChild variant="ghost" className="mb-3"><Link to="/admin/paths">← Ścieżki</Link></Button>
    <PageHeader title={id == null ? 'Nowa ścieżka' : form.title || 'Ścieżka'} description={`Status: ${form.published ? 'Opublikowany' : 'Szkic'}`} actions={<>{id != null && isAdmin && <PathImportDialog disabled={loading || saving}
      existing={{ id, title: baseline.title, contentRevision: baseline.revision, chaptersRevision: baseline.chaptersRevision, chapters: baseline.chapters }}
      requestOpen={open => guard.request(open)} onImported={detail => {
        const next = fromDetail(detail); formRef.current = next; setForm(next); setBaseline(next); setFile(null);
        setSuccess('Dodano pokoje jako szkice. Istniejąca ścieżka zachowała swój status publikacji.');
        setErrors({}); setError(null); setLoading(true); setAttempt(value => value + 1);
      }} />}<Button variant="outline" disabled={saving} onClick={() => guard.request(() => { if (idRef.current != null) navigate(`/admin/preview/paths/${idRef.current}`); else setError('Zapisz szkic przed podglądem.'); })}>Podgląd</Button>{id != null && isAdmin && <ConfirmAction title="Usunąć tę ścieżkę?" description="Rozdziały i zapisy graczy zostaną usunięte. Pokoje zostaną w puli." confirmLabel="Usuń ścieżkę" onConfirm={async () => { await adminApi.deletePath(id, token); guard.allowNavigation(); navigate('/admin/paths'); }} trigger={<Button variant="outline">Usuń ścieżkę</Button>} />}</>} />
    {error && <StatusMessage kind="error">{error}</StatusMessage>}{success && <StatusMessage kind="success">{success}</StatusMessage>}
    {loading ? <LoadingRows label="Ładowanie ścieżki" /> : error && id != null && !form.title ? <Button onClick={() => setAttempt(a => a + 1)}>Spróbuj ponownie</Button> :
      <form noValidate onSubmit={e => { e.preventDefault(); void normalSave(); }} className="mt-4 grid gap-6" aria-label="Edytor ścieżki">
        <fieldset disabled={saving} className="grid min-w-0 gap-6">
          <Section title="Informacje" description="Tytuł i nazwy rozdziałów są wymagane do zapisu szkicu. Opis i gotowe pokoje są wymagane przy publikacji.">
            <div className="grid gap-5">
              <TextField name="title" label="Tytuł" value={form.title} limit={120} required error={errors.title} onChange={title => change({ title })} />
              <TextField name="description" label="Opis" value={form.description} limit={20000} required={form.published} multiline error={errors.description} onChange={description => change({ description })} />
              <TextField name="bannerUrl" label="Banner z adresu URL" value={form.bannerUrl ?? ''} limit={2048} error={errors.bannerUrl} onChange={bannerUrl => change({ bannerUrl })} />
              <label htmlFor="content-bannerFile">Banner z pliku</label><FilePicker key={form.revision} id="content-bannerFile" accept="image/png,image/jpeg,image/webp,image/gif" file={file} onChange={setFile} />
              {errors.bannerFile && <p role="alert" className="text-destructive">{errors.bannerFile}</p>}
              <p className="text-xs text-muted-foreground">Do 5 MB. Wgrany plik ma pierwszeństwo przed URL.</p>
              <BannerImage source={banner} file={file} url={form.bannerUrl} token={token} />
            </div>
          </Section>
          <Section title="Odblokowywanie" description="Ukończone pokoje pozostają dostępne. Blokady samouczków VM i VPN obowiązują dodatkowo.">
            <div className="grid gap-2">
              <label htmlFor="content-unlockMode">Tryb odblokowania</label>
              <select id="content-unlockMode" className="rounded border bg-background p-2" value={form.unlockMode} aria-describedby="content-unlockMode-help" onChange={e => change({ unlockMode: e.target.value as PathUnlockMode })}>
                {Object.entries(unlockModes).map(([mode, { label }]) => <option key={mode} value={mode}>{label}</option>)}
              </select>
              <span id="content-unlockMode-help" className="text-xs text-muted-foreground">{unlockModes[form.unlockMode].description}</span>
            </div>
          </Section>
          <ContentChapters chapters={form.chapters} rooms={rooms} pathId={id} errors={errors} canDelete={isAdmin} onChange={chapters => change({ chapters })} onCreateRoom={createRoom} onRoom={roomId => guard.request(() => navigate(`/admin/paths/rooms/${roomId}`))} />
          <div className="flex flex-wrap justify-end gap-3 border-t pt-5">
            {form.published ? <Button type="button" variant="outline" onClick={() => void normalSave(false)}>Przenieś do szkiców</Button> : <Button type="button" variant="outline" onClick={() => void normalSave(true)}>Opublikuj</Button>}
            <Button type="submit">{saving ? 'Zapisywanie…' : form.published ? 'Zapisz zmiany' : 'Zapisz szkic'}</Button>
          </div>
        </fieldset>
      </form>}
  </>;
}
export function BannerImage({ source, file, url, token }: { source: string | null; file: File | null; url: string | null; token: string | null }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let active = true; let objectUrl: string | null = null;
    if (file) { objectUrl = URL.createObjectURL(file); setSrc(objectUrl); }
    else if (source) { fetch(source, { headers: { Authorization: `Bearer ${token}` } }).then(r => { if (!r.ok) throw new Error(); return r.blob(); }).then(blob => { if (active) { objectUrl = URL.createObjectURL(blob); setSrc(objectUrl); } }).catch(() => { if (active) setSrc(null); }); }
    else setSrc(url);
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [source, file, url, token]);
  return src ? <img src={src} alt="Banner ścieżki" className="aspect-video max-w-lg rounded-lg border object-cover" /> : null;
}
