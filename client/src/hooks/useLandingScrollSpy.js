import { useState, useEffect } from 'react';

const SECTION_IDS = ['start', 'arena', 'rooms', 'leaderboard'];

/**
 * Która sekcja landing jest „w centrum” widoku — pod podświetlenie linków w navbarze.
 */
export function useLandingScrollSpy(enabled) {
  const [activeId, setActiveId] = useState('start');

  useEffect(() => {
    if (!enabled) return;

    const resolveActive = () => {
      const navOffset = typeof window !== 'undefined' ? Math.min(140, window.innerHeight * 0.18) : 120;
      const probeY = window.scrollY + navOffset;
      let current = 'start';

      for (const id of SECTION_IDS) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top + window.scrollY;
        if (top <= probeY + 1) {
          current = id;
        }
      }
      setActiveId(current);
    };

    resolveActive();
    const t0 = window.setTimeout(resolveActive, 0);
    const t1 = window.setTimeout(resolveActive, 120);
    const onScroll = () => requestAnimationFrame(resolveActive);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', resolveActive);
    window.addEventListener('hashchange', resolveActive);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', resolveActive);
      window.removeEventListener('hashchange', resolveActive);
    };
  }, [enabled]);

  return activeId;
}
