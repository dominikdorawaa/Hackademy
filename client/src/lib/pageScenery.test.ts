import { expect, it } from 'vitest';
import { PAGE_SCENES, pageScene, sceneStyle } from './pageScenery';

it.each([
  ['/', 'home'], ['/dashboard/', 'dashboard'], ['/learn', 'learn'], ['/learn/paths/7', 'path'], ['/learn/ukos', 'ukos'],
  ['/rooms/1', 'ctf'], ['/arena', 'arena'], ['/arena/avatar', 'avatar'], ['/arena/battle/game-7', 'battle'],
  ['/ranking', 'ranking'], ['/profile', 'profile'], ['/profile/ola%20test', 'profile'], ['/friends', 'friends'], ['/settings', 'settings'],
  ['/login/sso-callback', 'auth'], ['/register', 'auth'], ['/witaj', 'onboarding'], ['/privacy', 'legal'], ['/terms', 'legal'],
  ['/admin', 'admin'], ['/admin/users', 'admin'], ['/admin/preview/rooms/7', 'ctf'], ['/admin/preview/paths/7', 'path'],
  ['/missing', 'notfound'],
] as const)('selects the intended scene for %s', (pathname, scene) => {
  expect(pageScene(pathname)).toBe(scene);
});

it('never interpolates path parameters into asset URLs and supplies both theme variants for every scene', () => {
  expect(pageScene('/profile/url(%22https://example.com%22)')).toBe('profile');
  for (const scene of PAGE_SCENES) {
    const style = sceneStyle(scene) as Record<string, string>;
    expect(style['--scene-dark']).toBe(`url("/assets/scenery/${scene}-dark.webp")`);
    expect(style['--scene-light']).toBe(`url("/assets/scenery/${scene}-light.webp")`);
  }
});
