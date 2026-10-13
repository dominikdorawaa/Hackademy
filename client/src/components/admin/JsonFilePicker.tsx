import { useRef } from 'react';
import { FileJson, FolderOpen, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function JsonFilePicker({ file, disabled, onChange }: { file: File | null; disabled: boolean; onChange: (file: File | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return <div className="grid gap-2">
    <label htmlFor="json-import-file" className="text-sm font-medium">Plik JSON (do 5 MB)</label>
    <input ref={input} id="json-import-file" type="file" accept=".json,application/json" className="sr-only" tabIndex={-1} disabled={disabled}
      onChange={event => { const selected = event.target.files?.[0]; if (selected) onChange(selected); event.target.value = ''; }} />
    <div className="flex min-w-0 flex-col items-center gap-3 rounded-xl border-2 border-dashed border-primary/35 bg-primary/5 px-5 py-6 text-center">
      <div className="flex size-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><FileJson className="size-6" aria-hidden="true" /></div>
      {file ? <div className="grid min-w-0 max-w-full gap-1" role="status">
        <p className="break-all text-sm font-semibold">{file.name}</p>
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground"><Check className="size-3.5 text-primary" aria-hidden="true" />Wybrany plik · {(file.size / 1024).toLocaleString('pl', { maximumFractionDigits: 1 })} KB</p>
      </div> : <div className="grid gap-1"><p className="text-sm font-semibold">Wybierz plik do importu</p><p className="text-xs text-muted-foreground">Plik .json z Twojego komputera, maksymalnie 5 MB.</p></div>}
      <Button type="button" variant="outline" className="min-h-10 border-primary/40 bg-background px-5 text-primary hover:bg-primary/10 hover:text-primary" disabled={disabled} onClick={() => input.current?.click()}><FolderOpen aria-hidden="true" />{file ? 'Zmień plik' : 'Wybierz plik JSON'}</Button>
    </div>
  </div>;
}
