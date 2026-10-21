import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';
import RoomNavInfo, { type RoomNavProps } from './RoomNavInfo';
import { useRoomChrome } from './roomChrome';
import RoomMascot, { RoomMascotContext, type RoomMascotState } from './RoomMascot';
import './room.css';

interface RoomFrameProps {
  nav: RoomNavProps;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  label: string;
  mascot?: RoomMascotState;
}

export default function RoomFrame({ nav, footer, children, className, label, mascot = { successCount: 0 } }: RoomFrameProps) {
  const chrome = useRoomChrome();
  const setActive = chrome?.setActive;

  useEffect(() => {
    if (!setActive) return;
    setActive(true);
    return () => setActive(false);
  }, [setActive]);

  const info = <RoomNavInfo {...nav} />;
  return (
    <RoomMascotContext.Provider value={mascot}>
      <div className={cn('room-frame room-tokens', className)} aria-label={label} role="region">
        {chrome ? chrome.slot && createPortal(info, chrome.slot) : <div className="room-inline-bar">{info}</div>}
        <div className="room-body-shell"><div className="room-frame-body">{children}</div><RoomMascot roaming /></div>
        {footer}
      </div>
    </RoomMascotContext.Provider>
  );
}
