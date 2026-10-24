import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { StatusMessage } from '../../components/admin/AdminUi';
import { TextField, type FieldErrors } from '../../components/admin/ContentFields';
import { errorText } from '../../components/admin/adminFormat';
import { useAuth } from '../../context/AuthContext';
import * as adminApi from '../../services/adminApi';
import type { ArenaQuestionAdmin, ArenaQuestionCategory, ArenaQuestionDifficulty } from '../../types/api';
import {
  ANSWER_LIMIT,
  CONTENT_LIMIT,
  arenaDifficultyLabels,
  categories,
  categoryLabels,
  difficulties,
  formFor,
  requestFrom,
  validateQuestion,
  type QuestionForm,
} from './arenaQuestionForm';

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <p id={id} role="alert" className="text-sm text-destructive">{message}</p> : null;
}

function AnswerField({ id, label, correct, value, error, onChange }: {
  id: string;
  label: string;
  correct: boolean;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const Icon = correct ? Check : X;
  return (
    <div className="grid gap-1">
      <div
        data-correct={correct}
        className={cn(
          'flex min-w-0 items-center gap-3 rounded-lg border px-3 py-2 transition-colors',
          correct ? 'border-emerald-500/60 bg-emerald-500/10' : 'bg-background/40',
        )}
      >
        <Icon aria-hidden="true" className={cn('size-4 shrink-0', correct ? 'text-emerald-500' : 'text-muted-foreground')} />
        <span aria-hidden="true" className="w-20 shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
        <Input
          id={id}
          aria-label={label}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          value={value}
          className="h-8 min-w-0 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0 dark:bg-transparent"
          onChange={(event) => onChange(event.target.value)}
        />
        <span className={cn('shrink-0 text-xs tabular-nums', value.length > ANSWER_LIMIT ? 'text-destructive' : 'text-muted-foreground')}>
          {value.length}/{ANSWER_LIMIT}
        </span>
      </div>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

function QuestionEditor({ question, onCancel, onSaved, onFailed }: {
  question: ArenaQuestionAdmin | null;
  onCancel: () => void;
  onSaved: (saved: ArenaQuestionAdmin, created: boolean) => void;
  onFailed: () => void;
}) {
  const { sessionKey } = useAuth();
  const [form, setForm] = useState<QuestionForm>(() => formFor(question));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const change = (patch: Partial<QuestionForm>, ...fields: string[]) => {
    setForm((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next = { ...current };
      fields.forEach((field) => delete next[field]);
      return next;
    });
  };

  const submit = async () => {
    const problems = validateQuestion(form);
    setErrors(problems);
    setFailure(null);
    if (Object.keys(problems).length > 0) {
      const first = Object.keys(problems)[0];
      const target = first === 'answers' ? 'correctAnswer' : first;
      document.getElementById(target === 'content' ? 'content-content' : `question-${target}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      const saved = question
        ? await adminApi.updateArenaQuestion(question.id, requestFrom(form, question.version), sessionKey)
        : await adminApi.createArenaQuestion(requestFrom(form), sessionKey);
      if (saved) onSaved(saved, !question);
    } catch (err) {
      setFailure(errorText(err, 'Nie udało się zapisać pytania.'));
      onFailed();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      aria-label="Edytor pytania"
      aria-busy={busy}
      noValidate
      className="grid min-w-0 gap-5"
      onSubmit={(event) => { event.preventDefault(); void submit(); }}
    >
      <TextField
        name="content"
        label="Treść pytania"
        value={form.content}
        limit={CONTENT_LIMIT}
        required
        multiline
        error={errors.content}
        onChange={(content) => change({ content }, 'content')}
      />

      <fieldset className="grid min-w-0 gap-2" aria-describedby="question-answers-help">
        <legend className="mb-2 text-sm font-medium">Odpowiedzi *</legend>
        <p id="question-answers-help" className="-mt-1 mb-1 text-xs text-muted-foreground">
          Wpisz jedną poprawną i trzy błędne odpowiedzi. Arena losuje ich kolejność w każdym pojedynku.
        </p>
        <AnswerField
          id="question-correctAnswer"
          label="Poprawna"
          correct
          value={form.correctAnswer}
          error={errors.correctAnswer ?? (form.correctAnswer.length > ANSWER_LIMIT ? `Maksymalnie ${ANSWER_LIMIT} znaków` : undefined)}
          onChange={(correctAnswer) => change({ correctAnswer }, 'correctAnswer', 'answers')}
        />
        {form.wrongAnswers.map((answer, index) => (
          <AnswerField
            key={index}
            id={`question-wrong-${index}`}
            label={`Błędna ${index + 1}`}
            correct={false}
            value={answer}
            error={errors[`wrong-${index}`] ?? (answer.length > ANSWER_LIMIT ? `Maksymalnie ${ANSWER_LIMIT} znaków` : undefined)}
            onChange={(value) => {
              const wrongAnswers = [...form.wrongAnswers];
              wrongAnswers[index] = value;
              change({ wrongAnswers }, `wrong-${index}`, 'answers');
            }}
          />
        ))}
        <FieldError id="question-answers-error" message={errors.answers} />
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="question-category">Kategoria *</Label>
          <Select value={form.category} onValueChange={(value) => change({ category: value as ArenaQuestionCategory }, 'category')}>
            <SelectTrigger id="question-category" className="w-full" aria-invalid={!!errors.category}>
              <SelectValue placeholder="Wybierz kategorię" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => <SelectItem key={category} value={category}>{categoryLabels[category]}</SelectItem>)}
            </SelectContent>
          </Select>
          <FieldError id="question-category-error" message={errors.category} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="question-difficulty">Trudność *</Label>
          <Select value={form.difficulty} onValueChange={(value) => change({ difficulty: value as ArenaQuestionDifficulty }, 'difficulty')}>
            <SelectTrigger id="question-difficulty" className="w-full" aria-invalid={!!errors.difficulty}>
              <SelectValue placeholder="Wybierz trudność" />
            </SelectTrigger>
            <SelectContent>
              {difficulties.map((difficulty) => <SelectItem key={difficulty} value={difficulty}>{arenaDifficultyLabels[difficulty]}</SelectItem>)}
            </SelectContent>
          </Select>
          <FieldError id="question-difficulty-error" message={errors.difficulty} />
        </div>
      </div>

      {failure && <StatusMessage kind="error">{failure}</StatusMessage>}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>Anuluj</Button>
        <Button type="submit" disabled={busy}>{busy ? 'Zapisywanie…' : question ? 'Zapisz zmiany' : 'Dodaj pytanie'}</Button>
      </div>
    </form>
  );
}

export default function ArenaQuestionDialog({ open, question, onOpenChange, onSaved, onFailed }: {
  open: boolean;
  question: ArenaQuestionAdmin | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (saved: ArenaQuestionAdmin, created: boolean) => void;
  onFailed: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{question ? 'Edytuj pytanie' : 'Nowe pytanie'}</DialogTitle>
          <DialogDescription>
            Zmiana obejmie pojedynki rozpoczęte po zapisie. Trwające walki dokończą swoje pytania bez zmian.
          </DialogDescription>
        </DialogHeader>
        <QuestionEditor key={question?.id ?? 'new'} question={question} onCancel={() => onOpenChange(false)} onSaved={onSaved} onFailed={onFailed} />
      </DialogContent>
    </Dialog>
  );
}
