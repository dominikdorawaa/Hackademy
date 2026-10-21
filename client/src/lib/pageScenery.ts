import type { CSSProperties } from 'react';

export const PAGE_SCENES = ['home', 'dashboard', 'learn', 'path', 'ctf', 'ukos', 'arena', 'battle', 'avatar', 'ranking', 'profile', 'friends', 'settings', 'auth', 'onboarding', 'legal', 'notfound', 'admin'] as const;
export type PageScene = typeof PAGE_SCENES[number];

export function pageScene(pathname: string): PageScene {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return 'home';
  const [section, child, third] = segments;
  if (section === 'admin') {
    if (child === 'preview' && third === 'rooms') return 'ctf';
    if (child === 'preview' && third === 'paths') return 'path';
    return 'admin';
  }
  if (section === 'learn') return child === 'ukos' ? 'ukos' : child === 'paths' ? 'path' : 'learn';
  if (section === 'arena') return child === 'battle' ? 'battle' : child === 'avatar' ? 'avatar' : 'arena';
  if (section === 'rooms') return 'ctf';
  if (section === 'login' || section === 'register') return 'auth';
  if (section === 'privacy' || section === 'terms') return 'legal';
  if (section === 'witaj') return 'onboarding';
  if (section === 'dashboard' || section === 'ranking' || section === 'profile' || section === 'friends' || section === 'settings') return section;
  return 'notfound';
}

export function sceneStyle(scene: PageScene): CSSProperties {
  return {
    '--scene-dark': `url("/assets/scenery/${scene}-dark.webp")`,
    '--scene-light': `url("/assets/scenery/${scene}-light.webp")`,
  } as CSSProperties;
}
