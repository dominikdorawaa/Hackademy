import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ProfileSaveNotification from './ProfileSaveNotification';

afterEach(() => vi.useRealTimers());

it('announces success without taking focus and dismisses after five seconds', () => {
  vi.useFakeTimers();
  const onClose = vi.fn();
  render(<><button autoFocus>Edytuj profil</button><ProfileSaveNotification onClose={onClose} /></>);
  expect(screen.getByRole('status')).toHaveTextContent('Profil zapisany');
  expect(screen.getByRole('button', { name: 'Edytuj profil' })).toHaveFocus();
  act(() => vi.advanceTimersByTime(4999));
  expect(onClose).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(onClose).toHaveBeenCalledOnce();
});

it('allows explicit dismissal with an accessible button', () => {
  const onClose = vi.fn();
  render(<ProfileSaveNotification onClose={onClose} />);
  fireEvent.click(screen.getByRole('button', { name: 'Zamknij powiadomienie o zapisie profilu' }));
  expect(onClose).toHaveBeenCalledOnce();
});

it('cancels dismissal when removed and starts a fresh timer for the next notification', () => {
  vi.useFakeTimers();
  const onClose = vi.fn();
  const first = render(<ProfileSaveNotification onClose={onClose} />);
  act(() => vi.advanceTimersByTime(4000));
  first.unmount();
  render(<ProfileSaveNotification onClose={onClose} />);
  act(() => vi.advanceTimersByTime(1000));
  expect(onClose).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(4000));
  expect(onClose).toHaveBeenCalledOnce();
});
