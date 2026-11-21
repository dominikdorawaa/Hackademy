import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { RoomStep } from './RoomFooterBar';
import type { RoomPathProgress } from '../../hooks/useRoomReturn';

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
  path?: RoomPathProgress;
  meta?: ReactNode;
  action?: ReactNode;
}

function PathTrack({ path }: { path: RoomPathProgress }) {
  const rooms = path.chapters.flatMap(chapter => chapter.rooms);
  const index = rooms.findIndex(room => room.id === path.currentId);
  if (index < 0) return null;
  const solved = rooms.filter(room => room.solved).length;
  const chapter = path.chapters.find(item => item.rooms.some(room => room.id === path.currentId));
  return (
    <>
      <p className="room-nav-path-label">
        <span className="room-nav-path-full">Ścieżka: pokój {index + 1} z {rooms.length}</span>
        <span className="room-nav-path-short" aria-hidden="true">Pokój {index + 1}/{rooms.length}</span>
        {chapter?.title && <span className="room-nav-path-chapter">Rozdział {chapter.number}: {chapter.title}</span>}
      </p>
      <div className="room-nav-track room-nav-path" role="progressbar" aria-label="Postęp ścieżki"
        aria-valuemin={0} aria-valuemax={rooms.length} aria-valuenow={solved}
        aria-valuetext={`Pokój ${index + 1} z ${rooms.length}. Ukończone pokoje: ${solved} z ${rooms.length}.`}>
        {path.chapters.map((item, chapterIndex) => (
          <ol key={chapterIndex} style={{ flexGrow: item.rooms.length }} title={item.title ? `Rozdział ${item.number}: ${item.title}` : undefined}>
            {item.rooms.map(room => (
              <li key={room.id} title={room.title} className={cn(room.solved && 'is-done', room.id === path.currentId && 'is-current')} />
            ))}
          </ol>
        ))}
      </div>
    </>
  );
}

export default function RoomNavInfo({ back, title, progress, steps, path, meta, action }: RoomNavProps) {
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
      {path && <PathTrack path={path} />}
      {!path && !steps && meter && (
        <div className="room-nav-progress">
          <div className="room-meter" {...meter}>
            <span style={{ transform: `scaleX(${ratio})` }} />
          </div>
          <span className="room-nav-percent">{percent}%</span>
        </div>
      )}
      {action}
      {!path && steps && (
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
