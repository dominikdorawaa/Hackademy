import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import LandingDuel, { DUEL_FIGHTERS } from './LandingDuel';

vi.mock('./arena/avatar/useAvatarAtlas', () => ({ useAvatarAtlas: () => ({ atlas: 'blob:atlas', front: null }) }));

it('shows two pixel fighters trading a blow in step', () => {
  render(<LandingDuel />);
  expect(screen.getByRole('img', { name: 'Twój awatar wyprowadza cios' })).toHaveAttribute('data-frame', '0');
  expect(screen.getByRole('img', { name: 'Awatar rywala przyjmuje cios' })).toBeInTheDocument();
  expect(screen.getByText('VS')).toBeInTheDocument();
  const [me, rival] = DUEL_FIGHTERS;
  expect(me.frames).toHaveLength(rival.frames.length);
  expect(me.frames.indexOf(10)).toBeLessThan(rival.frames.indexOf(37));
  expect(document.querySelector('.landing-fighter.is-rival')).toHaveAttribute('data-ready', 'true');
});
