import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./arena/avatar/useAvatarAtlas', () => ({ useAvatarPortrait: (config: { outfit: string } | null | undefined) => config?.outfit === 'bluza' ? 'blob:portrait' : null }));

import UserAvatar from './UserAvatar';
import type { AvatarConfig } from '../types/api';

const avatar: AvatarConfig = { outfit: 'bluza', hair: 'irokez', hat: 'brak', skin: 'jasna', hairColor: 'rude', topColor: 'bialy', bottomColor: 'granatowy', shoesColor: 'czerwony', hatColor: 'bialy' };

describe('user avatars', () => {
  it('uses the saved seed, falls back on API failure and retries a newly selected avatar', () => {
    const view = render(<UserAvatar username="test user" seed="chosen & seed" />);
    const avatar = screen.getByRole('img', { name: 'Avatar test user' });
    expect(avatar).toHaveAttribute('src', expect.stringContaining('chosen%20%26%20seed'));
    fireEvent.error(avatar);
    expect(avatar).toHaveAttribute('src', expect.stringContaining('data:image/svg+xml,'));
    view.rerender(<UserAvatar username="test user" seed="another-seed" />);
    expect(avatar).toHaveAttribute('src', expect.stringContaining('seed=another-seed'));
  });

  it('shows the pixel portrait of a saved avatar and keeps the generated one as a fallback', () => {
    const view = render(<UserAvatar username="tester" seed="seed" avatar={avatar} className="round" style={{ width: 40 }} />);
    const image = screen.getByRole('img', { name: 'Avatar tester' });
    expect(image).toHaveAttribute('src', 'blob:portrait');
    expect(image).toHaveAttribute('data-avatar', 'custom');
    expect(image).toHaveClass('round');
    expect(image).toHaveStyle({ width: '40px', imageRendering: 'pixelated' });
    view.rerender(<UserAvatar username="tester" seed="seed" avatar={{ ...avatar, outfit: 'dres' }} alt="Ty" />);
    expect(screen.getByRole('img', { name: 'Ty' })).toHaveAttribute('src', expect.stringContaining('seed=seed'));
  });
});
