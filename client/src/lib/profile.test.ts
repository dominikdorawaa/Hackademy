import { describe, expect, it } from 'vitest';
import { profileCompletion } from './profile';

const empty = { bio: '', tagline: '', interests: [], featuredBadgeIds: [] };

describe('profile completion', () => {
  it('counts each filled element and ignores whitespace-only bios', () => {
    expect(profileCompletion({ customAvatar: false, profile: { ...empty, bio: '   ' }, canFeature: true }).percent).toBe(0);
    const half = profileCompletion({ customAvatar: true, profile: { ...empty, bio: 'Hej' }, canFeature: true });
    expect(half.percent).toBe(50);
    expect(half.steps).toEqual([
      { label: 'Awatar', done: true }, { label: 'Opis', done: true },
      { label: 'Zainteresowania', done: false }, { label: 'Gablota odznak', done: false },
    ]);
  });

  it('leaves out the showcase until there is an earned badge to show', () => {
    const result = profileCompletion({ customAvatar: true, profile: { ...empty, bio: 'Hej', interests: ['WEB'] }, canFeature: false });
    expect(result.steps.map(step => step.label)).toEqual(['Awatar', 'Opis', 'Zainteresowania']);
    expect(result.percent).toBe(100);
  });
});
