import { afterEach, expect, it, vi } from 'vitest';
import { AVATAR_KEY, buildColorMap, CLOTH_RAMPS, compositeOverlay, DEFAULT_AVATAR, fromAvatarConfig, toAvatarConfig, HAIR_RAMPS, readAvatar, recolorAtlas, recolorOverlay, saveAvatar, SKIN_RAMPS } from './avatarModel';
import type { OutfitSpec } from './avatarModel';

afterEach(() => vi.restoreAllMocks());
const rgb = (hex: string) => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
const spec: OutfitSpec = { colors: { outline: ['#101010'], skin: ['#f0c0a0', '#a06040'], top: ['#3050a0'], hair: ['#402020'], keep: ['#ffffff'] } };

function atlas(pixels: [number, number, string][], width = 64, height = 64) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (const [x, y, hex] of pixels) data.set([...rgb(hex), 255], (y * width + x) * 4);
  return data;
}

it('assigns listed colors and their nearest neighbours to materials with shade steps', () => {
  const data = atlas([[0, 0, '#f0c0a0'], [1, 0, '#a06040'], [2, 0, '#e8b898'], [3, 0, '#3050a0'], [4, 0, '#101010']]);
  const map = buildColorMap(data, spec);
  const entry = (hex: string) => map.get(parseInt(hex.slice(1), 16));
  expect(entry('#f0c0a0')).toEqual({ material: 'skin', shade: 3 });
  expect(entry('#a06040')).toEqual({ material: 'skin', shade: 0 });
  expect(entry('#e8b898')!.material).toBe('skin');
  expect(entry('#3050a0')).toEqual({ material: 'top', shade: 0 });
  expect(entry('#101010')!.material).toBe('outline');
});

it('recolors materials from the chosen ramps and keeps outline, kept colors and transparency', () => {
  const data = atlas([[0, 0, '#f0c0a0'], [1, 0, '#a06040'], [2, 0, '#3050a0'], [3, 0, '#101010'], [4, 0, '#402020'], [5, 0, '#ffffff']]);
  const map = buildColorMap(data, spec);
  const colors = { ...DEFAULT_AVATAR.colors, skin: 'heban', top: 'czerwony', hair: 'blond' };
  const out = recolorAtlas(data, 64, map, spec, colors);
  const at = (x: number) => [...out.slice(x * 4, x * 4 + 3)];
  expect(at(0)).toEqual(rgb(SKIN_RAMPS.heban[3]));
  expect(at(1)).toEqual(rgb(SKIN_RAMPS.heban[0]));
  expect(at(2)).toEqual(rgb(CLOTH_RAMPS.czerwony[0]));
  expect(at(3)).toEqual(rgb('#101010'));
  expect(at(4)).toEqual(rgb(HAIR_RAMPS.blond[0]));
  expect(at(5)).toEqual(rgb('#ffffff'));
  expect(out[6 * 4 + 3]).toBe(0);
});

it('saves and restores a valid avatar and falls back for invalid values', () => {
  saveAvatar({ outfit: 'baza', hair: 'irokez', hat: 'daszek', pose: 'profil', colors: { hair: 'rude', skin: 'heban', top: 'bialy', bottom: 'czerwony', shoes: 'oliwkowy', hat: 'turkusowy' } });
  expect(readAvatar()).toEqual({ outfit: 'baza', hair: 'irokez', hat: 'daszek', pose: 'profil', colors: { hair: 'rude', skin: 'heban', top: 'bialy', bottom: 'czerwony', shoes: 'oliwkowy', hat: 'turkusowy' } });
  localStorage.setItem(AVATAR_KEY, JSON.stringify({ outfit: 'mira', colors: { hair: 'blond' } }));
  expect(readAvatar()).toMatchObject({ outfit: 'baza', hair: DEFAULT_AVATAR.hair, hat: 'brak', pose: 'przod', colors: { hair: 'blond', hat: DEFAULT_AVATAR.colors.hat } });
  localStorage.setItem(AVATAR_KEY, JSON.stringify({ outfit: 'removed', colors: { hair: 'zielone', skin: 1 } }));
  expect(readAvatar()).toEqual(DEFAULT_AVATAR);
  localStorage.setItem(AVATAR_KEY, '{');
  expect(readAvatar()).toEqual(DEFAULT_AVATAR);
});

it('keeps working when storage is unavailable', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Unavailable'); });
  expect(() => saveAvatar(DEFAULT_AVATAR)).not.toThrow();
});

it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty'])('rejects inherited palette name %s in storage and API data', name => {
  const config = toAvatarConfig(DEFAULT_AVATAR);
  for (const field of ['skin', 'hairColor', 'topColor', 'bottomColor', 'shoesColor', 'hatColor'] as const) {
    expect(fromAvatarConfig({ ...config, [field]: name })).toBeNull();
  }
  for (const field of ['skin', 'hair', 'top', 'bottom', 'shoes', 'hat'] as const) {
    localStorage.setItem(AVATAR_KEY, JSON.stringify({ ...DEFAULT_AVATAR, colors: { ...DEFAULT_AVATAR.colors, [field]: name } }));
    const restored = readAvatar();
    expect(restored).toEqual(DEFAULT_AVATAR);
    expect(() => recolorAtlas(new Uint8ClampedArray(), 0, new Map(), spec, restored.colors)).not.toThrow();
  }
});

it('recolors an overlay by brightness and keeps its dark outline', () => {
  const overlay = atlas([[0, 0, '#60412d'], [1, 0, '#734c35'], [2, 0, '#2a1f2a'], [3, 0, '#3d2823']]);
  const out = recolorOverlay(overlay, HAIR_RAMPS.niebieskie);
  const at = (x: number) => [...out.slice(x * 4, x * 4 + 3)];
  expect(at(1)).toEqual(rgb(HAIR_RAMPS.niebieskie[3]));
  expect(at(3)).toEqual(rgb(HAIR_RAMPS.niebieskie[0]));
  expect(at(2)).toEqual(rgb('#2a1f2a'));
  expect(out[4 * 4 + 3]).toBe(0);
});

it('places an overlay on each anchored frame with translation and rotation', () => {
  const target = new Uint8ClampedArray(128 * 64 * 4);
  const overlay = atlas([[10, 10, '#ff0000']]);
  compositeOverlay(target, 128, overlay, { center: [10, 10], cells: { 0: { angle: 0, x: 10, y: 10 }, 1: { angle: 90, x: 20, y: 30 }, 2: null, 9: { angle: 0, x: 5, y: 5 } } });
  const at = (x: number, y: number) => [...target.slice((y * 128 + x) * 4, (y * 128 + x) * 4 + 4)];
  expect(at(10, 10)).toEqual([255, 0, 0, 255]);
  expect(at(64 + 20, 30)).toEqual([255, 0, 0, 255]);
  expect(target.filter((_, index) => index % 4 === 3 && target[index] === 255)).toHaveLength(2);
});

it('uses front overlays and the front head center only for front-view cells', () => {
  const target = new Uint8ClampedArray(128 * 64 * 4);
  const overlay = atlas([[30, 5, '#00ff00']]);
  const anchors = { center: [10, 10] as [number, number], frontCenter: [30, 15] as [number, number], cells: { 0: { angle: 0, x: 10, y: 10 }, 1: { angle: 0, x: 32, y: 20, view: 'front' as const } } };
  compositeOverlay(target, 128, overlay, anchors, 'front');
  const at = (x: number, y: number) => [...target.slice((y * 128 + x) * 4, (y * 128 + x) * 4 + 4)];
  expect(at(64 + 32, 10)).toEqual([0, 255, 0, 255]);
  expect(target.filter((_, index) => index % 4 === 3 && target[index] === 255)).toHaveLength(1);
  const side = new Uint8ClampedArray(128 * 64 * 4);
  compositeOverlay(side, 128, overlay, { ...anchors, frontCenter: undefined }, 'front');
  expect([...side.slice(((10 + 5) * 128 + 64 + 32 - 20) * 4, ((10 + 5) * 128 + 64 + 32 - 20) * 4 + 4)]).toEqual([0, 0, 0, 0]);
});

it('converts between the API avatar and the creator avatar and rejects unknown values', () => {
  const avatar = { outfit: 'dres' as const, hair: 'kucyk' as const, hat: 'daszek' as const, pose: 'postawa' as const, colors: { skin: 'heban', hair: 'rude', top: 'bialy', bottom: 'czerwony', shoes: 'granatowy', hat: 'oliwkowy' } };
  const config = toAvatarConfig(avatar);
  expect(config).toEqual({ outfit: 'dres', hair: 'kucyk', hat: 'daszek', skin: 'heban', hairColor: 'rude', topColor: 'bialy', bottomColor: 'czerwony', shoesColor: 'granatowy', hatColor: 'oliwkowy', pose: 'postawa' });
  expect(fromAvatarConfig(config)).toEqual(avatar);
  expect(fromAvatarConfig({ ...config, pose: undefined })).toEqual({ ...avatar, pose: 'przod' });
  expect(fromAvatarConfig({ ...config, pose: 'od-tylu' })).toEqual({ ...avatar, pose: 'przod' });
  expect(fromAvatarConfig({ ...config, pose: 'profil' })?.pose).toBe('profil');
  expect(fromAvatarConfig(null)).toBeNull();
  expect(fromAvatarConfig(undefined)).toBeNull();
  for (const broken of [{ outfit: 'pirat' }, { hair: 'afro' }, { hat: 'korona' }, { skin: 'zielona' }, { hairColor: 'zlote' }, { topColor: 'tecza' }, { hatColor: 'x' }]) {
    expect(fromAvatarConfig({ ...config, ...broken })).toBeNull();
  }
});
