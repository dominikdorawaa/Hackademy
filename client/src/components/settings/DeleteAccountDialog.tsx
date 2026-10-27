import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { StatusMessage } from '../common/StatusMessage';
import { errorText } from '../../lib/errorText';
import type { AccountDeletionConfirmation } from '../../services/userApi';

export function DeleteAccountDialog({ username, passwordEnabled, onDelete }: {
  username: string;
  passwordEnabled: boolean;
  onDelete: (confirmation: AccountDeletionConfirmation) => Promise<void>;
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
    if (!value || deleting) return;
    setDeleting(true);
    setError('');
    try {
      await onDelete(passwordEnabled ? { password: value } : { confirmation: value });
    } catch (failure) {
      setError(errorText(failure, 'Nie udało się usunąć konta. Spróbuj ponownie.'));
      setDeleting(false);
    }
  };

  return <Dialog open={open} onOpenChange={change}>
    <DialogTrigger asChild><button type="button" className="settings-button settings-button-danger">Usuń konto</button></DialogTrigger>
    <DialogContent className="px-dialog px-panel" showCloseButton={!deleting}>
      <form className="grid gap-4" onSubmit={event => void submit(event)}>
        <DialogHeader>
          <DialogTitle>Usunąć konto na zawsze?</DialogTitle>
          <DialogDescription>Konto {username} zniknie od razu, razem z postępem, odznakami i znajomymi. Tego nie da się cofnąć.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor={fieldId}>{passwordEnabled ? 'Obecne hasło' : `Wpisz nazwę użytkownika: ${username}`}</Label>
          <Input id={fieldId} type={passwordEnabled ? 'password' : 'text'} autoComplete={passwordEnabled ? 'current-password' : 'off'}
            value={value} disabled={deleting} aria-invalid={!!error || undefined} maxLength={passwordEnabled ? 256 : 64}
            onChange={event => { setValue(event.target.value); setError(''); }} />
        </div>
        {error && <StatusMessage kind="error">{error}</StatusMessage>}
        <DialogFooter>
          <button type="button" className="px-button" disabled={deleting} onClick={() => change(false)}>Anuluj</button>
          <button type="submit" className="px-button px-button--danger" disabled={deleting || !value}>
            {deleting ? 'Usuwanie…' : 'Usuń konto na zawsze'}
          </button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
