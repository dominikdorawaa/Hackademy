import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { RoomStep } from './RoomFooterBar';

export interface RoomNavBack {
  title: string;
  label: string;
  to?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export interface RoomNavProgress {
  value: number;
  max: number;
  label: string;
}

export interface RoomNavSteps {
  items: RoomStep[];
  current: number;
  onSelect: (index: number) => void;
}

export interface RoomNavProps {
  back: RoomNavBack;
  title: string;
  progress?: RoomNavProgress;
  steps?: RoomNavSteps;
  meta?: ReactNode;
  action?: ReactNode;
}

export default function RoomNavInfo({ back, title, progress, steps, meta, action }: RoomNavProps) {
  const ratio = progress && progress.max > 0 ? Math.min(1, Math.max(0, progress.value / progress.max)) : 0;
  const percent = Math.round(ratio * 100);
  const backContent = <><ChevronLeft aria-hidden="true" /><span>{back.title}</span></>;
  const meter = progress && { role: 'progressbar', 'aria-label': progress.label, 'aria-valuemin': 0, 'aria-valuemax': progress.max, 'aria-valuenow': progress.value, 'aria-valuetext': `${percent}%` } as const;
  return (
    <div className="room-nav room-tokens">
      <div className="room-nav-trail">
        {back.to ? (
          <Link className="room-nav-back" to={back.to} aria-label={back.label}>{backContent}</Link>
        ) : (
          <button type="button" className="room-nav-back" aria-label={back.label} aria-busy={back.disabled || undefined}
            disabled={back.disabled} onClick={back.onClick}>{backContent}</button>
        )}
        <span className="room-nav-sep" aria-hidden="true">/</span>
        <strong className="room-nav-title" title={title}>{title}</strong>
        {meta && <div className="room-nav-meta">{meta}</div>}
      </div>
      {!steps && meter && (
        <div className="room-nav-progress">
          <div className="room-meter" {...meter}>
            <span style={{ transform: `scaleX(${ratio})` }} />
          </div>
          <span className="room-nav-percent">{percent}%</span>
        </div>
      )}
      {action}
      {steps && (
        <div className="room-nav-track">
          <ol className="room-nav-steps" aria-hidden="true">
            {steps.items.map((step, index) => (
              <li key={step.key} className={cn(step.done && 'is-done', index === steps.current && 'is-current')}>
                <button type="button" tabIndex={-1} title={`${index + 1}. ${step.title}`} disabled={step.locked}
                  onClick={() => steps.onSelect(index)} />
              </li>
            ))}
          </ol>
          {meter && <span className="sr-only" {...meter}>{percent}%</span>}
        </div>
      )}
    </div>
  );
}
