import type { AvatarConfig } from '../../../types/api';
export type Material = 'outline' | 'hair' | 'skin' | 'top' | 'bottom' | 'shoes' | 'keep';
export type Customizable = 'hair' | 'skin' | 'top' | 'bottom' | 'shoes';
export type Ramp = [string, string, string, string];

export interface OutfitSpec { colors: Partial<Record<Material, string[]>> }

export const OUTFIT_SPECS: Record<'baza' | 'bluza' | 'dres', OutfitSpec> = {
  dres: { colors: {
    outline: ['#261d27', '#291e29', '#271e28', '#2a202b', '#281e27', '#241b25', '#251c26', '#231a24', '#271d28', '#231a23'],
    skin: ['#fbcda5', '#facba3', '#fdcba5', '#fdcca5', '#b66f65', '#b36d64', '#b46e63', '#b87066', '#b56a5f', '#b67066', '#bb7468', '#a26058', '#9e625c', '#74625c', '#9e8678', '#fbcb9e', '#fbcc9f', '#fccb9f', '#b16b61', '#b36d62', '#af685e'],
    top: ['#ef6c16', '#f16d16', '#ce3e13', '#ee6a15', '#ca3c14', '#eb6516', '#e86116', '#e35610', '#ae301a', '#de360c', '#56272b', '#3d2229', '#311f27', '#f26921', '#f46a21', '#f3681f', '#f0661e', '#b33d21', '#b53e21', '#b53d1c', '#b94120'],
    bottom: ['#000000', '#212120', '#1f1f1f', '#050304', '#191016', '#2b2b2b', '#2c2b2b', '#1e1f20'],
    shoes: ['#dee2e1', '#828489', '#85878b', '#6e7378', '#c9c9c9', '#9c9598', '#9a9296', '#837c7f'],
    keep: ['#ffffff', '#d1d1d2', '#d7dbdc', '#dbdddd', '#eaedef', '#4b474b', '#5c5759', '#f7f6f5', '#f9f8f7'],
  } },
  bluza: { colors: {
    outline: ['#291e2a', '#2a202b', '#281e27', '#2a202c', '#242937', '#373c49', '#281d29', '#271c28', '#281c27', '#271c27', '#271b28', '#271b27', '#281b27'],
    skin: ['#facba4', '#fbcca4', '#facba3', '#f9c99f', '#b66e65', '#b36d64', '#b36b62', '#b36c63', '#ba7166', '#a95e57', '#9f645c', '#cb826f', '#fccb9d', '#fbca9d', '#fbca9b', '#fccb9b', '#b36c62', '#b26a61', '#b46b61', '#b56c62'],
    top: ['#589a68', '#2b623e', '#589a67', '#2c633f', '#579966', '#2d6140', '#2c643f', '#2c5e3e', '#569665', '#2c553d', '#2f5d42', '#305a3f', '#2a443c', '#2d523e', '#498c5c', '#377048', '#427d54', '#37744a', '#3a724b', '#39704f', '#3b6f4a', '#357448', '#4b895c', '#2a362d', '#3c704e', '#4b875b', '#3e7d53', '#3c7a4f', '#699175', '#3b8450', '#3a844f', '#3c8551', '#204e3b', '#214e3c', '#21513c', '#1d4a39', '#1f4d3a'],
    bottom: ['#304a69', '#182b49', '#314c6b', '#192d4a', '#182945', '#2f4a68', '#182943', '#223856', '#354665', '#1c2a46', '#1b2945', '#364866'],
    shoes: ['#ffffff', '#c3c5d7', '#c2c3d5', '#c4c6d9', '#c1c2c2'],
    keep: ['#dde0e2'],
  } },
  baza: { colors: {
    outline: ['#2a202b', '#2a212d', '#291f2b', '#2c222e', '#2f2430', '#352934', '#291f2a', '#291f2c', '#271d29'],
    skin: ['#facea9', '#facda7', '#fdcea9', '#f9cba5', '#efbf9c', '#efbb98', '#b67168', '#b36f66', '#af6a63', '#bb766b', '#bf7a6e', '#6e5f5b', '#746360', '#8b7a73', '#9e5f5c', '#98685f', '#9a6e66', '#8f615c', '#895e58', '#fbcba2', '#fbcca3', '#b26c63', '#b46e64', '#b16b61', '#af6a61', '#b36e64', '#6a5c56', '#6f605a'],
    top: ['#2b3243', '#3e485d', '#2b3345', '#3d465d', '#3c4559', '#374155', '#293041', '#2a2f3e', '#272d3b'],
    bottom: ['#9e8b80', '#9e8c81', '#9b897f', '#9b8c7f', '#5f5250', '#625452', '#615251', '#5e514e', '#81716a', '#96827a', '#524245', '#45363d', '#99887b', '#98877a', '#9a887d', '#968578', '#5e524e', '#60534f', '#594c49'],
    shoes: ['#2e313f', '#5d5077', '#5b5076', '#5a4f74', '#2e3140'],
    keep: ['#e7e9e8', '#fdfdfd'],
  } },
};

export const SKIN_RAMPS: Record<string, Ramp> = {
  porcelanowa: ['#a8705f', '#d9a08a', '#f3c8b0', '#ffe4d2'],
  jasna: ['#a86d5f', '#cf9478', '#f2c29f', '#fcdcbf'],
  oliwkowa: ['#7a4e2f', '#a8743f', '#c9955a', '#e2b57c'],
  brazowa: ['#5a321f', '#83502f', '#a86d45', '#c88d5f'],
  ciemna: ['#3a2016', '#5c3524', '#7c4c33', '#9a6546'],
  heban: ['#24130d', '#3b2218', '#553424', '#704731'],
};
export const HAIR_RAMPS: Record<string, Ramp> = {
  czarne: ['#16121a', '#262029', '#3a3038', '#4f434b'],
  brazowe: ['#2e1a12', '#4a2b1c', '#6b4129', '#8a5a39'],
  rude: ['#5a1f0f', '#8c3518', '#bf5726', '#e07c3c'],
  blond: ['#7a5a26', '#b08a3e', '#d9b45c', '#f2d68a'],
  siwe: ['#4a4a52', '#7a7a84', '#a8a8b2', '#d4d4dc'],
  niebieskie: ['#142a5c', '#1f448f', '#2f64c4', '#5a92ec'],
};
export const CLOTH_RAMPS: Record<string, Ramp> = {
  granatowy: ['#1c2235', '#2b3550', '#3c4a6c', '#55668e'],
  grafitowy: ['#1d2124', '#2c3236', '#41484d', '#5b6368'],
  bordowy: ['#3a0f1e', '#5a1a30', '#7c2846', '#a03d60'],
  turkusowy: ['#0c3d3b', '#13605c', '#1f8a84', '#3cb3aa'],
  piaskowy: ['#5e4b3c', '#86705c', '#a89280', '#c9b5a2'],
  oliwkowy: ['#2b3218', '#424b25', '#5d6936', '#7d8a4c'],
  czerwony: ['#4a0f12', '#7a1a1f', '#ad2a2f', '#d9494a'],
  bialy: ['#8f96a0', '#b9c0c8', '#dce1e6', '#f4f6f8'],
};

export const CUSTOM_COLOR = /^#[0-9a-f]{6}$/;

const toHex = (rgb: number[]) => `#${rgb.map(value => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, '0')).join('')}`;

export function hslToHex(h: number, s: number, l: number) {
  const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return toHex([f(0) * 255, f(8) * 255, f(4) * 255]);
}

export function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

export function rampFromHex(hex: string): Ramp {
  const [h, s, l] = hexToHsl(hex);
  return [hslToHex(h, Math.min(1, s * 1.1), l * 0.42), hslToHex(h, Math.min(1, s * 1.05), l * 0.7), hex, hslToHex(h, s * 0.95, l + (1 - l) * 0.38)];
}

export function rampFor(options: Record<string, Ramp>, value: string): Ramp {
  return Object.hasOwn(options, value) ? options[value] : CUSTOM_COLOR.test(value) ? rampFromHex(value) : Object.values(options)[0];
}

export function isColorChoice(options: Record<string, Ramp>, value: unknown): value is string {
  return typeof value === 'string' && (Object.hasOwn(options, value) || CUSTOM_COLOR.test(value));
}

export interface AvatarColors { hair: string; skin: string; top: string; bottom: string; shoes: string }

const parse = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const lightness = ([r, g, b]: number[]) => (Math.max(r, g, b) + Math.min(r, g, b)) / 510;

export interface ColorEntry { material: Material; shade: number }
export type ColorMap = Map<number, ColorEntry>;

export function buildColorMap(pixels: Uint8ClampedArray, spec: OutfitSpec) {
  const known: { rgb: number[]; material: Material }[] = [];
  for (const [material, list] of Object.entries(spec.colors) as [Material, string[]][]) for (const hex of list) known.push({ rgb: parse(hex), material });
  const assigned = new Map<number, Material>();
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] === 0) continue;
    const key = (pixels[index] << 16) | (pixels[index + 1] << 8) | pixels[index + 2];
    if (assigned.has(key)) continue;
    const rgb = [pixels[index], pixels[index + 1], pixels[index + 2]];
    let best = known[0], distance = Infinity;
    for (const candidate of known) {
      const d = (candidate.rgb[0] - rgb[0]) ** 2 + (candidate.rgb[1] - rgb[1]) ** 2 + (candidate.rgb[2] - rgb[2]) ** 2;
      if (d < distance) { distance = d; best = candidate; }
    }
    assigned.set(key, best.material);
  }
  const ranges = new Map<Material, [number, number]>();
  for (const [key, material] of assigned) {
    const l = lightness([key >> 16, (key >> 8) & 255, key & 255]), range = ranges.get(material) ?? [1, 0];
    ranges.set(material, [Math.min(range[0], l), Math.max(range[1], l)]);
  }
  const map: ColorMap = new Map();
  for (const [key, material] of assigned) {
    const [low, high] = ranges.get(material)!, l = lightness([key >> 16, (key >> 8) & 255, key & 255]);
    map.set(key, { material, shade: Math.min(3, Math.max(0, Math.round(((l - low) / (high - low || 1)) * 3))) });
  }
  return map;
}

export function recolorAtlas(pixels: Uint8ClampedArray, width: number, map: ColorMap, spec: OutfitSpec, colors: AvatarColors) {
  const out = new Uint8ClampedArray(pixels);
  const ramps: Record<Customizable, number[][]> = {
    hair: rampFor(HAIR_RAMPS, colors.hair).map(parse), skin: rampFor(SKIN_RAMPS, colors.skin).map(parse), top: rampFor(CLOTH_RAMPS, colors.top).map(parse),
    bottom: rampFor(CLOTH_RAMPS, colors.bottom).map(parse), shoes: rampFor(CLOTH_RAMPS, colors.shoes).map(parse),
  };
  for (let index = 0; index < out.length; index += 4) {
    if (out[index + 3] === 0) continue;
    const entry = map.get((out[index] << 16) | (out[index + 1] << 8) | out[index + 2]);
    if (!entry) continue;
    const material = entry.material;
    if (material === 'outline' || material === 'keep') continue;
    const color = ramps[material as Customizable][entry.shade];
    out[index] = color[0]; out[index + 1] = color[1]; out[index + 2] = color[2];
  }
  return out;
}

export const HAIR_STYLES = ['brak', 'krotkie', 'irokez', 'kucyk'] as const;
export const HAT_STYLES = ['brak', 'czapka', 'daszek'] as const;
export type HairStyle = typeof HAIR_STYLES[number];
export type HatStyle = typeof HAT_STYLES[number];
export const HEAD_OVERLAYS: Record<Exclude<HairStyle | HatStyle, 'brak'>, string> = {
  krotkie: 'hair-short.png', irokez: 'hair-mohawk.png', kucyk: 'hair-ponytail.png', czapka: 'hat-beanie.png', daszek: 'hat-cap.png',
};
export const AVATAR_OUTFITS = ['baza', 'bluza', 'dres'] as const;
export type AvatarOutfit = typeof AVATAR_OUTFITS[number];
export const FRONT_VIEWS: Record<AvatarOutfit, { image: string; anchors: string }> = {
  baza: { image: 'front/baza.png', anchors: 'front/anchors-baza.json' },
  bluza: { image: 'front/bluza.png', anchors: 'front/anchors-bluza.json' },
  dres: { image: 'front/dres.png', anchors: 'front/anchors-dres.json' },
};
export const HEAD_ANCHORS: Record<AvatarOutfit, string> = { baza: 'anchors.json', bluza: 'hoodie/anchors.json', dres: 'track/anchors.json' };
export const PROFILE_VIEWS: Record<AvatarOutfit, { image: string; anchors: string }> = {
  baza: { image: 'profile/baza.png', anchors: 'profile/anchors-baza.json' },
  bluza: { image: 'profile/bluza.png', anchors: 'profile/anchors-bluza.json' },
  dres: { image: 'profile/dres.png', anchors: 'profile/anchors-dres.json' },
};
export const AVATAR_POSES = ['przod', 'postawa', 'profil'] as const;
export type AvatarPose = typeof AVATAR_POSES[number];
export const PORTRAIT_CROPS: Record<AvatarPose, [number, number]> = { przod: [16, 0], postawa: [18, 1], profil: [17, 0] };
const toPose = (value: unknown): AvatarPose => (AVATAR_POSES as readonly unknown[]).includes(value) ? value as AvatarPose : 'przod';

export interface Avatar { outfit: AvatarOutfit; colors: AvatarColors & { hat: string }; hair: HairStyle; hat: HatStyle; pose: AvatarPose }
export const DEFAULT_AVATAR: Avatar = { outfit: 'baza', hair: 'krotkie', hat: 'brak', pose: 'przod', colors: { hair: 'brazowe', skin: 'jasna', top: 'granatowy', bottom: 'piaskowy', shoes: 'grafitowy', hat: 'czerwony' } };
export const AVATAR_KEY = 'hackademy-avatar-v1';

export function readAvatar(): Avatar {
  try {
    const saved = JSON.parse(localStorage.getItem(AVATAR_KEY) ?? 'null');
    const outfit = AVATAR_OUTFITS.includes(saved?.outfit) ? saved.outfit as AvatarOutfit : DEFAULT_AVATAR.outfit;
    const pick = (value: unknown, options: Record<string, Ramp>, fallback: string) => isColorChoice(options, value) ? value : fallback;
    const choose = <T extends string>(value: unknown, options: readonly T[], fallback: T) => options.includes(value as T) ? value as T : fallback;
    const colors = saved?.colors ?? {};
    return { outfit, hair: choose(saved?.hair, HAIR_STYLES, DEFAULT_AVATAR.hair), hat: choose(saved?.hat, HAT_STYLES, DEFAULT_AVATAR.hat), pose: toPose(saved?.pose), colors: {
      hair: pick(colors.hair, HAIR_RAMPS, DEFAULT_AVATAR.colors.hair), skin: pick(colors.skin, SKIN_RAMPS, DEFAULT_AVATAR.colors.skin),
      top: pick(colors.top, CLOTH_RAMPS, DEFAULT_AVATAR.colors.top), bottom: pick(colors.bottom, CLOTH_RAMPS, DEFAULT_AVATAR.colors.bottom),
      shoes: pick(colors.shoes, CLOTH_RAMPS, DEFAULT_AVATAR.colors.shoes), hat: pick(colors.hat, CLOTH_RAMPS, DEFAULT_AVATAR.colors.hat),
    } };
  } catch { return { ...DEFAULT_AVATAR, colors: { ...DEFAULT_AVATAR.colors } }; }
}
export function saveAvatar(avatar: Avatar) {
  try { localStorage.setItem(AVATAR_KEY, JSON.stringify(avatar)); } catch { return; }
}

export function recolorOverlay(pixels: Uint8ClampedArray, ramp: Ramp) {
  const out = new Uint8ClampedArray(pixels), colors = ramp.map(parse);
  let low = 1, high = 0;
  for (let index = 0; index < out.length; index += 4) {
    if (!out[index + 3]) continue;
    const l = lightness([out[index], out[index + 1], out[index + 2]]);
    if (l >= 0.18) { low = Math.min(low, l); high = Math.max(high, l); }
  }
  for (let index = 0; index < out.length; index += 4) {
    if (!out[index + 3]) continue;
    const l = lightness([out[index], out[index + 1], out[index + 2]]);
    if (l < 0.18) continue;
    const color = colors[Math.min(3, Math.max(0, Math.round(((l - low) / (high - low || 1)) * 3)))];
    out[index] = color[0]; out[index + 1] = color[1]; out[index + 2] = color[2];
  }
  return out;
}

export type HeadView = 'side' | 'front' | 'dance';
export interface HeadAnchor { angle: number; x: number; y: number; view?: HeadView; floor?: number }
export interface HeadAnchors { center: [number, number]; frontCenter?: [number, number]; danceCenter?: [number, number]; cells: Record<string, HeadAnchor | null> }

export function compositeOverlay(atlas: Uint8ClampedArray, width: number, overlay: Uint8ClampedArray, anchors: HeadAnchors, view: HeadView = 'side') {
  const [centerX, centerY] = (view === 'front' ? anchors.frontCenter : view === 'dance' ? anchors.danceCenter : null) ?? anchors.center;
  for (const [key, anchor] of Object.entries(anchors.cells)) {
    if (!anchor || (anchor.view ?? 'side') !== view) continue;
    const index = Number(key), cellX = (index % (width / 64)) * 64, cellY = Math.floor(index / (width / 64)) * 64;
    if ((cellY + 64) * width * 4 > atlas.length) continue;
    const radians = -anchor.angle * Math.PI / 180, cos = Math.cos(radians), sin = Math.sin(radians);
    const bottom = Math.min(63, anchor.floor ?? 63);
    for (let y = 0; y <= bottom; y++) for (let x = 0; x < 64; x++) {
      const dx = x - anchor.x, dy = y - anchor.y;
      const sx = Math.round(centerX + dx * cos - dy * sin), sy = Math.round(centerY + dx * sin + dy * cos);
      if (sx < 0 || sy < 0 || sx > 63 || sy > 63) continue;
      const source = (sy * 64 + sx) * 4;
      if (!overlay[source + 3]) continue;
      atlas.set(overlay.subarray(source, source + 4), ((cellY + y) * width + cellX + x) * 4);
    }
  }
  return atlas;
}

export function avatarFromUsername(username: string): Avatar {
  let hash = 2166136261;
  for (const char of username.toLowerCase()) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  const pick = <T,>(options: readonly T[]) => { const value = options[hash % options.length]; hash = Math.imul(hash ^ (hash >>> 13), 2246822519) >>> 0; return value; };
  const cloth = Object.keys(CLOTH_RAMPS);
  return {
    outfit: pick(AVATAR_OUTFITS), hair: pick(['krotkie', 'krotkie', 'irokez', 'kucyk', 'brak'] as const), hat: pick(['brak', 'brak', 'brak', 'czapka', 'daszek'] as const), pose: 'przod',
    colors: { skin: pick(Object.keys(SKIN_RAMPS)), hair: pick(Object.keys(HAIR_RAMPS)), top: pick(cloth), bottom: pick(cloth), shoes: pick(cloth), hat: pick(cloth) },
  };
}

export function toAvatarConfig(avatar: Avatar): AvatarConfig {
  return { outfit: avatar.outfit, hair: avatar.hair, hat: avatar.hat, skin: avatar.colors.skin, hairColor: avatar.colors.hair,
    topColor: avatar.colors.top, bottomColor: avatar.colors.bottom, shoesColor: avatar.colors.shoes, hatColor: avatar.colors.hat, pose: avatar.pose };
}

export function fromAvatarConfig(config: AvatarConfig | null | undefined): Avatar | null {
  if (!config) return null;
  const valid = (AVATAR_OUTFITS as readonly string[]).includes(config.outfit) && (HAIR_STYLES as readonly string[]).includes(config.hair)
    && (HAT_STYLES as readonly string[]).includes(config.hat) && isColorChoice(SKIN_RAMPS, config.skin) && isColorChoice(HAIR_RAMPS, config.hairColor)
    && [config.topColor, config.bottomColor, config.shoesColor, config.hatColor].every(color => isColorChoice(CLOTH_RAMPS, color));
  if (!valid) return null;
  return { outfit: config.outfit as AvatarOutfit, hair: config.hair as HairStyle, hat: config.hat as HatStyle, pose: toPose(config.pose),
    colors: { skin: config.skin, hair: config.hairColor, top: config.topColor, bottom: config.bottomColor, shoes: config.shoesColor, hat: config.hatColor } };
}
