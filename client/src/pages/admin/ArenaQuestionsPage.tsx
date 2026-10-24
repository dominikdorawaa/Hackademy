import { useCallback, useEffect, useRef, useState } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArenaDifficultyBadge, ConfirmAction, EmptyState, LoadingRows, PageHeader, StatusMessage } from '../../components/admin/AdminUi';
import { PageControls } from '../../components/admin/PageControls';
import { errorText } from '../../components/admin/adminFormat';
import { useAuth } from '../../context/AuthContext';
import * as adminApi from '../../services/adminApi';
import type { ArenaQuestionAdmin, ArenaQuestionCategory, ArenaQuestionDifficulty } from '../../types/api';
import ArenaQuestionDialog from './ArenaQuestionDialog';
import { arenaDifficultyLabels, categories, categoryLabels, difficulties } from './arenaQuestionForm';

const ALL = 'ALL';

function shorten(text: string, limit = 90) {
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

export default function ArenaQuestionsPage() {
  const { sessionKey } = useAuth();
  const [questions, setQuestions] = useState<ArenaQuestionAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ArenaQuestionCategory | ''>('');
  const [difficulty, setDifficulty] = useState<ArenaQuestionDifficulty | ''>('');
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [editing, setEditing] = useState<ArenaQuestionAdmin | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(query.trim()); setPage(0); }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => { setSuccess(null); }, [search, category, difficulty]);

  const load = useCallback(async () => {
    const generation = ++requestId.current;
    try {
      setLoading(true);
      const result = await adminApi.getArenaQuestionsPage(sessionKey, page, { query: search, category, difficulty });
      if (generation !== requestId.current) return;
      setQuestions(result.items);
      setHasNext(result.hasNext);
      setError(null);
    } catch (err) {
      if (generation !== requestId.current) return;
      setError(errorText(err, 'Nie udało się pobrać pytań.'));
    } finally {
      if (generation === requestId.current) setLoading(false);
    }
  }, [sessionKey, page, search, category, difficulty]);

  const cancelLoad = useCallback(() => { requestId.current++; }, []);
  useEffect(() => {
    if (sessionKey) void load();
    return cancelLoad;
  }, [sessionKey, load, cancelLoad]);

  const openEditor = (question: ArenaQuestionAdmin | null) => {
    setEditing(question);
    setEditorOpen(true);
    setSuccess(null);
  };

  const saved = (_question: ArenaQuestionAdmin, created: boolean) => {
    setEditorOpen(false);
    setSuccess(created ? 'Dodano pytanie do banku areny.' : 'Zapisano zmiany w pytaniu.');
    if (created && page !== 0) setPage(0); else void load();
  };

  const remove = async (question: ArenaQuestionAdmin) => {
    setSuccess(null);
    try {
      await adminApi.deleteArenaQuestion(question.id, sessionKey);
      setSuccess('Usunięto pytanie. Trwające pojedynki dokończą je bez zmian.');
      if (questions.length === 1 && page > 0) setPage(page - 1); else await load();
    } catch (err) {
      await load();
      setError(errorText(err, 'Nie udało się usunąć pytania.'));
    }
  };

  const filtered = !!(search || category || difficulty);

  return (
    <>
      <PageHeader
        title="Pytania areny"
        description="Bank pytań, z którego arena losuje rundy pojedynków. Pokoje CTF nie są źródłem tych pytań."
        actions={<Button onClick={() => openEditor(null)}><Plus />Dodaj pytanie</Button>}
      />
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative w-full md:max-w-xs">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Szukaj pytania"
            placeholder="Szukaj w treści i odpowiedziach…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
          />
        </div>
        <div className="grid gap-2 sm:flex">
          <Select value={category || ALL} onValueChange={(value) => { setCategory(value === ALL ? '' : value as ArenaQuestionCategory); setPage(0); }}>
            <SelectTrigger aria-label="Filtruj według kategorii" className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Wszystkie kategorie</SelectItem>
              {categories.map((entry) => <SelectItem key={entry} value={entry}>{categoryLabels[entry]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={difficulty || ALL} onValueChange={(value) => { setDifficulty(value === ALL ? '' : value as ArenaQuestionDifficulty); setPage(0); }}>
            <SelectTrigger aria-label="Filtruj według trudności" className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Każda trudność</SelectItem>
              {difficulties.map((entry) => <SelectItem key={entry} value={entry}>{arenaDifficultyLabels[entry]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="mb-4 space-y-2">
        {error && <StatusMessage kind="error">{error}</StatusMessage>}
        {success && <StatusMessage kind="success">{success}</StatusMessage>}
      </div>
      {loading ? (
        <LoadingRows label="Ładowanie pytań" />
      ) : questions.length === 0 ? (
        <EmptyState
          title={filtered ? 'Nie znaleziono pytań' : 'Bank pytań jest pusty'}
          description={filtered ? 'Zmień frazę lub filtry.' : 'Dodaj pierwsze pytanie, żeby arena mogła rozpocząć pojedynek.'}
        />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pytanie</TableHead>
                <TableHead className="hidden w-32 md:table-cell">Kategoria</TableHead>
                <TableHead className="hidden w-32 sm:table-cell">Trudność</TableHead>
                <TableHead className="w-24"><span className="sr-only">Akcje</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questions.map((question) => (
                <TableRow key={question.id}>
                  <TableCell className="max-w-0 whitespace-normal">
                    <p className="font-medium break-words text-foreground">{question.content}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      Poprawna: {shorten(question.correctAnswer)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1 md:hidden">
                      <Badge variant="secondary">{categoryLabels[question.category]}</Badge>
                      <span className="sm:hidden"><ArenaDifficultyBadge difficulty={question.difficulty} /></span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell"><Badge variant="secondary">{categoryLabels[question.category]}</Badge></TableCell>
                  <TableCell className="hidden sm:table-cell"><ArenaDifficultyBadge difficulty={question.difficulty} /></TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" aria-label={`Edytuj pytanie: ${shorten(question.content, 60)}`} onClick={() => openEditor(question)}>
                        <Pencil />
                      </Button>
                      <ConfirmAction
                        title="Usunąć to pytanie?"
                        description={`„${shorten(question.content, 140)}” zniknie z banku. Trwające pojedynki dokończą je bez zmian.`}
                        confirmLabel="Usuń pytanie"
                        onConfirm={() => remove(question)}
                        trigger={
                          <Button variant="ghost" size="icon-sm" aria-label={`Usuń pytanie: ${shorten(question.content, 60)}`} className="text-muted-foreground hover:text-destructive">
                            <Trash2 />
                          </Button>
                        }
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
      <ArenaQuestionDialog open={editorOpen} question={editing} onOpenChange={setEditorOpen} onSaved={saved} onFailed={() => void load()} />
    </>
  );
}
