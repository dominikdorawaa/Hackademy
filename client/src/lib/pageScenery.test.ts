import { expect, it } from 'vitest';
import { PAGE_SCENES, SCENE_BOUNDS, SCENE_RATIO, pageScene, sceneBounds, sceneCover, sceneStyle } from './pageScenery';

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

it.each([
  [1893, 760, .5, undefined, { width: 2000, height: 1000, x: -53, y: 0 }],
  [1280, 760, .5, undefined, { width: 1600, height: 800, x: -160, y: 0 }],
  [390, 480, .65, undefined, { width: 1200, height: 600, x: -526, y: 0 }],
  [100, 50, .5, undefined, { width: 400, height: 200, x: -150, y: 0 }],
  [1877, 760, .5, [200, 13, 11] as const, { width: 2000, height: 1000, x: -61, y: -65 }],
])('covers a %sx%s backdrop with whole pixels and skips the empty bands of the scene', (width, height, focus, bounds, scene) => {
  const cover = sceneCover(width, height, focus, bounds);
  expect(cover).toEqual(scene);
  const [imageHeight, top, bottom] = bounds ?? [200, 0, 0];
  const scale = cover.height / imageHeight;
  expect(Number.isInteger(scale)).toBe(true);
  expect(cover.width).toBeGreaterThanOrEqual(width);
  expect((imageHeight - top - bottom) * scale).toBeGreaterThanOrEqual(height);
  expect(cover.width / cover.height).toBe(SCENE_RATIO);
});

it('describes the drawn area of every scene in both themes and falls back for unknown scenes', () => {
  for (const scene of PAGE_SCENES) {
    for (const theme of ['dark', 'light']) {
      const [height, top, bottom] = sceneBounds(scene, theme);
      expect(SCENE_BOUNDS[`${scene}-${theme}`]).toBeDefined();
      expect([200, 256]).toContain(height);
      expect(height - top - bottom).toBeGreaterThan(height / 2);
    }
  }
  expect(sceneBounds('ranking', null)).toEqual(SCENE_BOUNDS['ranking-dark']);
  expect(sceneBounds('ranking', 'light')).toEqual(SCENE_BOUNDS['ranking-light']);
  expect(sceneBounds(undefined, 'dark')).toEqual([200, 0, 0]);
});
