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

export const SCENE_RATIO = 2;
export const SCENE_PANELS = '.ud-next, .profile-header, .auth-intro, .arena-card, .ranking-board-head';

type SceneBounds = readonly [height: number, top: number, bottom: number];

export const SCENE_BOUNDS: Record<string, SceneBounds> = {
  'admin-dark': [200, 0, 0], 'admin-light': [200, 0, 0],
  'arena-dark': [200, 10, 13], 'arena-light': [200, 0, 0],
  'auth-dark': [200, 5, 6], 'auth-light': [200, 11, 13],
  'avatar-dark': [200, 9, 15], 'avatar-light': [200, 7, 6],
  'battle-dark': [200, 0, 0], 'battle-light': [200, 0, 0],
  'ctf-dark': [200, 17, 13], 'ctf-light': [200, 0, 0],
  'dashboard-dark': [256, 0, 0], 'dashboard-light': [200, 0, 0],
  'friends-dark': [200, 18, 21], 'friends-light': [200, 0, 0],
  'home-dark': [256, 0, 0], 'home-light': [256, 0, 0],
  'learn-dark': [200, 13, 13], 'learn-light': [200, 0, 0],
  'legal-dark': [200, 19, 20], 'legal-light': [200, 0, 0],
  'notfound-dark': [200, 39, 15], 'notfound-light': [200, 0, 0],
  'onboarding-dark': [200, 17, 15], 'onboarding-light': [200, 0, 0],
  'path-dark': [200, 15, 0], 'path-light': [200, 0, 0],
  'profile-dark': [200, 12, 13], 'profile-light': [200, 0, 0],
  'ranking-dark': [200, 13, 11], 'ranking-light': [200, 14, 14],
  'settings-dark': [200, 22, 33], 'settings-light': [200, 13, 11],
  'ukos-dark': [200, 22, 18], 'ukos-light': [200, 0, 0],
};

export function sceneBounds(scene: string | undefined, theme: string | null): SceneBounds {
  return SCENE_BOUNDS[`${scene}-${theme === 'light' ? 'light' : 'dark'}`] ?? [200, 0, 0];
}

export function sceneCover(width: number, height: number, focus: number, [imageHeight, top, bottom]: SceneBounds = [200, 0, 0]) {
  const imageWidth = imageHeight * SCENE_RATIO;
  const scale = Math.max(1, Math.ceil(Math.max(width / imageWidth, height / (imageHeight - top - bottom))));
  const coverWidth = imageWidth * scale;
  return { width: coverWidth, height: imageHeight * scale, x: Math.round((width - coverWidth) * focus), y: 0 - top * scale };
}
