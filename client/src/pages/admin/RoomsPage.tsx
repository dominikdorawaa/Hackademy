import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '../../context/AuthContext';
import * as adminApi from '../../services/adminApi';
import type { RoomAdminSummaryDto } from '../../types/api';
import { ConfirmAction, EmptyState, LoadingRows, PageHeader, StatusMessage } from '../../components/admin/AdminUi';
import { errorText, numberFormat } from '../../components/admin/adminFormat';
import { useAdminAccess } from './adminAccess';
import { roomsPath as base } from './adminConfig';

export default function RoomsPage() {
  const { sessionKey } = useAuth();
  const { isAdmin } = useAdminAccess();
  const [rooms, setRooms] = useState<RoomAdminSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = (await adminApi.getAllRoomsAdmin(sessionKey)) ?? [];
      setRooms(data);
      setError(null);
    } catch (err) {
      setError(errorText(err, 'Nie udało się pobrać pokoi.'));
    } finally {
      setLoading(false);
    }
  }, [sessionKey]);

  useEffect(() => {
    if (sessionKey) void load();
  }, [sessionKey, load]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rooms;
    return rooms.filter((room) => room.title.toLowerCase().includes(term) || (room.pathTitle ?? '').toLowerCase().includes(term));
  }, [rooms, query]);

  const remove = async (room: RoomAdminSummaryDto) => {
    setSuccess(null);
    try {
      await adminApi.deleteRoom(room.id, sessionKey);
      setRooms((current) => current.filter((entry) => entry.id !== room.id));
      setSuccess(`Pokój „${room.title}” został usunięty.`);
      setError(null);
    } catch (err) {
      setError(errorText(err, 'Nie udało się usunąć pokoju.'));
    }
  };

  return (
    <>
      <PageHeader
        title="Pokoje"
        description="Lekcje i zadania z flagą używane w ścieżkach nauki. Pokój należy do jednego rozdziału jednej ścieżki."
        actions={
          <Button asChild>
            <Link to={`${base}/new`}><Plus />Nowy pokój</Link>
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Szukaj pokoju"
            placeholder="Szukaj po tytule lub ścieżce…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
          />
        </div>
        {!loading && <p className="text-sm text-muted-foreground tabular-nums">{filtered.length} z {rooms.length}</p>}
      </div>
      <div className="mb-4 space-y-2">
        {error && <StatusMessage kind="error">{error}</StatusMessage>}
        {success && <StatusMessage kind="success">{success}</StatusMessage>}
      </div>
      {loading ? (
        <LoadingRows label="Ładowanie pokoi" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={query ? 'Brak pasujących pokoi' : 'Nie ma jeszcze pokoi.'}
          action={!query && <Button asChild variant="outline"><Link to={`${base}/new`}>Utwórz pierwszy pokój</Link></Button>}
        />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tytuł</TableHead>
                <TableHead className="hidden sm:table-cell">Ścieżka</TableHead>
                <TableHead className="hidden text-right md:table-cell">XP</TableHead>
                <TableHead className="hidden md:table-cell">VPN</TableHead>
                <TableHead className="text-right"><span className="sr-only">Akcje</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((room) => (
                <TableRow key={room.id}>
                  <TableCell className="font-medium">
                    <span className="mr-2 text-xs text-muted-foreground">{room.published === false ? 'Szkic' : 'Opublikowany'}</span>
                    <Link to={`${base}/${room.id}`} className="hover:text-primary hover:underline underline-offset-4">
                      {room.title}
                    </Link>
                    {room.roomType === 'CTF' && <Badge variant="outline" className="ml-2">CTF</Badge>}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {room.pathTitle ? (
                      <Link to={`/admin/paths/${room.pathId}`} className="text-muted-foreground hover:text-foreground hover:underline underline-offset-4">
                        {room.pathTitle}
                      </Link>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Bez ścieżki</Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">{numberFormat.format(room.points)}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {room.requiresVpn ? (
                      <span className="inline-flex items-center gap-1 text-sm"><Lock aria-hidden="true" className="size-3.5" />Wymaga</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Nie</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="icon-sm" aria-label={`Edytuj ${room.title}`}>
                        <Link to={`${base}/${room.id}`}><Pencil /></Link>
                      </Button>
                      {isAdmin && (
                        <ConfirmAction
                          title={`Usunąć pokój „${room.title}”?`}
                          description="Pokój, jego zadania, podpowiedzi, plik i postępy graczy zostaną trwale usunięte."
                          confirmLabel="Usuń pokój"
                          onConfirm={() => remove(room)}
                          trigger={
                            <Button variant="ghost" size="icon-sm" aria-label={`Usuń ${room.title}`} className="text-muted-foreground hover:text-destructive">
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
