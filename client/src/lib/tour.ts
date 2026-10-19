export const TOUR_STEPS = [
  { path: '/dashboard', target: 'dashboard', title: 'Dashboard', text: 'To Twoje centrum dowodzenia. Widzisz tu postęp, serię dni i to, czym warto zająć się dalej.' },
  { path: '/learn', target: 'learn', title: 'Ucz się', text: 'Tu są ścieżki nauki. Przechodzisz pokoje krok po kroku i zdobywasz XP za każde zadanie.' },
  { path: '/arena', target: 'arena', title: 'Tryb rankingowy', text: 'W Arenie walczysz wiedzą z innymi graczami. Poprawne odpowiedzi to ciosy, a wygrane podnoszą Elo.' },
  { path: '/ranking', target: 'ranking', title: 'Ranking', text: 'Ranking pokazuje najlepszych graczy według XP i Elo. Sprawdź, ile brakuje Ci do czołówki.' },
  { path: '/profile', target: 'profile', title: 'Twój profil', text: 'To Twoja wizytówka z awatarem, odznakami i aktywnością. Awatara zmienisz w każdej chwili w Arenie.' },
] as const;

const GAP = 16;
export const MOBILE_TOUR_WIDTH = 640;

export interface Box { top: number; left: number; width: number; height: number }

export function placeBubble(target: Box | null, bubble: { width: number; height: number }, viewport: { width: number; height: number }): { mode: 'dock' | 'float'; top: number; left: number } {
  if (viewport.width < MOBILE_TOUR_WIDTH || !target) return { mode: 'dock', top: viewport.height - bubble.height - GAP, left: GAP };
  const left = Math.min(Math.max(GAP, target.left + target.width / 2 - bubble.width / 2), viewport.width - bubble.width - GAP);
  const below = target.top + target.height + GAP;
  if (below + bubble.height <= viewport.height - GAP) return { mode: 'float', top: below, left };
  const above = target.top - GAP - bubble.height;
  if (above >= GAP) return { mode: 'float', top: above, left };
  const top = Math.min(Math.max(GAP, target.top), viewport.height - bubble.height - GAP);
  if (target.left + target.width + GAP + bubble.width <= viewport.width - GAP) return { mode: 'float', top, left: target.left + target.width + GAP };
  if (target.left - GAP - bubble.width >= GAP) return { mode: 'float', top, left: target.left - GAP - bubble.width };
  return { mode: 'dock', top: viewport.height - bubble.height - GAP, left: GAP };
}

