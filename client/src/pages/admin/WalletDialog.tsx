import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusMessage } from '../../components/admin/AdminUi';
import { dateTimeFormat } from '../../components/admin/adminFormat';
import { useAuth } from '../../context/AuthContext';
import { adjustWallet, errorMessage, getWallet } from '../../services/shopApi';
import { formatBytes } from '../../lib/bytes';
import type { UserAdminView, WalletAdmin, WalletTransaction } from '../../types/api';

const MAX_AMOUNT = 1_000_000;

export function transactionLabel(transaction: WalletTransaction) {
  if (transaction.kind === 'PURCHASE') return `Zakup: ${transaction.itemId ?? 'przedmiot'}`;
  if (transaction.kind === 'TOP_UP') return `Doładowanie${transaction.orderId ? ` #${transaction.orderId}` : ''}`;
  return `${transaction.adminUsername ?? 'Administrator'}: ${transaction.reason ?? ''}`;
}

export function WalletDialog({ user, onClose }: { user: UserAdminView | null; onClose: () => void }) {
  const { sessionKey } = useAuth();
  const [wallet, setWallet] = useState<{ userId: number; data: WalletAdmin | null; error: string | null }>({ userId: 0, data: null, error: null });
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const userId = user?.id ?? null;
  const current = wallet.userId === userId ? wallet : { userId: userId ?? 0, data: null, error: null };

  useEffect(() => {
    if (userId === null) return;
    let active = true;
    getWallet(userId, { sessionKey }).then(async response => {
      if (!active) return;
      if (!response.ok) { setWallet({ userId, data: null, error: await errorMessage(response, 'Nie udało się pobrać portfela.') }); return; }
      const data = await response.json();
      if (active) setWallet({ userId, data, error: null });
    }).catch(() => { if (active) setWallet({ userId, data: null, error: 'Nie udało się połączyć z serwerem.' }); });
    return () => { active = false; };
  }, [userId, sessionKey]);

  const close = () => { setAmount(''); setReason(''); setFormError(null); onClose(); };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (userId === null) return;
    const value = Number(amount);
    if (!Number.isInteger(value) || value === 0 || Math.abs(value) > MAX_AMOUNT) { setFormError(`Podaj liczbę całkowitą różną od zera, najwyżej ${MAX_AMOUNT.toLocaleString('pl-PL')}.`); return; }
    if (!reason.trim()) { setFormError('Podaj powód.'); return; }
    setSaving(true);
    setFormError(null);
    try {
      const response = await adjustWallet(userId, value, reason.trim(), { sessionKey });
      if (!response.ok) { setFormError(await errorMessage(response, 'Nie udało się zmienić salda.')); return; }
      setWallet({ userId, data: await response.json(), error: null });
      setAmount('');
      setReason('');
    } catch {
      setFormError('Nie udało się połączyć z serwerem.');
    } finally {
      setSaving(false);
    }
  };

  return <Dialog open={user !== null} onOpenChange={open => { if (!open) close(); }}>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Bajty: {user?.username}</DialogTitle>
        <DialogDescription>
          {current.data ? `Saldo: ${formatBytes(current.data.balance)}.` : 'Wczytuję saldo…'} Każda zmiana trafia do historii razem z powodem.
        </DialogDescription>
      </DialogHeader>
      {current.error && <StatusMessage kind="error">{current.error}</StatusMessage>}
      <form className="grid gap-3" onSubmit={submit} noValidate>
        <div className="grid gap-1">
          <Label htmlFor="wallet-amount">Liczba Bajtów</Label>
          <Input id="wallet-amount" type="number" inputMode="numeric" step={1} value={amount} onChange={event => setAmount(event.target.value)}
            aria-describedby="wallet-amount-hint" placeholder="np. 500 albo -100" />
          <p id="wallet-amount-hint" className="text-xs text-muted-foreground">Liczba dodatnia dodaje Bajty, ujemna je odejmuje.</p>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="wallet-reason">Powód</Label>
          <Input id="wallet-reason" value={reason} maxLength={200} onChange={event => setReason(event.target.value)} placeholder="np. Nagroda za turniej" />
        </div>
        {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={close}>Zamknij</Button>
          <Button type="submit" disabled={saving || !current.data}>{saving ? 'Zapisuję…' : 'Zmień saldo'}</Button>
        </div>
      </form>
      {current.data && <section aria-label="Historia portfela" className="grid gap-2">
        <h3 className="text-sm font-semibold">Historia</h3>
        {current.data.transactions.length === 0 ? <p className="text-sm text-muted-foreground">Brak operacji.</p>
          : <ul className="grid max-h-64 gap-1 overflow-y-auto text-sm">
            {current.data.transactions.map(transaction => <li key={transaction.id} className="flex items-baseline justify-between gap-3 rounded-md border px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate">{transactionLabel(transaction)}</span>
                <span className="text-xs text-muted-foreground">{dateTimeFormat.format(new Date(transaction.createdAt))}</span>
              </span>
              <span className={`shrink-0 font-mono tabular-nums ${transaction.amount > 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                {transaction.amount > 0 ? '+' : ''}{transaction.amount.toLocaleString('pl-PL')}
              </span>
            </li>)}
          </ul>}
      </section>}
    </DialogContent>
  </Dialog>;
}
