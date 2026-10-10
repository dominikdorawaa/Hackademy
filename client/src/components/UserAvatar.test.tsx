import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import UserAvatar from './UserAvatar';

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
});
