import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { StatusMessage } from '../../components/admin/AdminUi';
import { useAuth } from '../../context/AuthContext';
import { ContentError, importPath } from '../../services/contentApi';
import example from '../../data/path-import-example.json?raw';

export default function PathImportDialog() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const changeOpen = (value: boolean) => {
    if (busy) return;
    setOpen(value);
    setFile(null);
    setErrors([]);
    setCopyStatus(null);
  };
  const submit = async () => {
    if (!file || busy) return;
    if (file.size === 0 || file.size > 5 * 1024 * 1024) {
      setErrors(['Wybierz niepusty plik JSON do 5 MB.']);
      return;
    }
    setBusy(true);
    setErrors([]);
    try {
      const path = await importPath(file, token);
      navigate(`/admin/paths/${path.id}`, { state: { flash: 'Zaimportowano ścieżkę jako szkic. Bannery i pliki dodasz w edytorze.' } });
    } catch (error) {
      const fields = error instanceof ContentError ? Object.entries(error.fields) : [];
      setErrors(fields.length ? fields.map(([field, message]) => `${field}: ${message}`) : [error instanceof Error ? error.message : 'Nie udało się zaimportować ścieżki.']);
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(example);
      setCopyStatus('Skopiowano przykład.');
    } catch {
      setCopyStatus('Nie udało się skopiować. Pobierz przykład lub zaznacz tekst poniżej.');
    }
  };

  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><Button variant="outline"><Upload />Importuj JSON</Button></DialogTrigger>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl" showCloseButton={!busy}>
      <DialogHeader>
        <DialogTitle>Import ścieżki z JSON</DialogTitle>
        <DialogDescription>Powstanie nowa ścieżka ze wszystkimi pokojami jako szkic. Żaden element nie zostanie zapisany, jeśli plik zawiera błędy. Bannery i pliki pokoi dodasz później w edytorze.</DialogDescription>
      </DialogHeader>
      <form onSubmit={event => { event.preventDefault(); void submit(); }} className="grid min-w-0 gap-4" aria-busy={busy}>
        <label htmlFor="path-import-file">Plik JSON (do 5 MB)</label>
        <input key={String(open)} id="path-import-file" type="file" accept=".json,application/json" disabled={busy} onChange={event => { setFile(event.target.files?.[0] ?? null); setErrors([]); }} />
        {errors.length > 0 && <StatusMessage kind="error"><ul className="max-h-48 overflow-auto break-words">{errors.map((error, index) => <li key={index}>{error}</li>)}</ul></StatusMessage>}
        <details>
          <summary className="cursor-pointer">Format i przykładowy plik JSON</summary>
          <div className="mt-3 grid min-w-0 gap-3">
            <p className="text-sm text-muted-foreground">Kolejność list wyznacza kolejność nauki. Tryb: OPEN, CHAPTER lub ROOM (domyślnie OPEN). Pokój bez zadań wymaga flagi. Tytuły pokoi muszą być różne w obrębie rozdziału. Maksymalnie 100 rozdziałów i 500 pokoi łącznie.</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => void copy()}>Kopiuj przykład</Button>
              <Button asChild variant="outline"><a href={`data:application/json;charset=utf-8,${encodeURIComponent(example)}`} download="przyklad-sciezki.json">Pobierz przykład</a></Button>
            </div>
            {copyStatus && <p role="status" className="text-sm">{copyStatus}</p>}
            <textarea aria-label="Przykładowy JSON" readOnly value={example} rows={12} className="w-full min-w-0 rounded border bg-background p-3 font-mono text-xs" />
          </div>
        </details>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => changeOpen(false)}>Anuluj</Button>
          <Button type="submit" disabled={!file || busy}>{busy ? 'Importowanie…' : 'Importuj jako szkic'}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
