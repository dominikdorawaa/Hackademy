import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileJson, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { StatusMessage } from '../../components/admin/AdminUi';
import { useAuth } from '../../context/AuthContext';
import { ContentError, importPath, importPathRooms } from '../../services/contentApi';
import JsonFilePicker from '../../components/admin/JsonFilePicker';
import type { ChapterRequest, PathAdminDetailDto } from '../../types/api';
import example from '../../data/path-import-example.json?raw';

const roomsExample = JSON.stringify({ rooms: (JSON.parse(example) as { chapters: { rooms: unknown[] }[] }).chapters[0].rooms }, null, 2);
export interface ExistingImportPath { id: number; title: string; contentRevision: number; chaptersRevision: number; chapters: ChapterRequest[] }
export default function PathImportDialog({ existing, requestOpen, onImported, disabled = false }: {
  existing?: ExistingImportPath; requestOpen?: (open: () => void) => void; onImported?: (path: PathAdminDetailDto) => void; disabled?: boolean;
}) {
  const { sessionKey } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [chapterId, setChapterId] = useState<number | null>(null);
  const chapters = existing?.chapters.filter(chapter => chapter.id != null) ?? [];
  const selectedChapter = chapters.find(chapter => chapter.id === chapterId) ?? chapters[0];
  const sample = existing ? roomsExample : example;

  const changeOpen = (value: boolean) => {
    if (busy) return;
    if (value && requestOpen) requestOpen(() => setOpen(true)); else setOpen(value);
    setFile(null);
    setErrors([]);
    setCopyStatus(null);
    setChapterId(null);
  };
  const submit = async () => {
    if (!file || busy || existing && !selectedChapter?.id) return;
    if (file.size === 0 || file.size > 5 * 1024 * 1024) {
      setErrors(['Wybierz niepusty plik JSON do 5 MB.']);
      return;
    }
    setBusy(true);
    setErrors([]);
    try {
      if (existing && selectedChapter?.id != null) {
        const path = await importPathRooms(existing.id, { chapterId: selectedChapter.id, contentRevision: existing.contentRevision, chaptersRevision: existing.chaptersRevision }, file, sessionKey);
        onImported?.(path);
        setOpen(false); setFile(null);
      } else {
        const path = await importPath(file, sessionKey);
        navigate(`/admin/paths/${path.id}`, { state: { flash: 'Zaimportowano ścieżkę jako szkic. Bannery i pliki dodasz w edytorze.' } });
      }
    } catch (error) {
      const fields = error instanceof ContentError ? Object.entries(error.fields) : [];
      setErrors(fields.length ? fields.map(([field, message]) => `${field}: ${message}`) : [error instanceof Error ? error.message : 'Nie udało się zaimportować ścieżki.']);
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sample);
      setCopyStatus('Skopiowano przykład.');
    } catch {
      setCopyStatus('Nie udało się skopiować. Pobierz przykład lub zaznacz tekst poniżej.');
    }
  };

  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><Button variant="outline" disabled={disabled || !!existing && chapters.length === 0}><Upload />{existing ? 'Importuj pokoje z JSON' : 'Importuj JSON'}</Button></DialogTrigger>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl" showCloseButton={!busy}>
      <DialogHeader>
        <DialogTitle>{existing ? 'Dodaj pokoje z JSON' : 'Import ścieżki z JSON'}</DialogTitle>
        <DialogDescription>{existing ? 'Nowe pokoje dopiszemy na końcu wybranego rozdziału jako szkice. Istniejące pokoje i postępy pozostaną bez zmian.' : 'Utwórz nową ścieżkę z rozdziałami i pokojami jako szkic. Bannery, pliki i publikację dodasz później w edytorze.'}</DialogDescription>
      </DialogHeader>
      <form onSubmit={event => { event.preventDefault(); void submit(); }} className="grid min-w-0 gap-4" aria-busy={busy}>
        {existing && <div className="grid gap-2 rounded-lg border bg-muted/20 p-3">
          <p className="break-words text-sm font-medium">Ścieżka: {existing.title}</p>
          <label htmlFor="room-import-chapter" className="text-xs text-muted-foreground">Dodaj do rozdziału</label>
          <select id="room-import-chapter" className="min-h-10 w-full min-w-0 rounded border bg-background px-3 text-sm" value={selectedChapter?.id ?? ''} disabled={busy} onChange={event => setChapterId(Number(event.target.value))}>
            {chapters.map((chapter, index) => <option key={chapter.id} value={chapter.id!}>{index + 1}. {chapter.title}</option>)}
          </select>
        </div>}
        <JsonFilePicker file={file} disabled={busy} onChange={selected => { setFile(selected); setErrors([]); }} />
        <p className="text-xs text-muted-foreground">Jeśli plik zawiera błędy, żaden pokój nie zostanie zapisany.</p>
        {errors.length > 0 && <StatusMessage kind="error"><ul className="max-h-48 overflow-auto break-words">{errors.map((error, index) => <li key={index}>{error}</li>)}</ul></StatusMessage>}
        <details className="group min-w-0 rounded-lg border bg-muted/10">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-3 text-sm font-medium outline-none hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"><FileJson className="size-4 text-muted-foreground" aria-hidden="true" /><span className="min-w-0 flex-1">Format i przykładowy plik JSON</span><ChevronDown className="size-4 shrink-0 text-muted-foreground group-open:rotate-180" aria-hidden="true" /></summary>
          <div className="grid min-w-0 gap-3 border-t p-3">
            <p className="text-sm text-muted-foreground">{existing ? 'Plik zawiera listę rooms z nowymi pokojami. Maksymalnie 500 pokoi w rozdziale, łącznie z istniejącymi.' : 'Kolejność list wyznacza kolejność nauki. Tryb: OPEN, CHAPTER lub ROOM (domyślnie OPEN). Maksymalnie 100 rozdziałów i 500 pokoi łącznie.'} Pokój bez zadań wymaga flagi. Tytuły pokoi muszą być różne w obrębie rozdziału.</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => void copy()}>Kopiuj przykład</Button>
              <Button asChild variant="outline"><a href={`data:application/json;charset=utf-8,${encodeURIComponent(sample)}`} download={existing ? 'przyklad-pokoi.json' : 'przyklad-sciezki.json'}>Pobierz przykład</a></Button>
            </div>
            {copyStatus && <p role="status" className="text-sm">{copyStatus}</p>}
            <textarea aria-label="Przykładowy JSON" readOnly value={sample} rows={12} className="w-full min-w-0 rounded border bg-background p-3 font-mono text-xs" />
          </div>
        </details>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => changeOpen(false)}>Anuluj</Button>
          <Button type="submit" disabled={!file || busy || !!existing && !selectedChapter}>{busy ? 'Importowanie…' : existing ? 'Dodaj pokoje jako szkice' : 'Importuj jako szkic'}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
