import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../context/ThemeContext';
import PixelLabPreviewPage from './PixelLabPreviewPage';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
const mount = () => render(<MemoryRouter><ThemeProvider><PixelLabPreviewPage /></ThemeProvider></MemoryRouter>);
const preview = () => screen.getByAltText('Podgląd ataku energetyczną rękawicą');

it('shows the reference and all eight saved frames without requesting generation', () => {
  mount();
  expect(screen.getAllByRole('img')).toHaveLength(10);
  expect(preview()).toHaveAttribute('src', '/assets/arena/pixellab/bajt-idle.png');
  expect(screen.getByRole('link')).toHaveAttribute('href', '/arena/prototype');
});

it('plays each frame once and returns to the reference after the last frame', () => {
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Odtwórz atak' }));
  expect(screen.getByRole('button', { name: 'Odtwórz atak' })).toBeDisabled();
  for (let index = 0; index < 8; index++) {
    expect(preview()).toHaveAttribute('src', `/assets/arena/pixellab/bajt-attack-${index}.png`);
    act(() => vi.advanceTimersByTime(110));
  }
  expect(preview()).toHaveAttribute('src', '/assets/arena/pixellab/bajt-idle.png');
  expect(screen.getByRole('button', { name: 'Odtwórz atak' })).toBeEnabled();
});

it('stops and cancels the remaining frames', () => {
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Odtwórz atak' }));
  act(() => vi.advanceTimersByTime(110));
  fireEvent.click(screen.getByRole('button', { name: 'Zatrzymaj' }));
  act(() => vi.advanceTimersByTime(1000));
  expect(preview()).toHaveAttribute('src', '/assets/arena/pixellab/bajt-idle.png');
  expect(screen.getByRole('button', { name: 'Zatrzymaj' })).toBeDisabled();
});

it('exposes static frames with reduced motion', () => {
  localStorage.setItem('app-reduced-motion', 'true');
  mount();
  expect(screen.getByRole('button', { name: 'Odtwórz atak' })).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('Ograniczenie animacji');
  expect(screen.getAllByRole('img')).toHaveLength(10);
});

it('stops playback on system preference changes and removes the listener on exit', () => {
  let change: (() => void) | undefined;
  const query = { matches: false, addEventListener: vi.fn((_event: string, callback: () => void) => { change = callback; }), removeEventListener: vi.fn() };
  vi.stubGlobal('matchMedia', vi.fn(() => query));
  const { unmount } = mount();
  fireEvent.click(screen.getByRole('button', { name: 'Odtwórz atak' }));
  query.matches = true;
  act(() => change!());
  expect(screen.getByRole('button', { name: 'Odtwórz atak' })).toBeDisabled();
  expect(preview()).toHaveAttribute('src', '/assets/arena/pixellab/bajt-idle.png');
  unmount();
  expect(query.removeEventListener).toHaveBeenCalledWith('change', change);
});
