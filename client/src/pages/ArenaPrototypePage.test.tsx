import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../context/ThemeContext';
import ArenaPrototypePage from './ArenaPrototypePage';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
const mount = () => render(<MemoryRouter><ThemeProvider><ArenaPrototypePage /></ThemeProvider></MemoryRouter>);
const hp = (name: string) => screen.getByRole('meter', { name: `HP: ${name}` });
const finish = () => act(() => vi.advanceTimersByTime(1000));

it('previews hits from both sides, locks controls during play and resets HP', () => {
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Trafienie' }));
  expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Trafienie' })).toBeDisabled();
  finish();
  expect(hp('Iskra')).toHaveAttribute('aria-valuenow', '80');
  fireEvent.click(screen.getByRole('radio', { name: 'Iskra' }));
  fireEvent.click(screen.getByRole('button', { name: 'Trafienie' }));
  finish();
  expect(hp('Bajt')).toHaveAttribute('aria-valuenow', '80');
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
  expect(hp('Bajt')).toHaveAttribute('aria-valuenow', '100');
  expect(hp('Iskra')).toHaveAttribute('aria-valuenow', '100');
});

it('leaves both HP unchanged when answers are correct and permits another round', () => {
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Zderzenie pocisków' }));
  finish();
  expect(hp('Bajt')).toHaveAttribute('aria-valuenow', '100');
  expect(hp('Iskra')).toHaveAttribute('aria-valuenow', '100');
  expect(screen.getByRole('status')).toHaveTextContent('HP bez zmian');
  expect(screen.getByRole('button', { name: 'Trafienie' })).toBeEnabled();
});

it.each(['Bajt', 'Iskra'])('previews defeat with %s attacking and requires reset afterwards', name => {
  mount();
  fireEvent.click(screen.getByRole('radio', { name }));
  fireEvent.click(screen.getByRole('button', { name: 'Porażka' }));
  finish();
  expect(hp(name === 'Bajt' ? 'Iskra' : 'Bajt')).toHaveAttribute('aria-valuenow', '0');
  expect(screen.getByRole('status')).toHaveTextContent(`${name} wygrywa`);
  expect(screen.getByRole('button', { name: 'Trafienie' })).toBeDisabled();
});

it('offers six faces for each fighter and resets the scene when the avatar changes', () => {
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Trafienie' }));
  finish();
  const picker = screen.getByRole('combobox', { name: 'Avatar: Bajt' });
  expect(picker.querySelectorAll('option')).toHaveLength(6);
  fireEvent.change(picker, { target: { value: 'prototype-foxtrot' } });
  expect(hp('Iskra')).toHaveAttribute('aria-valuenow', '100');
});

it('respects the app reduced-motion preference', () => {
  localStorage.setItem('app-reduced-motion', 'true');
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Trafienie' }));
  act(() => vi.advanceTimersByTime(120));
  expect(hp('Iskra')).toHaveAttribute('aria-valuenow', '80');
  expect(screen.getByRole('button', { name: 'Trafienie' })).toBeEnabled();
  expect(screen.getByText(/Ograniczenie animacji jest włączone/)).toBeInTheDocument();
});

it('responds to operating-system motion changes and cleans up its listener', () => {
  let change: (() => void) | undefined;
  const query = { matches: false, addEventListener: vi.fn((_event: string, callback: () => void) => { change = callback; }), removeEventListener: vi.fn() };
  vi.stubGlobal('matchMedia', vi.fn(() => query));
  const { unmount } = mount();
  query.matches = true;
  act(() => change!());
  expect(screen.getByText(/Ograniczenie animacji jest włączone/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Zderzenie pocisków' }));
  act(() => vi.advanceTimersByTime(120));
  expect(screen.getByRole('button', { name: 'Trafienie' })).toBeEnabled();
  unmount();
  expect(query.removeEventListener).toHaveBeenCalledWith('change', change);
});

it('ends at zero HP after repeated hits and ignores further attacks until reset', () => {
  mount();
  for (let round = 0; round < 5; round++) {
    fireEvent.click(screen.getByRole('button', { name: 'Trafienie' }));
    finish();
  }
  expect(hp('Iskra')).toHaveAttribute('aria-valuenow', '0');
  expect(screen.getByRole('status')).toHaveTextContent('Bajt wygrywa');
  fireEvent.click(screen.getByRole('button', { name: 'Trafienie' }));
  finish();
  expect(hp('Iskra')).toHaveAttribute('aria-valuenow', '0');
  expect(screen.getByRole('button', { name: 'Reset' })).toBeEnabled();
});
