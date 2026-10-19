import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const portraits = vi.hoisted(() => ({ requested: [] as unknown[] }));
vi.mock('./arena/avatar/useAvatarAtlas', () => ({
  useAvatarPortrait: (config: { outfit: string } | null | undefined) => {
    portraits.requested.push(config);
    return config?.outfit === 'bluza' ? 'blob:portrait' : config?.outfit === 'baza' ? null : 'blob:generated';
  },
}));

import UserAvatar from './UserAvatar';
import { avatarFromUsername, fromAvatarConfig, toAvatarConfig } from './arena/avatar/avatarModel';
import type { AvatarConfig } from '../types/api';

const avatar: AvatarConfig = { outfit: 'bluza', hair: 'irokez', hat: 'brak', skin: 'jasna', hairColor: 'rude', topColor: 'bialy', bottomColor: 'granatowy', shoesColor: 'czerwony', hatColor: 'bialy' };

describe('user avatars', () => {
  it('shows the pixel portrait of a saved avatar', () => {
    render(<UserAvatar username="tester" avatar={avatar} className="round" style={{ width: 40 }} />);
    const image = screen.getByRole('img', { name: 'Avatar tester' });
    expect(image).toHaveAttribute('src', 'blob:portrait');
    expect(image).toHaveAttribute('data-avatar', 'custom');
    expect(image).toHaveClass('round');
    expect(image).toHaveStyle({ width: '40px', imageRendering: 'pixelated' });
  });

  it('draws an account without a saved avatar from the Hackademy avatar system, never from DiceBear', () => {
    const view = render(<UserAvatar username="nowy gracz" alt="Ty" />);
    expect(portraits.requested.at(-1)).toEqual(toAvatarConfig(avatarFromUsername('nowy gracz')));
    view.rerender(<UserAvatar username="nowy gracz" avatar={{ ...avatar, outfit: 'pirat' }} alt="Ty" />);
    expect(portraits.requested.at(-1)).toEqual(toAvatarConfig(avatarFromUsername('nowy gracz')));
    expect(screen.getByRole('img', { name: 'Ty' }).getAttribute('src')).not.toContain('dicebear');
  });

  it('keeps a local placeholder while the portrait is drawn', () => {
    render(<UserAvatar username="abby" avatar={{ ...avatar, outfit: 'baza' }} />);
    const image = screen.getByRole('img', { name: 'Avatar abby' });
    expect(image).toHaveAttribute('data-avatar', 'loading');
    expect(image.getAttribute('src')).toMatch(/^data:image\/svg\+xml,/);
    expect(decodeURIComponent(image.getAttribute('src')!)).toContain('>AB<');
  });

  it('gives every name a stable, valid look', () => {
    for (const name of ['alice', 'Bob', 'zażółć', 'x', 'CyberNinja']) {
      const look = avatarFromUsername(name);
      expect(avatarFromUsername(name)).toEqual(look);
      expect(avatarFromUsername(name.toUpperCase())).toEqual(look);
      expect(fromAvatarConfig(toAvatarConfig(look))).toEqual(look);
    }
    const looks = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(name => JSON.stringify(avatarFromUsername(name))));
    expect(looks.size).toBeGreaterThan(4);
  });
});
