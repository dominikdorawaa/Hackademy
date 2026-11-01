import type { DifficultyLevel } from '../../types/api';

export const roomsPath = '/admin/paths/rooms';

export const pointsForDifficulty: Record<DifficultyLevel, number> = {
  EASY: 50,
  MEDIUM: 100,
  HARD: 150,
  INSANE: 200,
};

export const reservedRoomTitles = ['tutorial vm', 'tutorial vpn'];
