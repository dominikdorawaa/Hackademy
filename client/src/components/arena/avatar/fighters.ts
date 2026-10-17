import type { AvatarOutfit } from './avatarModel';

export type FinisherMove = 'beam' | 'combo';
export interface AvatarAtlasSource { atlas: string; atlasHeight: number; dances: { groove: number; sixseven: number }; run: number; finishers: Record<FinisherMove, number> }

const BASE = '/assets/arena/avatar-v1/';
const DANCES = { groove: 6, sixseven: 8 };
const RUN = 10;
const FINISHERS: Record<FinisherMove, number> = { beam: 2, combo: 11 };

export const AVATAR_ATLASES: Record<AvatarOutfit, AvatarAtlasSource> = {
  baza: { atlas: `${BASE}fighter.png`, atlasHeight: 832, dances: DANCES, run: RUN, finishers: FINISHERS },
  bluza: { atlas: `${BASE}hoodie/fighter.png`, atlasHeight: 832, dances: DANCES, run: RUN, finishers: FINISHERS },
  dres: { atlas: `${BASE}track/fighter.png`, atlasHeight: 832, dances: DANCES, run: RUN, finishers: FINISHERS },
};

export function atlasViewBox(index: number) {
  return `${index % 9 * 64} ${Math.floor(index / 9) * 64} 64 64`;
}

export const danceFrames = (row: number) => [row, row + 1].flatMap(line => Array.from({ length: 8 }, (_, column) => line * 9 + column + 1));
export const runFrames = (row: number) => Array.from({ length: 8 }, (_, column) => row * 9 + column + 1);
export const RUN_FRAME_TIME = 90;
