import type { ActivityDto, BadgeDto, RecentSolvedRoomDto, UserProfileDto } from '../../types/api';
import { localDateKey } from '../../lib/activity';
import { createUser } from './auth';

export const profileUser = {
  ...createUser(),
  points: 1250,
  streak: 4,
  bio: 'Uczę się bezpieczeństwa aplikacji webowych.',
};
export const profileBadges: BadgeDto[] = Array.from({ length: 8 }, (_, index) => ({
  id: index + 1,
  name: `Odznaka ${index + 1}`,
  description: `Opis odznaki ${index + 1}`,
  icon: 'fas fa-flag',
  earned: index < 7,
  earnedAt: index < 7 ? `2026-01-${String(index + 1).padStart(2, '0')}T12:00:00` : null,
  rarityPercentage: 12.5,
}));
export const publicProfile: UserProfileDto = {
  username: 'friend',
  points: 250,
  role: 'USER',
  createdAt: profileUser.createdAt,
  streak: 2,
  bio: 'Ćwiczę analizę ruchu sieciowego.',
  badges: profileBadges,
};
export const recentSolved: RecentSolvedRoomDto[] = Array.from({ length: 20 }, (_, index) => ({
  roomId: index + 1,
  title: `Pokój ${index + 1}`,
  difficulty: index === 0 ? 'INSANE' : 'EASY',
  points: 50,
  solvedAt: `2026-01-${String(25 - index).padStart(2, '0')}T12:00:00`,
}));
export const profileActivity: ActivityDto[] = [{ date: localDateKey(new Date()), count: 2 }];
