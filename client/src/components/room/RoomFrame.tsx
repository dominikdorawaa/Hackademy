import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';
import RoomNavInfo, { type RoomNavProps } from './RoomNavInfo';
import { useRoomChrome } from './roomChrome';
import './room.css';

interface RoomFrameProps {
  nav: RoomNavProps;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  label: string;
}

export default function RoomFrame({ nav, footer, children, className, label }: RoomFrameProps) {
  const chrome = useRoomChrome();
  const setActive = chrome?.setActive;

  useEffect(() => {
    if (!setActive) return;
    setActive(true);
    return () => setActive(false);
  }, [setActive]);

  const info = <RoomNavInfo {...nav} />;
  return (
    <div className={cn('room-frame room-tokens', className)} aria-label={label} role="region">
      {chrome ? chrome.slot && createPortal(info, chrome.slot) : <div className="room-inline-bar">{info}</div>}
      <div className="room-frame-body">{children}</div>
      {footer}
    </div>
  );
}
