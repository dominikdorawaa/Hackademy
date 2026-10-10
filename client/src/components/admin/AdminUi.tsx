import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, TriangleAlert, Upload, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { DifficultyLevel } from '../../types/api';
import { difficultyLabels, errorText } from './adminFormat';

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

const statusStyles = {
  error: { icon: AlertCircle, box: 'border-destructive/40 bg-destructive/10', tint: 'text-destructive' },
  warning: { icon: TriangleAlert, box: 'border-amber-500/40 bg-amber-500/10', tint: 'text-amber-500' },
  success: { icon: CheckCircle2, box: 'border-emerald-500/40 bg-emerald-500/10', tint: 'text-emerald-500' },
};

export function StatusMessage({ kind, children }: { kind: keyof typeof statusStyles; children: ReactNode }) {
  const { icon: Icon, box, tint } = statusStyles[kind];
  return (
    <div
      role={kind === 'success' ? 'status' : 'alert'}
      className={cn('flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm text-foreground', box)}
    >
      <Icon aria-hidden="true" className={cn('mt-0.5 size-4 shrink-0', tint)} />
      <span>{children}</span>
    </div>
  );
}

export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const confirm = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      setOpen(false);
    } catch (err) {
      setError(errorText(err, 'Nie udało się wykonać operacji. Spróbuj ponownie.'));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };
  return (
    <AlertDialog open={open} onOpenChange={(next) => {
      if (!inFlight.current) {
        setOpen(next);
        setError(null);
      }
    }}>
      <AlertDialogTrigger asChild disabled={pending}>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && <StatusMessage kind="error">{error}</StatusMessage>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Anuluj</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              void confirm();
            }}
          >
            {pending ? 'Trwa wykonywanie…' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

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
