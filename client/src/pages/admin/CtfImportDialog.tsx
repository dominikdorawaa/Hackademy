import { useRef, useState } from 'react';
import { ChevronDown, FileJson, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import JsonFilePicker from '../../components/admin/JsonFilePicker';
import { StatusMessage } from '../../components/admin/AdminUi';
import { useAuth } from '../../context/AuthContext';
import { ContentError, importCtfRooms } from '../../services/contentApi';
import example from '../../data/ctf-import-example.json?raw';

export default function CtfImportDialog({ onImported, disabled }: { onImported: (count: number) => void; disabled: boolean }) {
  const { sessionKey } = useAuth();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const changeOpen = (value: boolean) => {
    if (submitting.current) return;
    setOpen(value); setFile(null); setErrors([]); setCopyStatus(null);
  };
  const submit = async () => {
    if (!file || submitting.current) return;
    if (file.size === 0 || file.size > 5 * 1024 * 1024) { setErrors(['Wybierz niepusty plik JSON do 5 MB.']); return; }
    submitting.current = true; setBusy(true); setErrors([]);
    try {
      const result = await importCtfRooms(file, sessionKey);
      onImported(result.count); setOpen(false); setFile(null);
    } catch (error) {
      const fields = error instanceof ContentError ? Object.entries(error.fields) : [];
      setErrors(fields.length ? fields.map(([field, message]) => `${field}: ${message}`) : [error instanceof Error ? error.message : 'Nie udało się zaimportować pokoi CTF.']);
    } finally { submitting.current = false; setBusy(false); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(example); setCopyStatus('Skopiowano przykład.'); }
    catch { setCopyStatus('Nie udało się skopiować. Pobierz przykład lub zaznacz tekst poniżej.'); }
  };
  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><Button variant="outline" disabled={disabled}><Upload />Importuj CTF z JSON</Button></DialogTrigger>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl" showCloseButton={!busy}>
      <DialogHeader>
        <DialogTitle>Import pokoi CTF z JSON</DialogTitle>
        <DialogDescription>Nowe pokoje zapiszemy jako szkice. Punkty wynikają z trudności; pliki i publikację dodasz później w edytorze.</DialogDescription>
      </DialogHeader>
      <form className="grid min-w-0 gap-4" aria-busy={busy} onSubmit={event => { event.preventDefault(); void submit(); }}>
        <JsonFilePicker file={file} disabled={busy} onChange={selected => { setFile(selected); setErrors([]); }} />
        <p className="text-xs text-muted-foreground">Jeśli plik zawiera błędy, żaden pokój nie zostanie zapisany.</p>
        {errors.length > 0 && <StatusMessage kind="error"><ul className="max-h-48 overflow-auto break-words">{errors.map((error, index) => <li key={index}>{error}</li>)}</ul></StatusMessage>}
        <details className="group min-w-0 rounded-lg border bg-muted/10">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-3 text-sm font-medium outline-none hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"><FileJson className="size-4 text-muted-foreground" aria-hidden="true" /><span className="min-w-0 flex-1">Format i przykładowy plik JSON</span><ChevronDown className="size-4 shrink-0 text-muted-foreground group-open:rotate-180" aria-hidden="true" /></summary>
          <div className="grid min-w-0 gap-3 border-t p-3">
            <p className="text-sm text-muted-foreground">Plik zawiera listę rooms z maksymalnie 500 nowymi pokojami CTF. Każdy wymaga tytułu, opisu, kategorii, trudności i flagi. Tytuły muszą być różne w pliku i wśród wszystkich pokoi CTF, także szkiców.</p>
            <p className="text-sm text-muted-foreground">Punkty: EASY 50, MEDIUM 100, HARD 150, INSANE 200. Nie dodawaj pola points do JSON.</p>
            <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => void copy()}>Kopiuj przykład</Button><Button asChild variant="outline"><a href={`data:application/json;charset=utf-8,${encodeURIComponent(example)}`} download="przyklad-ctf.json">Pobierz przykład</a></Button></div>
            {copyStatus && <p role="status" className="text-sm">{copyStatus}</p>}
            <textarea aria-label="Przykładowy JSON" readOnly value={example} rows={12} className="w-full min-w-0 rounded border bg-background p-3 font-mono text-xs" />
          </div>
        </details>
        <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => changeOpen(false)}>Anuluj</Button><Button type="submit" disabled={!file || busy}>{busy ? 'Importowanie…' : 'Importuj jako szkice'}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
