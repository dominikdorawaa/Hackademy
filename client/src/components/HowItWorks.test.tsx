import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import HowItWorks from './HowItWorks';

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
});
afterEach(() => vi.unstubAllGlobals());

it('illustrates the three steps with animated pixel icons', () => {
  render(<HowItWorks />);
  expect(screen.getByRole('heading', { name: 'Wybierz Pokój' })).toBeInTheDocument();
  const sprites = [...document.querySelectorAll<HTMLElement>('.step-icon-pixel .pixel-sprite')];
  expect(sprites.map(sprite => sprite.style.getPropertyValue('--sprite'))).toEqual([
    'url(/assets/pixel/step-room.png)', 'url(/assets/pixel/step-puzzle.png)', 'url(/assets/pixel/step-trophy.png)',
  ]);
  expect(document.querySelector('.fa-door-open')).toBeNull();
});
