import { useCallback, useEffect, useRef, useState } from 'react';
import type { MascotDance } from './Mascot';
import { MASCOT_DANCES, mascotDuration } from './Mascot';

export const DANCE_LOOPS = 2;

export function useMascotDance(disabled = false) {
  const [dance, setDance] = useState<MascotDance | null>(null);
  const next = useRef(0);

  const start = useCallback(() => {
    if (disabled) return;
    setDance(MASCOT_DANCES[next.current % MASCOT_DANCES.length]);
    next.current += 1;
  }, [disabled]);

  useEffect(() => {
    if (!dance) return;
    const stop = setTimeout(() => setDance(null), mascotDuration(dance) * DANCE_LOOPS);
    return () => clearTimeout(stop);
  }, [dance]);

  return { dance: disabled ? null : dance, start };
}
