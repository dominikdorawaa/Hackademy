import { describe, expect, it } from 'vitest';
import { peekBadges } from './ProfilePeek';
import type { BadgeDto, UserProfileDto } from '../types/api';

const badge = (id: number, rarityPercentage: number, earned = true): BadgeDto => ({ id, name: `b${id}`, description: '',
  icon: '', earned, earnedAt: null, rarityPercentage });
const profile = (badges: BadgeDto[], featuredBadgeIds?: number[]) => ({ badges, featuredBadgeIds } as UserProfileDto);

describe('badges shown in the profile peek', () => {
  it('puts featured badges first and fills up with the rarest earned ones', () => {
    const badges = [badge(1, 80), badge(2, 5), badge(3, 40), badge(4, 1, false), badge(5, 20)];
    expect(peekBadges(profile(badges, [3])).map(b => b.id)).toEqual([3, 2, 5]);
  });

  it('ignores featured ids that are not earned', () => {
    expect(peekBadges(profile([badge(1, 50), badge(2, 9, false)], [2])).map(b => b.id)).toEqual([1]);
  });
});
