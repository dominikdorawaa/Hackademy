import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '../../context/AuthContext';
import * as adminApi from '../../services/adminApi';
import type { PathSummaryDto } from '../../types/api';
import { ConfirmAction, EmptyState, LoadingRows, PageHeader, StatusMessage } from '../../components/admin/AdminUi';
import { errorText, numberFormat, plural } from '../../components/admin/adminFormat';
import { useAdminAccess } from './adminAccess';
import PathImportDialog from './PathImportDialog';

export default function PathsPage() {
  const { token } = useAuth();
  const { isAdmin } = useAdminAccess();
  const [paths, setPaths] = useState<PathSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPaths((await adminApi.getPaths(token)) ?? []);
      setError(null);
    } catch (err) {
      setError(errorText(err, 'Nie udało się pobrać ścieżek.'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  const remove = async (path: PathSummaryDto) => {
    setSuccess(null);
    try {
      await adminApi.deletePath(path.id, token);
      setPaths((current) => current.filter((entry) => entry.id !== path.id));
      setSuccess(`Ścieżka „${path.title}” została usunięta. Jej pokoje wróciły do puli.`);
      setError(null);
    } catch (err) {
      setError(errorText(err, 'Nie udało się usunąć ścieżki.'));
    }
  };

  return (
    <>
      <PageHeader
        title="Ścieżki"
        description="Ścieżka składa się z rozdziałów, a rozdział z pokoi. Kolejność ustawiasz w edytorze ścieżki."
        actions={<>{isAdmin && <PathImportDialog />}<Button asChild><Link to="/admin/paths/new"><Plus />Nowa ścieżka</Link></Button></>}
      />
      <div className="mb-4 space-y-2">
        {error && <StatusMessage kind="error">{error}</StatusMessage>}
        {success && <StatusMessage kind="success">{success}</StatusMessage>}
      </div>
      {loading ? (
        <LoadingRows label="Ładowanie ścieżek" />
      ) : paths.length === 0 ? (
        <EmptyState title="Nie ma jeszcze ścieżek" description="Utwórz pierwszą ścieżkę i dodaj do niej pokoje." />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tytuł</TableHead>
                <TableHead className="hidden md:table-cell">Opis</TableHead>
                <TableHead className="text-right">Pokoje</TableHead>
                <TableHead className="text-right"><span className="sr-only">Akcje</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paths.map((path) => (
                <TableRow key={path.id}>
                  <TableCell className="font-medium">
                    <Link to={`/admin/paths/${path.id}`} className="hover:text-primary hover:underline underline-offset-4">{path.title}</Link><span className="ml-2 text-xs text-muted-foreground">{path.published === false ? 'Szkic' : 'Opublikowany'}</span>
                  </TableCell>
                  <TableCell className="hidden max-w-sm truncate text-muted-foreground md:table-cell">{path.description || 'Bez opisu'}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {numberFormat.format(path.roomsCount)} <span className="sr-only">{plural(path.roomsCount, ['pokój', 'pokoje', 'pokoi'])}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="icon-sm" aria-label={`Edytuj ${path.title}`}>
                        <Link to={`/admin/paths/${path.id}`}><Pencil /></Link>
                      </Button>
                      {isAdmin && (
                        <ConfirmAction
                          title={`Usunąć ścieżkę „${path.title}”?`}
                          description="Rozdziały i zapisy graczy zostaną usunięte. Pokoje zostaną, ale nie będą przypisane do żadnej ścieżki."
                          confirmLabel="Usuń ścieżkę"
                          onConfirm={() => remove(path)}
                          trigger={
                            <Button variant="ghost" size="icon-sm" aria-label={`Usuń ${path.title}`} className="text-muted-foreground hover:text-destructive">
                              <Trash2 />
                            </Button>
                          }
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
