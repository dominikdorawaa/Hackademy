import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import DyzurZeroBanner from './DyzurZeroBanner';

it('keeps decorative animation layers on the same native canvas as the banner', () => {
  const { container } = render(<DyzurZeroBanner />);
  const images = container.querySelectorAll('img');
  expect(images).toHaveLength(7);
  for (const image of images) {
    expect(image).toHaveAttribute('width', '320');
    expect(image).toHaveAttribute('height', '120');
    expect(image).toHaveAttribute('alt', '');
  }
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});

it('retains the title and frame class when used in the course hero', () => {
  const { container } = render(<DyzurZeroBanner className="zero-hero-art"><h1>Dyżur Zero</h1></DyzurZeroBanner>);
  expect(screen.getByRole('heading', { name: 'Dyżur Zero' })).toBeInTheDocument();
  expect(container.firstChild).toHaveClass('zero-hero-art');
});
