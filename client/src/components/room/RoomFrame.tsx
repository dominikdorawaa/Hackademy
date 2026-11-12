import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';
import RoomNavInfo, { type RoomNavProps } from './RoomNavInfo';
import { useRoomMode } from './roomChrome';
import RoomBit, { RoomBitContext, type RoomBitState } from './RoomBit';
import './room.css';

interface RoomFrameProps {
  nav: RoomNavProps;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  label: string;
  mascot?: RoomBitState;
}

export default function RoomFrame({ nav, footer, children, className, label, mascot }: RoomFrameProps) {
  const chrome = useRoomMode();

  const info = <RoomNavInfo {...nav} />;
  return (
    <RoomBitContext.Provider value={mascot ?? null}>
      <div className={cn('room-frame room-tokens', className)} aria-label={label} role="region">
        {chrome ? chrome.slot && createPortal(info, chrome.slot) : <div className="room-inline-bar">{info}</div>}
        <div className="room-body-shell"><div className="room-frame-body">{children}</div>{mascot && <RoomBit />}</div>
        {footer}
      </div>
    </RoomBitContext.Provider>
  );
}
