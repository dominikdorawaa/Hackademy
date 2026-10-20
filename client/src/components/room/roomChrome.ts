import { createContext, useContext } from 'react';

export interface RoomChrome {
  active: boolean;
  setActive: (active: boolean) => void;
  slot: HTMLElement | null;
  setSlot: (slot: HTMLElement | null) => void;
}

export const RoomChromeContext = createContext<RoomChrome | null>(null);

export function useRoomChrome() {
  return useContext(RoomChromeContext);
}
