import { useMemo, useState, type ReactNode } from 'react';
import { RoomChromeContext } from './roomChrome';

export default function RoomChromeProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const value = useMemo(() => ({ active, setActive, slot, setSlot }), [active, slot]);
  return <RoomChromeContext.Provider value={value}>{children}</RoomChromeContext.Provider>;
}
