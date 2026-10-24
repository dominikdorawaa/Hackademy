import { useRef } from 'react';
import type { ReactNode } from 'react';
import { Upload, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { ArenaQuestionDifficulty, DifficultyLevel } from '../../types/api';
import { arenaDifficultyLabels } from '../arena/arenaDifficulty';
import { difficultyLabels } from './adminFormat';

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h1 className="font-[Poppins] text-2xl font-semibold tracking-tight text-foreground text-balance">{title}</h1>
        {description && <p className="max-w-prose text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Section({ title, description, actions, children, className, flush = false }: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <section className={cn('rounded-xl border bg-card text-card-foreground', className)} aria-label={title}>
      <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className={flush ? undefined : 'p-5'}>{children}</div>
    </section>
  );
}

export { StatusMessage } from '../common/StatusMessage';
export { ConfirmAction } from '../common/ConfirmAction';

const difficultyTone: Record<DifficultyLevel, string> = {
  EASY: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400',
  MEDIUM: 'border-amber-500/40 text-amber-600 dark:text-amber-400',
  HARD: 'border-orange-500/40 text-orange-600 dark:text-orange-400',
  INSANE: 'border-destructive/50 text-destructive',
};

export function DifficultyBadge({ difficulty }: { difficulty: DifficultyLevel }) {
  return (
    <Badge variant="outline" className={difficultyTone[difficulty]}>
      {difficultyLabels[difficulty]}
    </Badge>
  );
}

const arenaDifficultyTone: Record<ArenaQuestionDifficulty, string> = {
  VERY_EASY: 'border-sky-500/40 text-sky-600 dark:text-sky-400',
  EASY: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400',
  MEDIUM: 'border-amber-500/40 text-amber-600 dark:text-amber-400',
  HARD: 'border-orange-500/40 text-orange-600 dark:text-orange-400',
  VERY_HARD: 'border-destructive/50 text-destructive',
};

export function ArenaDifficultyBadge({ difficulty }: { difficulty: ArenaQuestionDifficulty }) {
  return (
    <Badge variant="outline" className={cn('whitespace-nowrap', arenaDifficultyTone[difficulty])}>
      {arenaDifficultyLabels[difficulty]}
    </Badge>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function LoadingRows({ rows = 4, label = 'Ładowanie danych' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-2">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function FilePicker({ id, file, onChange, accept, describedBy }: {
  id: string;
  file: File | null;
  onChange: (file: File | null) => void;
  accept?: string;
  describedBy?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex min-w-0 items-center gap-2">
      <input
        ref={input}
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
      <Button type="button" variant="outline" onClick={() => input.current?.click()} aria-controls={id}>
        <Upload />Wybierz plik
      </Button>
      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{file ? file.name : 'Nie wybrano pliku'}</span>
      {file && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Usuń wybrany plik"
          onClick={() => {
            if (input.current) input.current.value = '';
            onChange(null);
          }}
        >
          <X />
        </Button>
      )}
    </div>
  );
}
