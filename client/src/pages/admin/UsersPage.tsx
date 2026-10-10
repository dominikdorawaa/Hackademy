import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '../../context/AuthContext';
import * as adminApi from '../../services/adminApi';
import type { Role, UserAdminView } from '../../types/api';
import { ConfirmAction, EmptyState, LoadingRows, PageHeader, StatusMessage } from '../../components/admin/AdminUi';
import { dateFormat, errorText } from '../../components/admin/adminFormat';

const roleLabels: Record<Role, string> = { USER: 'Użytkownik', EXPERT: 'Ekspert', ADMIN: 'Administrator' };

export default function UsersPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState<UserAdminView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setUsers((await adminApi.getUsers(token)) ?? []);
      setError(null);
    } catch (err) {
      setError(errorText(err, 'Nie udało się pobrać użytkowników.'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? users.filter((user) => user.username.toLowerCase().includes(term)) : users;
  }, [users, query]);

  const changeRole = async (userId: number, role: Role) => {
    try {
      await adminApi.updateUserRole(userId, role, token);
      await load();
    } catch (err) {
      setError(errorText(err, 'Nie udało się zmienić roli.'));
    }
  };

  const remove = async (userId: number) => {
    try {
      await adminApi.deleteUser(userId, token);
      setUsers((current) => current.filter((user) => user.id !== userId));
    } catch (err) {
      setError(errorText(err, 'Nie udało się usunąć użytkownika.'));
    }
  };

  return (
    <>
      <PageHeader title="Użytkownicy" description="Zmieniaj role i usuwaj konta. Zmiana roli działa od razu." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Szukaj użytkownika"
            placeholder="Szukaj po nazwie…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
          />
        </div>
        {!loading && <p className="text-sm text-muted-foreground tabular-nums">{filtered.length} z {users.length}</p>}
      </div>
      {error && <div className="mb-4"><StatusMessage kind="error">{error}</StatusMessage></div>}
      {loading ? (
        <LoadingRows label="Ładowanie użytkowników" />
      ) : filtered.length === 0 ? (
        <EmptyState title="Nie znaleziono użytkowników" description={query ? 'Zmień frazę wyszukiwania.' : undefined} />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">ID</TableHead>
                <TableHead>Nazwa</TableHead>
                <TableHead className="hidden md:table-cell">E-mail</TableHead>
                <TableHead className="w-44">Rola</TableHead>
                <TableHead className="hidden lg:table-cell">Dołączył</TableHead>
                <TableHead className="w-12"><span className="sr-only">Akcje</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">{user.id}</TableCell>
                  <TableCell className="font-medium">{user.username}</TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{user.email}</TableCell>
                  <TableCell>
                    <Select value={user.role} onValueChange={(value) => void changeRole(user.id, value as Role)}>
                      <SelectTrigger size="sm" aria-label={`Rola użytkownika ${user.username}`} className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(roleLabels) as Role[]).map((role) => (
                          <SelectItem key={role} value={role}>{roleLabels[role]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground tabular-nums lg:table-cell">
                    {dateFormat.format(new Date(user.createdAt))}
                  </TableCell>
                  <TableCell className="text-right">
                    <ConfirmAction
                      title={`Usunąć konto ${user.username}?`}
                      description="Konto, postępy i wiadomości użytkownika zostaną trwale usunięte."
                      confirmLabel="Usuń konto"
                      onConfirm={() => remove(user.id)}
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label={`Usuń ${user.username}`} className="text-muted-foreground hover:text-destructive">
                          <Trash2 />
                        </Button>
                      }
                    />
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
