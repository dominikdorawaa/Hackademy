import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '../../context/AuthContext';
import * as adminApi from '../../services/adminApi';
import * as adminRequests from '../../services/adminRequests';
import type { DifficultyLevel, RoomAdminDto, RoomType, RoomWriteRequest } from '../../types/api';
import { ConfirmAction, FilePicker, LoadingRows, PageHeader, Section, StatusMessage } from '../../components/admin/AdminUi';
import { difficultyLabels, errorText } from '../../components/admin/adminFormat';
import TasksEditor from '../../components/admin/TasksEditor';
import { useAdminAccess } from './adminAccess';
import { pointsForDifficulty, roomBasePath } from './adminConfig';

const categories = ['Web', 'Crypto', 'Forensics', 'Reverse', 'OSINT', 'Network', 'Tutorial', 'Misc'];

interface RoomForm {
  title: string;
  shortDescription: string;
  description: string;
  category: string;
  difficulty: DifficultyLevel;
  points: string;
  flag: string;
  requiresVpn: boolean;
  hints: string[];
}

const emptyForm = (kind: RoomType): RoomForm => ({
  title: '',
  shortDescription: '',
  description: '',
  category: kind === 'PATH' ? 'Path' : 'Web',
  difficulty: 'EASY',
  points: '0',
  flag: '',
  requiresVpn: false,
  hints: [],
});

const formFromRoom = (room: RoomAdminDto, kind: RoomType): RoomForm => ({
  title: room.title,
  shortDescription: room.shortDescription ?? '',
  description: room.description,
  category: kind === 'PATH' ? 'Path' : room.category || 'Web',
  difficulty: kind === 'PATH' ? 'EASY' : room.difficulty,
  points: String(kind === 'PATH' ? room.points : pointsForDifficulty[room.difficulty]),
  flag: room.flag ?? '',
  requiresVpn: room.requiresVpn,
  hints: room.hints ?? [],
});

function toRoomRequest(form: RoomForm, kind: RoomType): RoomWriteRequest {
  return {
    title: form.title.trim(),
    shortDescription: form.shortDescription,
    description: form.description,
    difficulty: kind === 'PATH' ? 'EASY' : form.difficulty,
    category: kind === 'PATH' ? 'Path' : form.category,
    points: kind === 'PATH' ? Number(form.points) : pointsForDifficulty[form.difficulty],
    flag: form.flag,
    requiresVpn: form.requiresVpn,
    roomType: kind,
    hints: form.hints,
  };
}

export default function RoomEditorPage({ kind }: { kind: RoomType }) {
  const { roomId } = useParams();
  const isNew = roomId === 'new';
  const { token } = useAuth();
  const { isAdmin } = useAdminAccess();
  const navigate = useNavigate();
  const location = useLocation();
  const base = roomBasePath[kind];

  const [form, setForm] = useState<RoomForm>(() => emptyForm(kind));
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [hintDraft, setHintDraft] = useState('');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>((location.state as { flash?: string } | null)?.flash ?? null);
  const [missing, setMissing] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const loadKey = `${kind}:${roomId}:${token}`;
  const ready = isNew || loadedFor === loadKey;

  useEffect(() => {
    if (isNew || !token || !roomId) return;
    let active = true;
    setLoading(true);
    setLoadedFor(null);
    setMissing(false);
    setError(null);
    adminApi.getRoomAdmin(roomId, token)
      .then((room) => {
        if (!active) return;
        if (!room || room.roomType !== kind) {
          setMissing(true);
          return;
        }
        setForm(formFromRoom(room, kind));
        setLoadedFor(loadKey);
      })
      .catch((err: unknown) => {
        if (active) setError(errorText(err, 'Nie udało się pobrać pokoju.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isNew, roomId, token, kind, loadKey, loadAttempt]);

  const update = <K extends keyof RoomForm>(key: K, value: RoomForm[K]) => setForm((current) => ({ ...current, [key]: value }));

  const addHint = () => {
    const hint = hintDraft.trim();
    if (!hint) return;
    update('hints', [...form.hints, hint]);
    setHintDraft('');
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ready || loading || saving) return;
    setError(null);
    setSuccess(null);
    setSaving(true);
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const request = toRoomRequest(form, kind);
      const response = isNew
        ? await adminRequests.createRoom(request, file, headers)
        : await adminRequests.updateRoom(roomId as string, request, file, headers);
      const saved = await adminApi.readResponse<RoomAdminDto>(response as unknown as Response);
      setFile(null);
      setFileInputKey((key) => key + 1);
      if (isNew && saved) {
        const flash = `Pokój „${saved.title}” został utworzony.`;
        setSuccess(flash);
        navigate(`${base}/${saved.id}`, { replace: true, state: { flash } });
        return;
      }
      setSuccess('Zapisano zmiany w pokoju.');
    } catch (err) {
      setError(errorText(err, 'Nie udało się zapisać pokoju.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await adminApi.deleteRoom(roomId as string, token);
      navigate(base, { replace: true });
    } catch (err) {
      setError(errorText(err, 'Nie udało się usunąć pokoju.'));
    }
  };

  const listLabel = kind === 'PATH' ? 'Pokoje ścieżek' : 'Pokoje CTF';

  if (missing) {
    return (
      <div className="space-y-4">
        <StatusMessage kind="error">Nie znaleziono pokoju.</StatusMessage>
        <Button asChild variant="outline"><Link to={base}><ArrowLeft />{listLabel}</Link></Button>
      </div>
    );
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2 text-muted-foreground">
        <Link to={base}><ArrowLeft />{listLabel}</Link>
      </Button>
      <PageHeader
        title={isNew ? 'Nowy pokój' : form.title || 'Edycja pokoju'}
        description={kind === 'PATH' ? 'Pokój ścieżki z treścią, flagą i zadaniami.' : 'Pokój CTF rozwiązywany flagą.'}
        actions={!isNew && ready && isAdmin && (
          <ConfirmAction
            title="Usunąć ten pokój?"
            description="Pokój, jego zadania, podpowiedzi, plik i postępy graczy zostaną trwale usunięte."
            confirmLabel="Usuń pokój"
            onConfirm={remove}
            trigger={<Button variant="outline" className="text-destructive hover:text-destructive"><Trash2 />Usuń pokój</Button>}
          />
        )}
      />

      <div className="mb-4 space-y-2">
        {error && <StatusMessage kind="error">{error}</StatusMessage>}
        {success && <StatusMessage kind="success">{success}</StatusMessage>}
      </div>

      {loading ? (
        <LoadingRows rows={6} label="Ładowanie pokoju" />
      ) : !ready ? (
        <Button variant="outline" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Spróbuj ponownie</Button>
      ) : (
        <div className="space-y-6">
          <form onSubmit={submit} aria-label="Dane pokoju">
            <Section
              title="Dane pokoju"
              actions={<Button type="submit" disabled={saving}>{saving ? 'Zapisywanie…' : isNew ? 'Utwórz pokój' : 'Zapisz zmiany'}</Button>}
            >
              <div className="grid gap-5 md:grid-cols-2">
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="room-title">Tytuł</Label>
                  <Input id="room-title" value={form.title} onChange={(event) => update('title', event.target.value)} required maxLength={255} />
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="room-short">Krótki opis</Label>
                  <Input
                    id="room-short"
                    value={form.shortDescription}
                    onChange={(event) => update('shortDescription', event.target.value)}
                    maxLength={100}
                    aria-describedby="room-short-hint"
                  />
                  <p id="room-short-hint" className="text-xs text-muted-foreground tabular-nums">
                    Zajawka na liście pokoi, {form.shortDescription.length}/100 znaków.
                  </p>
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="room-description">Opis</Label>
                  <Textarea
                    id="room-description"
                    value={form.description}
                    onChange={(event) => update('description', event.target.value)}
                    required
                    className="min-h-32"
                  />
                </div>
                {kind === 'CTF' ? (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="room-category">Kategoria</Label>
                      <Select value={form.category} onValueChange={(value) => update('category', value)}>
                        <SelectTrigger id="room-category" className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="room-difficulty">Trudność</Label>
                      <Select value={form.difficulty} onValueChange={(value) => update('difficulty', value as DifficultyLevel)}>
                        <SelectTrigger id="room-difficulty" className="w-full" aria-describedby="room-points-hint"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(difficultyLabels) as DifficultyLevel[]).map((level) => (
                            <SelectItem key={level} value={level}>{difficultyLabels[level]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p id="room-points-hint" className="text-xs text-muted-foreground tabular-nums">
                        Za rozwiązanie: {pointsForDifficulty[form.difficulty]} pkt
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="grid gap-2">
                    <Label htmlFor="room-points">Punkty</Label>
                    <Input
                      id="room-points"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={form.points}
                      onChange={(event) => update('points', event.target.value)}
                      required
                      className="tabular-nums"
                    />
                  </div>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="room-flag">Flaga</Label>
                  <Input
                    id="room-flag"
                    value={form.flag}
                    onChange={(event) => update('flag', event.target.value)}
                    required
                    placeholder="CTF{...}"
                    className="font-mono"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="room-file">Plik do pobrania</Label>
                  <FilePicker key={fileInputKey} id="room-file" file={file} onChange={setFile} describedBy="room-file-hint" />
                  <p id="room-file-hint" className="text-xs text-muted-foreground">
                    {isNew ? 'Opcjonalnie.' : 'Zostaw puste, aby zachować obecny plik.'}
                  </p>
                </div>
                <div className="flex items-center gap-3 self-end pb-2">
                  <Switch id="room-vpn" checked={form.requiresVpn} onCheckedChange={(checked) => update('requiresVpn', checked)} />
                  <Label htmlFor="room-vpn">Wymaga VPN</Label>
                </div>
              </div>

              <fieldset className="mt-6 border-t pt-5">
                <legend className="sr-only">Podpowiedzi</legend>
                <p className="mb-1 text-sm font-medium text-foreground">Podpowiedzi</p>
                <p className="mb-3 text-xs text-muted-foreground">Odblokowywane po kolei. Każda zmniejsza nagrodę o 25%.</p>
                {form.hints.length > 0 && (
                  <ol className="mb-3 space-y-2">
                    {form.hints.map((hint, index) => (
                      <li key={`${index}-${hint}`} className="flex items-start gap-3 rounded-lg border bg-background/40 px-3 py-2 text-sm">
                        <span className="mt-0.5 font-mono text-xs text-muted-foreground tabular-nums">{index + 1}.</span>
                        <span className="min-w-0 flex-1 break-words">{hint}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Usuń podpowiedź ${index + 1}`}
                          onClick={() => update('hints', form.hints.filter((_, position) => position !== index))}
                        >
                          <X />
                        </Button>
                      </li>
                    ))}
                  </ol>
                )}
                <div className="flex gap-2">
                  <Input
                    aria-label="Nowa podpowiedź"
                    placeholder="Treść podpowiedzi"
                    value={hintDraft}
                    onChange={(event) => setHintDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addHint();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={addHint} disabled={!hintDraft.trim()}><Plus />Dodaj</Button>
                </div>
              </fieldset>
            </Section>
          </form>

          {kind === 'PATH' && (
            isNew ? (
              <Section title="Zadania" description="Zadania prowadzą gracza przez pokój krok po kroku.">
                <p className="text-sm text-muted-foreground">Utwórz pokój, aby dodać do niego zadania.</p>
              </Section>
            ) : (
              <TasksEditor roomId={Number(roomId)} />
            )
          )}
        </div>
      )}
    </>
  );
}
