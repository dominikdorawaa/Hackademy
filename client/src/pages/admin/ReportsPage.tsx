import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '../../context/AuthContext';
import * as adminApi from '../../services/adminApi';
import type { ChatMessage } from '../../types/api';
import { ConfirmAction, EmptyState, LoadingRows, PageHeader, StatusMessage } from '../../components/admin/AdminUi';
import { dateTimeFormat, errorText } from '../../components/admin/adminFormat';

const muteDurations: [number, string][] = [
  [3600, '1 godzina'],
  [10800, '3 godziny'],
  [43200, '12 godzin'],
  [86400, '24 godziny'],
  [259200, '3 dni'],
  [604800, '7 dni'],
  [2592000, '1 miesiąc'],
  [7776000, '3 miesiące'],
  [15552000, '6 miesięcy'],
  [31536000, '1 rok'],
  [-1, 'Na stałe'],
];

export default function ReportsPage() {
  const { token } = useAuth();
  const [reports, setReports] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [muteTarget, setMuteTarget] = useState<ChatMessage | null>(null);
  const [muteDuration, setMuteDuration] = useState('3600');
  const [muting, setMuting] = useState(false);

  const load = useCallback(async () => {
    try {
      setReports((await adminApi.getReports(token)) ?? []);
      setError(null);
    } catch (err) {
      setError(errorText(err, 'Nie udało się pobrać zgłoszeń.'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  const removeFromList = (id: number) => setReports((current) => current.filter((report) => report.id !== id));

  const run = async (action: () => Promise<unknown>, id: number, message: string, failure: string) => {
    setSuccess(null);
    try {
      await action();
      removeFromList(id);
      setSuccess(message);
      setError(null);
    } catch (err) {
      setError(errorText(err, failure));
    }
  };

  const mute = async () => {
    if (!muteTarget) return;
    setMuting(true);
    await run(
      () => adminApi.muteUser(muteTarget.senderId, Number(muteDuration), token),
      muteTarget.id,
      `Użytkownik ${muteTarget.senderUsername} został wyciszony.`,
      'Nie udało się wyciszyć użytkownika.',
    );
    setMuting(false);
    setMuteTarget(null);
  };

  return (
    <>
      <PageHeader title="Zgłoszenia" description="Wiadomości z czatu areny zgłoszone przez graczy." />
      <div className="mb-4 space-y-2">
        {error && <StatusMessage kind="error">{error}</StatusMessage>}
        {success && <StatusMessage kind="success">{success}</StatusMessage>}
      </div>
      {loading ? (
        <LoadingRows label="Ładowanie zgłoszeń" />
      ) : reports.length === 0 ? (
        <EmptyState title="Brak zgłoszeń" description="Nowe zgłoszenia z czatu areny pojawią się tutaj." />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nadawca</TableHead>
                <TableHead>Treść</TableHead>
                <TableHead className="hidden md:table-cell">Wysłano</TableHead>
                <TableHead className="text-right">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell className="align-top font-medium">{report.senderUsername}</TableCell>
                  <TableCell className="max-w-md align-top whitespace-normal break-words">{report.content}</TableCell>
                  <TableCell className="hidden align-top text-muted-foreground tabular-nums md:table-cell">
                    {dateTimeFormat.format(new Date(report.timestamp))}
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void run(() => adminApi.dismissReport(report.id, token), report.id, 'Zgłoszenie odrzucone.', 'Nie udało się odrzucić zgłoszenia.')}
                      >
                        Odrzuć
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setMuteTarget(report)}>
                        Wycisz
                      </Button>
                      <ConfirmAction
                        title="Usunąć wiadomość?"
                        description="Wiadomość zniknie z czatu i z listy zgłoszeń."
                        confirmLabel="Usuń wiadomość"
                        onConfirm={() => run(() => adminApi.deleteReport(report.id, token), report.id, 'Wiadomość usunięta.', 'Nie udało się usunąć wiadomości.')}
                        trigger={<Button variant="destructive" size="sm">Usuń</Button>}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={muteTarget !== null} onOpenChange={(open) => !open && setMuteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Wycisz {muteTarget?.senderUsername}</DialogTitle>
            <DialogDescription>
              Użytkownik nie będzie mógł pisać na czacie przez wybrany czas. Zgłoszenie zniknie z listy.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="mute-duration">Czas wyciszenia</Label>
            <Select value={muteDuration} onValueChange={setMuteDuration}>
              <SelectTrigger id="mute-duration" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {muteDurations.map(([seconds, label]) => (
                  <SelectItem key={seconds} value={String(seconds)}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMuteTarget(null)}>Anuluj</Button>
            <Button onClick={() => void mute()} disabled={muting}>{muting ? 'Wyciszanie…' : 'Wycisz'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
