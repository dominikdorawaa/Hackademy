import type { ArenaQuestionCategory } from '../../types/api';

export const arenaCategoryLabels: Record<ArenaQuestionCategory, string> = {
  WEB: 'Web',
  SIECI: 'Sieci',
  KRYPTOGRAFIA: 'Kryptografia',
  LINUX: 'Linux',
  OGOLNE: 'Ogólne',
  WINDOWS: 'Windows i Active Directory',
  BLUE_TEAM: 'Blue Team',
  CHMURA: 'Chmura',
};

export const arenaCategories = Object.keys(arenaCategoryLabels) as ArenaQuestionCategory[];

export function arenaCategoryLabel(category: string): string {
  return arenaCategoryLabels[category as ArenaQuestionCategory] ?? category;
}
