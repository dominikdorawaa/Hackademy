export interface TourStep { page: string; path: string; target: string; title: string; text: string }

export const TOUR_STEPS: TourStep[] = [
  { page: 'Dashboard', path: '/dashboard', target: 'dashboard-next', title: 'Twój następny krok', text: 'Tu zawsze podpowiadam, czym warto zająć się teraz. Jeden przycisk i od razu wracasz do nauki.' },
  { page: 'Dashboard', path: '/dashboard', target: 'dashboard-path', title: 'Bieżąca ścieżka', text: 'Postęp ścieżki, którą przerabiasz, i kolejne pokoje do rozwiązania.' },
  { page: 'Dashboard', path: '/dashboard', target: 'dashboard-level', title: 'Poziom i XP', text: 'Za każde zadanie zdobywasz XP. Tu widać Twój poziom, ile brakuje do następnego i ile czasu uczysz się w tym tygodniu.' },
  { page: 'Dashboard', path: '/dashboard', target: 'dashboard-flags', title: 'Ostatnie flagi', text: 'Lista pokoi, które ostatnio rozwiązałeś, czyli Twoje zdobyte flagi.' },
  { page: 'Dashboard', path: '/dashboard', target: 'dashboard-friends', title: 'Znajomi', text: 'Twoi znajomi i ich postęp. Stąd dodasz kogoś i wyzwiesz go na pojedynek.' },
  { page: 'Dashboard', path: '/dashboard', target: 'dashboard-board', title: 'Twoje miejsce w rankingu', text: 'Twoja pozycja w rankingu XP, Elo z Areny i gracze tuż obok Ciebie.' },
  { page: 'Ucz się', path: '/learn', target: 'learn-paths', title: 'Ścieżki nauki', text: 'Każda ścieżka prowadzi od podstaw krok po kroku. Pokoje odblokowują się po kolei, a za każde zadanie dostajesz XP.' },
  { page: 'Tryb rankingowy', path: '/arena', target: 'arena-card', title: 'Twoja liga', text: 'Twój awatar, liga i Elo. Tu też zmienisz wygląd awatara.' },
  { page: 'Tryb rankingowy', path: '/arena', target: 'arena-play', title: 'Walka w Arenie', text: 'Stąd dołączasz do kolejki. Walczysz wiedzą: poprawne odpowiedzi to ciosy w rywala.' },
  { page: 'Tryb rankingowy', path: '/arena', target: 'arena-ladder', title: 'Ligi', text: 'Wygrane podnoszą Elo, a Elo przesuwa Cię do wyższych lig, od Script Kiddie do Zero-day.' },
  { page: 'Tryb rankingowy', path: '/arena', target: 'arena-friends', title: 'Wyzwij znajomego', text: 'Możesz też zaprosić konkretnego znajomego na pojedynek.' },
  { page: 'Tryb rankingowy', path: '/arena', target: 'arena-rules', title: 'Zasady', text: 'Dziesięć rund, sto HP i piętnaście sekund na odpowiedź. Tu zawsze sprawdzisz zasady.' },
  { page: 'Ranking', path: '/ranking', target: 'ranking-points', title: 'Ranking XP', text: 'Najlepsi gracze według XP zdobytego w nauce.' },
  { page: 'Ranking', path: '/ranking', target: 'ranking-elo', title: 'Ranking Areny', text: 'Najlepsi gracze według Elo z pojedynków.' },
  { page: 'Twój profil', path: '/profile', target: 'profile', title: 'Twój profil', text: 'Twoja wizytówka z awatarem. Przyciskiem obok dodasz opis i zainteresowania.' },
  { page: 'Twój profil', path: '/profile', target: 'profile-badges', title: 'Odznaki', text: 'Zdobyte odznaki. Trzy najlepsze możesz wyróżnić w gablocie.' },
  { page: 'Twój profil', path: '/profile', target: 'profile-activity', title: 'Aktywność', text: 'Kalendarz Twojej nauki i statystyki. Codzienna nauka buduje serię dni.' },
];

export const TOUR_PAGES = [...new Set(TOUR_STEPS.map(step => step.page))];

const GAP = 16;
export const MOBILE_TOUR_WIDTH = 640;

export interface Box { top: number; left: number; width: number; height: number }

export const HEADER_ROOM = 88;

export function placeBubble(target: Box | null, bubble: { width: number; height: number }, viewport: { width: number; height: number }): { mode: 'dock' | 'float'; top: number; left: number } {
  if (viewport.width < MOBILE_TOUR_WIDTH || !target) return { mode: 'dock', top: 0, left: 0 };
  const room = viewport.height - HEADER_ROOM - GAP;
  if (target.height + GAP + bubble.height <= room) {
    const left = Math.min(Math.max(GAP, target.left + target.width / 2 - bubble.width / 2), viewport.width - bubble.width - GAP);
    return { mode: 'float', top: target.top + target.height + GAP, left };
  }
  if (target.left + target.width + GAP + bubble.width <= viewport.width - GAP) return { mode: 'float', top: target.top, left: target.left + target.width + GAP };
  if (target.left - GAP - bubble.width >= GAP) return { mode: 'float', top: target.top, left: target.left - GAP - bubble.width };
  return { mode: 'dock', top: 0, left: 0 };
}

export function scrollTargetTop(target: Box, bubbleHeight: number, viewport: { width: number; height: number }, floating: boolean) {
  const room = viewport.height - HEADER_ROOM - (viewport.width < MOBILE_TOUR_WIDTH ? 300 : 0);
  const height = target.height + (floating ? GAP + bubbleHeight : 0);
  const offset = height < room ? (room - height) / 2 : GAP;
  return Math.max(0, target.top - HEADER_ROOM - offset);
}
