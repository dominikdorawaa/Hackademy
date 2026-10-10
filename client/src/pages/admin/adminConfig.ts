import type { DifficultyLevel, RoomType } from '../../types/api';

export const roomBasePath: Record<RoomType, string> = {
  CTF: '/admin/ctf',
  PATH: '/admin/paths/rooms',
};

export const pointsForDifficulty: Record<DifficultyLevel, number> = {
  EASY: 50,
  MEDIUM: 100,
  HARD: 150,
  INSANE: 200,
};
