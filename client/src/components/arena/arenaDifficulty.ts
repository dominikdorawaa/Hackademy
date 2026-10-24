import type { ArenaQuestionDifficulty } from '../../types/api';

export const arenaDifficultyLabels: Record<ArenaQuestionDifficulty, string> = {
  VERY_EASY: 'Bardzo łatwy',
  EASY: 'Łatwy',
  MEDIUM: 'Średni',
  HARD: 'Trudny',
  VERY_HARD: 'Bardzo trudny',
};

export const arenaDifficulties = Object.keys(arenaDifficultyLabels) as ArenaQuestionDifficulty[];
