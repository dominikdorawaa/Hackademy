import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

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
