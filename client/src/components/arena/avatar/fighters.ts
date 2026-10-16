import type { AvatarOutfit } from './avatarModel';

export interface AvatarAtlasSource { atlas: string; atlasHeight: number; dances: { groove: number; sixseven: number } }

const BASE = '/assets/arena/avatar-v1/';
const DANCES = { groove: 6, sixseven: 8 };

export const AVATAR_ATLASES: Record<AvatarOutfit, AvatarAtlasSource> = {
  baza: { atlas: `${BASE}fighter.png`, atlasHeight: 640, dances: DANCES },
  bluza: { atlas: `${BASE}hoodie/fighter.png`, atlasHeight: 640, dances: DANCES },
  dres: { atlas: `${BASE}track/fighter.png`, atlasHeight: 640, dances: DANCES },
};

export function atlasViewBox(index: number) {
  return `${index % 9 * 64} ${Math.floor(index / 9) * 64} 64 64`;
}

export const danceFrames = (row: number) => [row, row + 1].flatMap(line => Array.from({ length: 8 }, (_, column) => line * 9 + column + 1));
