import { cn } from '../../lib/utils';

export type RailStep = 'done' | 'current' | 'todo';

interface PathRailProps {
  steps: RailStep[];
  label: string;
  className?: string;
}

export default function PathRail({ steps, label, className }: PathRailProps) {
  const done = steps.filter(step => step === 'done').length;
  const percent = steps.length > 0 ? Math.round((done / steps.length) * 100) : 0;
  return (
    <div className={cn('path-rail', steps.length > 24 && 'is-dense', className)} role="progressbar" aria-label={label}
      aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done} aria-valuetext={`${done} z ${steps.length}, ${percent}%`}>
      {steps.map((step, index) => <span key={index} className={step === 'todo' ? undefined : `is-${step}`} />)}
    </div>
  );
}
