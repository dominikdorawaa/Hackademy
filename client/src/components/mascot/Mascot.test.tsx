import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DANCE_MS, Mascot } from './Mascot';

afterEach(() => vi.useRealTimers());

it('keeps the existing interactive dance and returns to its original mood', () => {
  vi.useFakeTimers();
  const view = render(<Mascot mood="calm" className="companion" />);
  fireEvent.click(screen.getByRole('button', { name: 'Pingwin Bit, zatańcz' }));
  expect(document.querySelector('.mascot')).toHaveAttribute('data-mood', 'scuba');
  act(() => vi.advanceTimersByTime(DANCE_MS));
  expect(document.querySelector('.companion')).toHaveAttribute('data-mood', 'calm');
  fireEvent.click(screen.getByRole('button', { name: 'Pingwin Bit, zatańcz' }));
  view.unmount();
  act(() => vi.runOnlyPendingTimers());
  expect(vi.getTimerCount()).toBe(0);
});

it('animates a decorative mascot without exposing a focus target and can remain static', () => {
  const view = render(<Mascot mood="walkSide" interactive={false} />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(document.querySelector('.mascot')).toHaveAttribute('data-mood', 'walkSide');
  expect(document.querySelector('.pixel-sprite')).toHaveAttribute('data-still', 'false');
  view.rerender(<Mascot still />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(document.querySelector('.pixel-sprite')).toHaveAttribute('data-still', 'true');
});
