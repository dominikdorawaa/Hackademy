import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageControls } from '../../components/admin/PageControls';
import { ConfirmAction, EmptyState, LoadingRows, PageHeader, StatusMessage } from '../../components/admin/AdminUi';
import { dateTimeFormat, errorText } from '../../components/admin/adminFormat';
import { useAuth } from '../../context/AuthContext';
import * as adminApi from '../../services/adminApi';
import type { BugReportAdmin, BugReportStatus } from '../../types/api';

const ALL = 'ALL';
const filters: [BugReportStatus | typeof ALL, string][] = [['OPEN', 'Otwarte'], ['RESOLVED', 'Rozwiązane'], [ALL, 'Wszystkie']];
const LOCAL_PAGE = /^\/(rooms\/\d+|arena(\/battle\/[A-Za-z0-9-]+)?)$/;

const emptyText: Record<BugReportStatus | typeof ALL, string> = {
  OPEN: 'Nic nie czeka na sprawdzenie.',
  RESOLVED: 'Nie ma jeszcze rozwiązanych zgłoszeń.',
  ALL: 'Gracze nie zgłosili jeszcze żadnego problemu.',
};

function Place({ report }: { report: BugReportAdmin }) {
  const where = report.source === 'ROOM'
    ? <>
        <span className="font-medium">Pokój: {report.roomTitle ?? 'usunięty'}</span>
        {report.taskTitle && <span className="text-muted-foreground">Zadanie: {report.taskTitle}</span>}
      </>
    : <>
        <span className="font-medium">Arena</span>
        {report.gameId && <span className="text-muted-foreground" title={report.gameId}>Mecz {report.gameId.slice(0, 8)}</span>}
      </>;
  return (
    <div className="flex flex-col gap-0.5">
      {where}
      {report.pagePath && (LOCAL_PAGE.test(report.pagePath)
        ? <Link className="w-fit text-xs text-primary underline-offset-4 hover:underline" to={report.pagePath}>{report.pagePath}</Link>
        : <span className="text-xs break-all text-muted-foreground">{report.pagePath}</span>)}
    </div>
  );
}

export default function BugReportsPage() {
  const { sessionKey } = useAuth();
  const [filter, setFilter] = useState<BugReportStatus | typeof ALL>('OPEN');
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [reports, setReports] = useState<BugReportAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const generation = ++requestId.current;
    try {
      setLoading(true);
      const result = await adminApi.getBugReportsPage(sessionKey, page, filter === ALL ? '' : filter);
      if (generation !== requestId.current) return;
      setReports(result.items);
      setHasNext(result.hasNext);
      setError(null);
    } catch (err) {
      if (generation !== requestId.current) return;
      setError(errorText(err, 'Nie udało się pobrać zgłoszeń.'));
    } finally {
      if (generation === requestId.current) setLoading(false);
    }
  }, [sessionKey, page, filter]);

  const cancelLoad = useCallback(() => { requestId.current++; }, []);
  useEffect(() => {
    if (sessionKey) void load();
    return cancelLoad;
  }, [sessionKey, load, cancelLoad]);

  const changeStatus = async (report: BugReportAdmin) => {
    const next: BugReportStatus = report.status === 'OPEN' ? 'RESOLVED' : 'OPEN';
    setPending(report.id);
    setSuccess(null);
    try {
      const updated = await adminApi.updateBugReportStatus(report.id, next, sessionKey);
      setReports((current) => filter === ALL
        ? current.map((item) => item.id === report.id ? updated ?? { ...item, status: next } : item)
        : current.filter((item) => item.id !== report.id));
      setSuccess(next === 'RESOLVED' ? 'Zgłoszenie oznaczone jako rozwiązane.' : 'Zgłoszenie jest znowu otwarte.');
      setError(null);
    } catch (err) {
      setError(errorText(err, 'Nie udało się zmienić statusu zgłoszenia.'));
    } finally {
      setPending(null);
    }
  };

  const remove = async (report: BugReportAdmin) => {
    setSuccess(null);
    await adminApi.deleteBugReport(report.id, sessionKey);
    setReports((current) => current.filter((item) => item.id !== report.id));
    setSuccess('Zgłoszenie usunięte.');
    setError(null);
  };

  return (
    <>
      <PageHeader title="Zgłoszenia błędów" description="Problemy, które gracze zgłosili z pokojów i z areny." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={filter} onValueChange={(value) => { setFilter(value as BugReportStatus | typeof ALL); setPage(0); setSuccess(null); }}>
          <SelectTrigger aria-label="Filtruj według statusu" className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {filters.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="mb-4 space-y-2">
        {error && <StatusMessage kind="error">{error}</StatusMessage>}
        {success && <StatusMessage kind="success">{success}</StatusMessage>}
      </div>
      {loading ? (
        <LoadingRows label="Ładowanie zgłoszeń" />
      ) : reports.length === 0 ? (
        <EmptyState title="Brak zgłoszeń" description={emptyText[filter]} />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Opis</TableHead>
                <TableHead className="hidden md:table-cell">Miejsce</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell className="max-w-xl align-top whitespace-normal">
                    <p className="break-words whitespace-pre-wrap">{report.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                      {report.reporterUsername}, {dateTimeFormat.format(new Date(report.createdAt))}
                    </p>
                    <div className="mt-2 md:hidden"><Place report={report} /></div>
                  </TableCell>
                  <TableCell className="hidden align-top whitespace-normal md:table-cell"><Place report={report} /></TableCell>
                  <TableCell className="align-top">
                    <Badge variant={report.status === 'OPEN' ? 'default' : 'secondary'}>{report.status === 'OPEN' ? 'Otwarte' : 'Rozwiązane'}</Badge>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button variant="outline" size="sm" disabled={pending === report.id} onClick={() => void changeStatus(report)}>
                        {report.status === 'OPEN' ? 'Oznacz jako rozwiązane' : 'Otwórz ponownie'}
                      </Button>
                      <ConfirmAction
                        title="Usunąć zgłoszenie?"
                        description="Zgłoszenie zniknie z listy na stałe. Jeśli problem jest naprawiony, wystarczy oznaczyć je jako rozwiązane."
                        confirmLabel="Usuń zgłoszenie"
                        onConfirm={() => remove(report)}
                        trigger={<Button variant="destructive" size="sm" disabled={pending === report.id}>Usuń</Button>}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <PageControls page={page} hasNext={hasNext} loading={loading} onPage={setPage} />
    </>
  );
}
