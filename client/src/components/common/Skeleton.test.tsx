import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { LoadingSkeleton, Skeleton, SkeletonText } from './Skeleton';

it('announces the loading region by its label and hides the placeholder shapes', () => {
  render(<LoadingSkeleton label="Ładowanie ścieżek" className="paths-grid">
    <Skeleton width={120} height={20} radius={4} />
    <SkeletonText lines={3} />
  </LoadingSkeleton>);
  const region = screen.getByRole('status', { name: 'Ładowanie ścieżek' });
  expect(region).not.toHaveAttribute('aria-busy');
  expect(region).toHaveClass('hk-skeleton-group', 'paths-grid');
  expect(region).toHaveTextContent('Ładowanie ścieżek');
  const shapes = region.querySelectorAll('[data-skeleton]');
  expect(shapes).toHaveLength(4);
  shapes.forEach(shape => expect(shape.closest('[aria-hidden="true"]')).not.toBeNull());
  expect(region.querySelectorAll('a, button, input, [tabindex]')).toHaveLength(0);
});

it('sizes blocks and shortens the last line of text', () => {
  render(<LoadingSkeleton label="Ładowanie" as="span"><Skeleton className="ud-skel-next" width="50%" height={48} radius="50%" /><SkeletonText lines={2} className="extra" /></LoadingSkeleton>);
  const region = screen.getByRole('status');
  expect(region.tagName).toBe('SPAN');
  const [block, first, last] = region.querySelectorAll<HTMLElement>('[data-skeleton]');
  expect(block).toHaveClass('hk-skeleton', 'ud-skel-next');
  expect(block.style).toMatchObject({ width: '50%', height: '48px', borderRadius: '50%' });
  expect(first.style.width).toBe('100%');
  expect(last.style.width).toBe('60%');
  expect(region.querySelector('.hk-skeleton-text')).toHaveClass('extra');
});

it('marks the documented surface for each block', () => {
  const { container } = render(<><Skeleton /><Skeleton tone="raised" /><Skeleton tone="wash" /></>);
  expect([...container.querySelectorAll('[data-skeleton]')].map(block => block.getAttribute('data-tone'))).toEqual(['surface', 'raised', 'wash']);
});

it('keeps a single text line at full width', () => {
  const { container } = render(<SkeletonText lines={1} />);
  expect(container.querySelector<HTMLElement>('[data-skeleton]')!.style.width).toBe('100%');
  expect(container.querySelector('.hk-skeleton-text')).toHaveAttribute('aria-hidden', 'true');
});
