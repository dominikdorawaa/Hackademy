import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { isReverificationCancelledError } from '@clerk/react/errors';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { StatusMessage } from '../common/StatusMessage';
import { errorText } from '../../lib/errorText';

export function DeleteAccountDialog({ username, passwordEnabled, onDelete }: {
  username: string;
  passwordEnabled?: boolean;
  onDelete: (password?: string) => Promise<void>;
}) {
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const change = (next: boolean) => {
    if (deleting) return;
    setOpen(next);
    setValue('');
    setError('');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if ((passwordEnabled && !value) || deleting) return;
    setDeleting(true);
    setError('');
    if (!passwordEnabled) setOpen(false);
    try {
      await onDelete(passwordEnabled ? value : undefined);
    } catch (failure) {
      setDeleting(false);
      if (isReverificationCancelledError(failure)) return;
      setError(errorText(failure, 'Nie udało się usunąć konta. Spróbuj ponownie.'));
      setOpen(true);
    }
  };

  return <Dialog open={open} onOpenChange={change}>
    <DialogTrigger asChild><button type="button" className="settings-button settings-button-danger" disabled={passwordEnabled === undefined || deleting}>Usuń konto</button></DialogTrigger>
    <DialogContent className="px-dialog px-panel" showCloseButton={!deleting}>
      <form className="grid gap-4" onSubmit={event => void submit(event)}>
        <DialogHeader>
          <DialogTitle>Usunąć konto na zawsze?</DialogTitle>
          <DialogDescription>Konto {username} zniknie od razu, razem z postępem, odznakami i znajomymi. Tego nie da się cofnąć.</DialogDescription>
        </DialogHeader>
        {passwordEnabled ? <div className="grid gap-2">
          <Label htmlFor={fieldId}>Obecne hasło</Label>
          <Input id={fieldId} type="password" autoComplete="current-password"
            value={value} disabled={deleting} aria-invalid={!!error || undefined} maxLength={256}
            onChange={event => { setValue(event.target.value); setError(''); }} />
        </div> : <p>Jeśli ostatnie logowanie było ponad 10 minut temu, wyślemy na Twój adres e-mail kod, którym potwierdzisz usunięcie.</p>}
        {error && <StatusMessage kind="error">{error}</StatusMessage>}
        <DialogFooter>
          <button type="button" className="px-button" disabled={deleting} onClick={() => change(false)}>Anuluj</button>
          <button type="submit" className="px-button px-button--danger" disabled={deleting || (passwordEnabled && !value)}>
            {deleting ? 'Usuwanie…' : 'Usuń konto na zawsze'}
          </button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
