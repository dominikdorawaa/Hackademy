import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useAuth } from '../../context/AuthContext';
import * as adminApi from '../../services/adminApi';
import type { RoomTaskAdminDto, RoomTasksAdminDto, RoomTaskRequest } from '../../types/api';
import { ConfirmAction, LoadingRows, Section, StatusMessage } from './AdminUi';
import { errorText, plural } from './adminFormat';

interface DraftTask {
  key: string;
  id: number | null;
  title: string;
  content: string;
  question: string;
  answer: string;
}

let draftCounter = 0;
const nextKey = () => `draft-${++draftCounter}`;

const toDraft = (task: RoomTaskAdminDto): DraftTask => ({
  key: `task-${task.id}`,
  id: task.id,
  title: task.title,
  content: task.content,
  question: task.question ?? '',
  answer: task.answer ?? '',
});

const toRequest = (task: DraftTask): RoomTaskRequest => ({
  id: task.id,
  title: task.title.trim(),
  content: task.content.trim(),
  question: task.question.trim() || null,
  answer: task.answer.trim() || null,
});

function taskProblems(task: DraftTask) {
  const problems: string[] = [];
  if (!task.title.trim()) problems.push('Podaj tytuł.');
  if (!task.content.trim()) problems.push('Podaj treść.');
  if (task.question.trim() && !task.answer.trim()) problems.push('Pytanie wymaga odpowiedzi.');
  if (!task.question.trim() && task.answer.trim()) problems.push('Odpowiedź wymaga pytania.');
  return problems;
}

export default function TasksEditor({ roomId }: { roomId: number }) {
  const { token } = useAuth();
  const [revision, setRevision] = useState(0);
  const [saved, setSaved] = useState<DraftTask[]>([]);
  const [tasks, setTasks] = useState<DraftTask[]>([]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showProblems, setShowProblems] = useState(false);
  const loadKey = `${roomId}:${token}`;
  const ready = loadedFor === loadKey;
  const editingDisabled = !ready || loading || saving;

  const apply = useCallback((data: RoomTasksAdminDto) => {
    const drafts = data.tasks.map(toDraft);
    setRevision(data.revision);
    setSaved(drafts);
    setTasks(drafts);
  }, []);

  useEffect(() => {
    setLoading(true);
    setLoadedFor(null);
    setError(null);
    setSuccess(null);
    if (!token) return;
    let active = true;
    adminApi.getRoomTasks(roomId, token)
      .then((data) => {
        if (!data || !Array.isArray(data.tasks) || !Number.isSafeInteger(data.revision)) throw new Error('Nie udało się pobrać zadań.');
        if (active) {
          apply(data);
          setLoadedFor(loadKey);
        }
      })
      .catch((err: unknown) => {
        if (active) setError(errorText(err, 'Nie udało się pobrać zadań.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [roomId, token, apply, loadKey, loadAttempt]);

  const dirty = useMemo(
    () => JSON.stringify(tasks.map(toRequest)) !== JSON.stringify(saved.map(toRequest)),
    [tasks, saved],
  );
  const invalid = tasks.some((task) => taskProblems(task).length > 0);

  const change = (key: string, field: keyof Omit<DraftTask, 'key' | 'id'>, value: string) => {
    if (editingDisabled) return;
    setTasks((current) => current.map((task) => (task.key === key ? { ...task, [field]: value } : task)));
    setSuccess(null);
  };

  const toggle = (key: string) => {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const add = () => {
    if (editingDisabled) return;
    const key = nextKey();
    setTasks((current) => [...current, { key, id: null, title: '', content: '', question: '', answer: '' }]);
    setOpen((current) => new Set(current).add(key));
    setSuccess(null);
  };

  const move = (index: number, offset: number) => {
    if (editingDisabled) return;
    setTasks((current) => {
      const target = index + offset;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSuccess(null);
  };

  const remove = (key: string) => {
    if (editingDisabled) return;
    setTasks((current) => current.filter((task) => task.key !== key));
    setSuccess(null);
  };

  const save = async () => {
    if (editingDisabled) return;
    setShowProblems(true);
    setSuccess(null);
    if (invalid) {
      setError('Popraw zaznaczone zadania przed zapisaniem.');
      return;
    }
    setSaving(true);
    try {
      const updated = await adminApi.updateRoomTasks(roomId, revision, tasks.map(toRequest), token);
      if (!updated || !Array.isArray(updated.tasks) || !Number.isSafeInteger(updated.revision)) throw new Error('Nie udało się zapisać zadań.');
      apply(updated);
      setOpen(new Set());
      setShowProblems(false);
      setError(null);
      setSuccess('Zapisano zadania.');
    } catch (err) {
      setError(errorText(err, 'Nie udało się zapisać zadań.'));
    } finally {
      setSaving(false);
    }
  };

  const reload = async () => {
    if (editingDisabled) return;
    setSaving(true);
    try {
      const latest = await adminApi.getRoomTasks(roomId, token);
      if (!latest || !Array.isArray(latest.tasks) || !Number.isSafeInteger(latest.revision)) {
        throw new Error('Nie udało się pobrać zadań.');
      }
      apply(latest);
      setOpen(new Set());
      setShowProblems(false);
      setError(null);
      setSuccess(null);
    } finally {
      setSaving(false);
    }
  };

  const removedCount = saved.filter((task) => !tasks.some((draft) => draft.id === task.id)).length;

  return (
    <Section
      title="Zadania"
      description="Gracz rozwiązuje zadania po kolei. Zmiany treści nie usuwają postępów w zachowanych zadaniach."
      actions={
        <>
          {ready && dirty && <Button variant="ghost" disabled={editingDisabled} onClick={() => { setTasks(saved); setShowProblems(false); setError(null); }}>Odrzuć zmiany</Button>}
          <Button onClick={() => void save()} disabled={editingDisabled || !dirty}>{saving ? 'Zapisywanie…' : 'Zapisz zadania'}</Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <>
          <StatusMessage kind="error">{error}</StatusMessage>
          {ready && <ConfirmAction
            trigger={<Button variant="outline" disabled={editingDisabled}>Wczytaj aktualne zadania</Button>}
            title="Wczytać aktualne zadania?"
            description="Niezapisane zmiany zostaną odrzucone."
            confirmLabel="Wczytaj zadania"
            onConfirm={reload}
          />}
        </>}
        {success && <StatusMessage kind="success">{success}</StatusMessage>}
        {ready && removedCount > 0 && (
          <StatusMessage kind="warning">
            Po zapisaniu zniknie {removedCount} {plural(removedCount, ['zadanie', 'zadania', 'zadań'])} razem z postępami graczy.
          </StatusMessage>
        )}
        {loading ? (
          <LoadingRows rows={3} label="Ładowanie zadań" />
        ) : !ready ? (
          <Button variant="outline" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Spróbuj ponownie</Button>
        ) : (
          <fieldset disabled={saving} className="min-w-0 space-y-3" aria-busy={saving}>
            {tasks.length === 0 && (
              <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                Pokój nie ma zadań. Gracz rozwiązuje go wtedy samą flagą.
              </p>
            )}
            <ol className="space-y-2">
              {tasks.map((task, index) => {
                const expanded = open.has(task.key);
                const problems = showProblems ? taskProblems(task) : [];
                const panelId = `${task.key}-panel`;
                return (
                  <li key={task.key} className={cn('rounded-lg border bg-background/40', problems.length > 0 && 'border-destructive/60')}>
                    <div className="flex items-center gap-2 px-3 py-2">
                      <span className="w-6 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">{index + 1}.</span>
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-1 text-left text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        aria-expanded={expanded}
                        aria-controls={panelId}
                        onClick={() => toggle(task.key)}
                      >
                        <span className={cn('truncate font-medium', !task.title.trim() && 'text-muted-foreground italic')}>
                          {task.title.trim() || 'Zadanie bez tytułu'}
                        </span>
                        {task.id === null && <Badge variant="secondary">Nowe</Badge>}
                        {task.question.trim() ? (
                          <Badge variant="outline" className="hidden text-muted-foreground sm:inline-flex">Z pytaniem</Badge>
                        ) : (
                          <Badge variant="outline" className="hidden text-muted-foreground sm:inline-flex">Lektura</Badge>
                        )}
                        <ChevronDown aria-hidden="true" className={cn('ml-auto size-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
                      </button>
                      <div className="flex shrink-0 items-center">
                        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Przesuń zadanie ${index + 1} w górę`} disabled={index === 0} onClick={() => move(index, -1)}>
                          <ArrowUp />
                        </Button>
                        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Przesuń zadanie ${index + 1} w dół`} disabled={index === tasks.length - 1} onClick={() => move(index, 1)}>
                          <ArrowDown />
                        </Button>
                        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Usuń zadanie ${index + 1}`} className="text-muted-foreground hover:text-destructive" onClick={() => remove(task.key)}>
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                    {expanded && (
                      <div id={panelId} className="grid gap-4 border-t px-4 py-4 md:grid-cols-2">
                        <div className="grid gap-2 md:col-span-2">
                          <Label htmlFor={`${task.key}-title`}>Tytuł zadania</Label>
                          <Input id={`${task.key}-title`} value={task.title} maxLength={255} onChange={(event) => change(task.key, 'title', event.target.value)} />
                        </div>
                        <div className="grid gap-2 md:col-span-2">
                          <Label htmlFor={`${task.key}-content`}>Treść</Label>
                          <Textarea id={`${task.key}-content`} value={task.content} className="min-h-28" onChange={(event) => change(task.key, 'content', event.target.value)} />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor={`${task.key}-question`}>Pytanie</Label>
                          <Input id={`${task.key}-question`} value={task.question} placeholder="Opcjonalne" onChange={(event) => change(task.key, 'question', event.target.value)} />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor={`${task.key}-answer`}>Odpowiedź</Label>
                          <Input
                            id={`${task.key}-answer`}
                            value={task.answer}
                            maxLength={255}
                            className="font-mono"
                            autoComplete="off"
                            spellCheck={false}
                            placeholder="Wymagana, gdy jest pytanie"
                            onChange={(event) => change(task.key, 'answer', event.target.value)}
                          />
                        </div>
                      </div>
                    )}
                    {problems.length > 0 && (
                      <p className="border-t border-destructive/30 px-4 py-2 text-sm text-destructive">{problems.join(' ')}</p>
                    )}
                  </li>
                );
              })}
            </ol>
            <Button type="button" variant="outline" onClick={add}><Plus />Dodaj zadanie</Button>
          </fieldset>
        )}
      </div>
    </Section>
  );
}
