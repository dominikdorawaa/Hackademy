import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { PixelSprite, SPRITES } from './PixelSprite';

it('plays a scaled sprite sheet and can hold the first frame', () => {
  const { container, rerender } = render(<PixelSprite sprite={SPRITES.flag} scale={2} duration={900} className="extra" />);
  const sprite = container.querySelector('.pixel-sprite') as HTMLElement;
  expect(sprite).toHaveClass('extra');
  expect(sprite).toHaveAttribute('aria-hidden', 'true');
  expect(sprite).toHaveAttribute('data-still', 'false');
  expect(sprite.style.getPropertyValue('--sprite')).toBe('url(/assets/pixel/capture-flag.png)');
  expect(sprite.style.getPropertyValue('--sprite-frames')).toBe('8');
  expect(sprite.style.getPropertyValue('--sprite-width')).toBe('56px');
  expect(sprite.style.getPropertyValue('--sprite-height')).toBe('88px');
  expect(sprite.style.getPropertyValue('--sprite-duration')).toBe('900ms');
  rerender(<PixelSprite sprite={SPRITES.flame} still />);
  expect(container.querySelector('.pixel-sprite')).toHaveAttribute('data-still', 'true');
  expect(container.querySelector('.pixel-sprite')).toHaveAttribute('class', 'pixel-sprite');
});
