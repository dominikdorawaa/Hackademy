import { useEffect, useState } from 'react';

export function useArenaClock(serverTime: number, active: boolean) {
  const [clock, setClock] = useState({ serverTime: 0, receivedAt: 0, now: 0 });
  useEffect(() => {
    const update = () => setClock(previous => {
      const now = Date.now();
      return previous.serverTime === serverTime ? { ...previous, now } : { serverTime, receivedAt: now, now };
    });
    let timer: ReturnType<typeof setInterval> | undefined;
    const schedule = () => {
      clearInterval(timer);
      if (active && document.visibilityState === 'visible') {
        update();
        timer = setInterval(update, 250);
      }
    };
    update();
    schedule();
    document.addEventListener('visibilitychange', schedule);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', schedule); };
  }, [serverTime, active]);
  return clock;
}
