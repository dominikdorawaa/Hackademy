import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '../../context/AuthContext';
import * as adminApi from '../../services/adminApi';
import type { PathSummaryDto } from '../../types/api';
import { ConfirmAction, EmptyState, LoadingRows, PageHeader, StatusMessage } from '../../components/admin/AdminUi';
import { errorText, numberFormat, plural } from '../../components/admin/adminFormat';
import { useAdminAccess } from './adminAccess';

function CreatePathDialog() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await adminApi.createPath({ title: title.trim(), description, bannerUrl: null, roomIds: [] }, token);
      if (created) {
        navigate(`/admin/paths/${created.id}`, { state: { flash: 'Ścieżka utworzona. Dodaj rozdziały i pokoje.' } });
      }
    } catch (err) {
      setError(errorText(err, 'Nie udało się utworzyć ścieżki.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus />Nowa ścieżka</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Nowa ścieżka</DialogTitle>
            <DialogDescription>Ścieżka startuje z jednym rozdziałem. Pokoje dodasz w edytorze.</DialogDescription>
          </DialogHeader>
          {error && <StatusMessage kind="error">{error}</StatusMessage>}
          <div className="grid gap-2">
            <Label htmlFor="new-path-title">Tytuł</Label>
            <Input id="new-path-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-path-description">Opis</Label>
            <Textarea id="new-path-description" value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Anuluj</Button>
            <Button type="submit" disabled={saving || !title.trim()}>{saving ? 'Tworzenie…' : 'Utwórz ścieżkę'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
        actions={<CreatePathDialog />}
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
                    <Link to={`/admin/paths/${path.id}`} className="hover:text-primary hover:underline underline-offset-4">{path.title}</Link>
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
