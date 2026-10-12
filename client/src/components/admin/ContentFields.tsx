import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export type FieldErrors = Record<string, string>;
export function TextField({ name, label, value, limit, required = false, multiline = false, compact = false, error, onChange }: {
  name: string; label: string; value: string; limit: number; required?: boolean; multiline?: boolean; compact?: boolean;
  error?: string; onChange: (value: string) => void;
}) {
  const problem = error || (value.length > limit ? `Maksymalnie ${limit} znaków` : undefined);
  const id = `content-${name}`;
  const props = { id, name, value, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value),
    'aria-invalid': !!problem, 'aria-describedby': `${id}-count${problem ? ` ${id}-error` : ''}`, 'aria-required': required };
  const counter = <span id={`${id}-count`} className={`text-xs tabular-nums ${value.length > limit ? 'text-destructive' : 'text-muted-foreground'}`}>{value.length}/{limit}</span>;
  return <div className={`grid min-w-0 ${compact ? 'gap-1.5' : 'gap-2'}`}>
    <div className="flex items-center justify-between gap-2"><Label htmlFor={id} className={compact ? 'text-xs text-muted-foreground' : undefined}>{label}{required && ' *'}</Label>{compact && counter}</div>
    {multiline ? <Textarea {...props} className="min-h-28" /> : <Input {...props} className={compact ? 'h-8 font-medium' : undefined} />}
    {!compact && counter}
    {problem && <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{problem}</p>}
  </div>;
}
export function focusError(errors: FieldErrors) {
  const first = Object.keys(errors)[0];
  requestAnimationFrame(() => {
    const element = document.getElementById(`content-${first}`) ?? document.querySelector<HTMLElement>(`[data-field="${first}"]`);
    element?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    element?.focus();
  });
}
export function checkText(errors: FieldErrors, field: string, value: string, limit: number, required = false) {
  if (required && !value.trim()) errors[field] = 'To pole jest wymagane';
  else if (value.length > limit) errors[field] = `Maksymalnie ${limit} znaków`;
}
