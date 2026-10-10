import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import API_URL from '../../apiConfig';
import { useAuth } from '../../context/AuthContext';
import * as adminApi from '../../services/adminApi';
import * as adminRequests from '../../services/adminRequests';
import type { PathAdminDetailDto, RoomAdminSummaryDto } from '../../types/api';
import ChaptersEditor from '../../components/admin/ChaptersEditor';
import { ConfirmAction, FilePicker, LoadingRows, PageHeader, Section, StatusMessage } from '../../components/admin/AdminUi';
import { errorText } from '../../components/admin/adminFormat';
import { useAdminAccess } from './adminAccess';
import { roomBasePath } from './adminConfig';

function bannerSource(detail: PathAdminDetailDto) {
  if (!detail.bannerUrl) return null;
  return detail.hasBanner ? `${API_URL}${detail.bannerUrl}?v=${Date.now()}` : detail.bannerUrl;
}

export default function PathEditorPage() {
  const { pathId } = useParams();
  const id = Number(pathId);
  const { token } = useAuth();
  const { isAdmin } = useAdminAccess();
  const navigate = useNavigate();
  const location = useLocation();

  const [detail, setDetail] = useState<PathAdminDetailDto | null>(null);
  const [rooms, setRooms] = useState<RoomAdminSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [savingMeta, setSavingMeta] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>((location.state as { flash?: string } | null)?.flash ?? null);

  const applyDetail = useCallback((next: PathAdminDetailDto) => {
    setDetail(next);
    setTitle(next.title);
    setDescription(next.description ?? '');
    setBannerUrl(next.hasBanner ? '' : next.bannerUrl ?? '');
    setBannerPreview(bannerSource(next));
  }, []);

  const loadRooms = useCallback(async () => {
    const data = (await adminApi.getAllRoomsAdmin(token)) ?? [];
    setRooms(data.filter((room) => room.roomType === 'PATH'));
  }, [token]);

  useEffect(() => {
    if (!token || !Number.isFinite(id)) return;
    let active = true;
    Promise.all([adminApi.getPath(id, token), loadRooms()])
      .then(([path]) => {
        if (active && path) applyDetail(path);
      })
      .catch((err: unknown) => {
        if (active) setError(errorText(err, 'Nie udało się pobrać ścieżki.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, token, applyDetail, loadRooms]);

  const saveMeta = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingMeta(true);
    setError(null);
    setSuccess(null);
    try {
      if (bannerFile) {
        await adminApi.readResponse(await adminRequests.uploadBanner(id, bannerFile, { Authorization: `Bearer ${token}` }) as unknown as Response);
      }
      await adminApi.updatePath(id, { title: title.trim(), description, bannerUrl: bannerUrl.trim() || null }, token);
      const refreshed = await adminApi.getPath(id, token);
      if (refreshed) applyDetail(refreshed);
      setBannerFile(null);
      setFileInputKey((key) => key + 1);
      setSuccess('Zapisano informacje o ścieżce.');
    } catch (err) {
      setError(errorText(err, 'Nie udało się zapisać ścieżki.'));
    } finally {
      setSavingMeta(false);
    }
  };

  const remove = async () => {
    try {
      await adminApi.deletePath(id, token);
      navigate('/admin/paths', { replace: true });
    } catch (err) {
      setError(errorText(err, 'Nie udało się usunąć ścieżki.'));
    }
  };

  const onChaptersSaved = (next: PathAdminDetailDto) => {
    setDetail(next);
    void loadRooms().catch(() => undefined);
  };

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2 text-muted-foreground">
        <Link to="/admin/paths"><ArrowLeft />Ścieżki</Link>
      </Button>
      <PageHeader
        title={detail?.title ?? 'Ścieżka'}
        description="Ustal informacje widoczne dla graczy oraz kolejność rozdziałów i pokoi."
        actions={detail && (
          <>
            <Button asChild variant="outline">
              <a href={`/learn/paths/${id}`} target="_blank" rel="noreferrer"><ExternalLink />Podgląd</a>
            </Button>
            {isAdmin && (
              <ConfirmAction
                title="Usunąć tę ścieżkę?"
                description="Rozdziały i zapisy graczy zostaną usunięte. Pokoje zostaną w puli."
                confirmLabel="Usuń ścieżkę"
                onConfirm={remove}
                trigger={<Button variant="outline" className="text-destructive hover:text-destructive"><Trash2 />Usuń</Button>}
              />
            )}
          </>
        )}
      />
      <div className="mb-4 space-y-2">
        {error && <StatusMessage kind="error">{error}</StatusMessage>}
        {success && <StatusMessage kind="success">{success}</StatusMessage>}
      </div>

      {loading ? (
        <LoadingRows rows={6} label="Ładowanie ścieżki" />
      ) : !detail ? (
        <Button asChild variant="outline"><Link to="/admin/paths"><ArrowLeft />Wróć do listy</Link></Button>
      ) : (
        <div className="space-y-6">
          <form onSubmit={saveMeta} aria-label="Informacje o ścieżce">
            <Section
              title="Informacje"
              actions={<Button type="submit" disabled={savingMeta || !title.trim()}>{savingMeta ? 'Zapisywanie…' : 'Zapisz informacje'}</Button>}
            >
              <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_16rem]">
                <div className="grid gap-5">
                  <div className="grid gap-2">
                    <Label htmlFor="path-title">Tytuł</Label>
                    <Input id="path-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="path-description">Opis</Label>
                    <Textarea id="path-description" value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-24" />
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="path-banner-url">Baner z adresu URL</Label>
                      <Input id="path-banner-url" type="url" value={bannerUrl} placeholder="https://…" onChange={(event) => setBannerUrl(event.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="path-banner-file">Baner z pliku</Label>
                      <FilePicker key={fileInputKey} id="path-banner-file" accept="image/*" file={bannerFile} onChange={setBannerFile} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Wgrany plik ma pierwszeństwo przed adresem URL.</p>
                </div>
                <div className="grid content-start gap-2">
                  <p className="text-sm font-medium text-foreground">Podgląd banera</p>
                  {bannerPreview ? (
                    <img src={bannerPreview} alt={`Baner ścieżki ${detail.title}`} className="aspect-video w-full rounded-lg border object-cover" />
                  ) : (
                    <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
                      Brak banera
                    </div>
                  )}
                </div>
              </div>
            </Section>
          </form>

          <ChaptersEditor
            pathId={id}
            chapters={detail.chapters}
            rooms={rooms}
            canDeleteChapters={isAdmin}
            onSaved={onChaptersSaved}
            roomHref={(roomId) => `${roomBasePath.PATH}/${roomId}`}
            newRoomHref={`${roomBasePath.PATH}/new`}
          />
        </div>
      )}
    </>
  );
}
