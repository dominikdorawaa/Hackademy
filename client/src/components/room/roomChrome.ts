import { createContext, useContext, useEffect } from 'react';

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

export function useRoomMode() {
  const chrome = useRoomChrome();
  const setActive = chrome?.setActive;
  useEffect(() => {
    if (!setActive) return;
    setActive(true);
    return () => setActive(false);
  }, [setActive]);
  return chrome;
}
