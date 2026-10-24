import { useCallback, useEffect, useId, useState } from 'react';
import { Bug } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StatusMessage } from '../common/StatusMessage';
import ToastNotification from '../common/ToastNotification';
import { useAuth } from '../../context/AuthContext';
import { submitBugReport } from '../../services/bugReportApi';
import { TOO_MANY_REQUESTS, readRetryAfter } from '../../services/rateLimit';
import type { BugReportRequest } from '../../types/api';
import './BugReportButton.css';

export const MIN_LENGTH = 10;
export const MAX_LENGTH = 2000;
const SENT = 'Dziękujemy! Zgłoszenie trafiło do zespołu.';

export const reportLength = (text: string) => [...text.trim()].length;

export function waitText(seconds: number) {
  return seconds < 60 ? `${seconds} s` : `${Math.ceil(seconds / 60)} min`;
}

type Context = Omit<BugReportRequest, 'description' | 'pagePath'>;

export function BugReportButton({ context, className }: { context: Context; className?: string }) {
  const { sessionKey } = useAuth();
  const { pathname } = useLocation();
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [sent, setSent] = useState(false);
  const hideSent = useCallback(() => setSent(false), []);

  useEffect(() => {
    if (blockedUntil === null) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= blockedUntil) setBlockedUntil(null);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [blockedUntil]);

  const length = reportLength(text);
  const wait = blockedUntil === null ? 0 : Math.max(1, Math.ceil((blockedUntil - now) / 1000));
  const tooShort = length < MIN_LENGTH;
  const tooLong = length > MAX_LENGTH;

  const send = async () => {
    if (sending || tooShort || tooLong || blockedUntil !== null) return;
    setSending(true);
    setError(null);
    try {
      const response = await submitBugReport({ ...context, pagePath: pathname, description: text.trim() }, { sessionKey });
      if (response.ok) {
        setText('');
        setOpen(false);
        setSent(true);
      } else if (response.status === TOO_MANY_REQUESTS) {
        const seconds = await readRetryAfter(response);
        const current = Date.now();
        setNow(current);
        setBlockedUntil(current + seconds * 1000);
      } else {
        const body = await response.json().catch(() => null);
        setError(body?.message ?? 'Nie udało się wysłać zgłoszenia. Spróbuj ponownie.');
      }
    } catch {
      setError('Błąd sieci. Spróbuj jeszcze raz.');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => { if (!sending) { setOpen(next); setError(null); } }}>
        <DialogTrigger asChild>
          <button type="button" className={`bug-report-trigger${className ? ` ${className}` : ''}`} aria-label="Zgłoś błąd">
            <Bug aria-hidden="true" />
            <span>Zgłoś błąd</span>
          </button>
        </DialogTrigger>
        <DialogContent>
          <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); void send(); }}>
            <DialogHeader>
              <DialogTitle>Zgłoś błąd</DialogTitle>
              <DialogDescription>Opisz, co się stało i co robiłeś tuż przed tym. Zgłoszenie trafi do zespołu Hackademy.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor={fieldId}>Opis problemu</Label>
              <Textarea id={fieldId} rows={6} value={text} disabled={sending} aria-invalid={tooLong || undefined}
                aria-describedby={`${fieldId}-count`} className="max-h-72"
                placeholder="Na przykład: po wpisaniu poprawnej flagi strona pokazała błąd."
                onChange={(event) => setText(event.target.value)} />
              <p id={`${fieldId}-count`} className={`text-right text-xs tabular-nums ${tooLong ? 'text-destructive' : 'text-muted-foreground'}`}>
                {length < MIN_LENGTH ? `Jeszcze co najmniej ${MIN_LENGTH - length} zn. · ` : ''}{length} / {MAX_LENGTH}
              </p>
            </div>
            {blockedUntil !== null && <StatusMessage kind="warning">Kolejne zgłoszenie możesz wysłać za {waitText(wait)}.</StatusMessage>}
            {error && <StatusMessage kind="error">{error}</StatusMessage>}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={sending} onClick={() => setOpen(false)}>Anuluj</Button>
              <Button type="submit" disabled={sending || tooShort || tooLong || blockedUntil !== null}>
                {sending ? 'Wysyłanie…' : 'Wyślij zgłoszenie'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {sent && <ToastNotification message={SENT} onClose={hideSent} />}
    </>
  );
}
