import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

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

export interface RoomNavProps {
  back: RoomNavBack;
  title: string;
  progress: RoomNavProgress;
}

export default function RoomNavInfo({ back, title, progress }: RoomNavProps) {
  const ratio = progress.max > 0 ? Math.min(1, Math.max(0, progress.value / progress.max)) : 0;
  const percent = Math.round(ratio * 100);
  const backContent = <><ChevronLeft aria-hidden="true" /><span>{back.title}</span></>;
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
      </div>
      <div className="room-nav-progress">
        <div className="room-meter" role="progressbar" aria-label={progress.label}
          aria-valuemin={0} aria-valuemax={progress.max} aria-valuenow={progress.value} aria-valuetext={`${percent}%`}>
          <span style={{ transform: `scaleX(${ratio})` }} />
        </div>
        <span className="room-nav-percent">{percent}%</span>
      </div>
    </div>
  );
}
