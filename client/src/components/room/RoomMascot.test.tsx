import { act, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from '../../context/ThemeContext';
import RoomMascot, { RoomMascotContext } from './RoomMascot';

let width = 400;
let resize: ResizeObserverCallback;
const disconnect = vi.fn();
let mediaChange: () => void;
let systemReduced = false;
const random = vi.fn(() => 0);
const zone = () => document.querySelector('.room-mascot-zone')!;
const actor = () => document.querySelector('.room-mascot-actor') as HTMLElement;
const next = () => act(() => vi.advanceTimersToNextTimer());
const content = (successCount = 0, paused = false) => <RoomMascotContext.Provider value={{ successCount, paused }}><input aria-label="Odpowiedź" /><RoomMascot /></RoomMascotContext.Provider>;

beforeEach(() => {
  vi.useFakeTimers();
  width = 400;
  systemReduced = false;
  document.documentElement.removeAttribute('data-reduced-motion');
  vi.spyOn(Math, 'random').mockImplementation(random);
  random.mockReturnValue(0);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) { return this.classList.contains('room-mascot-track') ? width : 0; });
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: ResizeObserverCallback) { resize = callback; }
    observe() {}
    disconnect = disconnect;
  });
  vi.stubGlobal('matchMedia', () => ({ matches: systemReduced, addEventListener: (_: string, callback: () => void) => { mediaChange = callback; }, removeEventListener: vi.fn() }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('reserves a decorative noninteractive zone and never changes input focus', () => {
  render(content());
  const input = screen.getByRole('textbox', { name: 'Odpowiedź' });
  input.focus();
  expect(zone()).toHaveAttribute('data-state', 'idle');
  expect(zone()).toHaveAttribute('aria-hidden', 'true');
  expect(zone().querySelector('button, input, a, [tabindex]')).toBeNull();
  act(() => vi.advanceTimersByTime(14_000));
  expect(zone()).toHaveAttribute('data-state', 'right');
  expect(input).toHaveFocus();
  fireEvent.change(input, { target: { value: 'pwd' } });
  expect(input).toHaveValue('pwd');
});

it.each([[0, 'right'], [.3, 'left'], [.6, 'wave'], [.9, 'look']] as const)('performs short varied animations (%s) with quiet gaps', (choice, action) => {
  random.mockReturnValue(choice);
  render(content());
  act(() => vi.advanceTimersByTime(13_999));
  expect(zone()).toHaveAttribute('data-state', 'idle');
  next();
  expect(zone()).toHaveAttribute('data-state', action);
  if (action === 'left' || action === 'right') {
    const target = parseFloat(actor().style.getPropertyValue('--bit-to'));
    expect(target).toBeGreaterThanOrEqual(0);
    expect(target).toBeLessThanOrEqual(100);
  }
  next();
  expect(zone()).toHaveAttribute('data-state', 'idle');
  act(() => vi.advanceTimersByTime(13_999));
  expect(zone()).toHaveAttribute('data-state', 'idle');
});

it('stays in place in a narrow zone and stops a walk when its track shrinks', () => {
  render(content());
  next();
  expect(zone()).toHaveAttribute('data-state', 'right');
  width = 20;
  act(() => resize([], {} as ResizeObserver));
  expect(zone()).toHaveAttribute('data-state', 'idle');
  next();
  expect(zone()).toHaveAttribute('data-state', 'wave');
});

it('ends walks at the boundary and switches to waving when there is no walking distance left', () => {
  render(content());
  next();
  next();
  next();
  next();
  next();
  next();
  next();
  expect(zone()).toHaveAttribute('data-state', 'wave');
  expect(actor().style.getPropertyValue('--bit-to')).toBe('100%');
});

it('takes success over a walk, freezes its current position and drops the old random timer', () => {
  const view = render(content());
  next();
  actor().style.left = '80px';
  view.rerender(content(1));
  expect(zone()).toHaveAttribute('data-state', 'jump');
  expect(actor().style.getPropertyValue('--bit-to')).toBe('20%');
  act(() => vi.advanceTimersByTime(640));
  expect(zone()).toHaveAttribute('data-state', 'idle');
  act(() => vi.advanceTimersByTime(1800));
  expect(zone()).toHaveAttribute('data-state', 'idle');
  view.rerender(content(1));
  expect(zone()).toHaveAttribute('data-state', 'idle');
});

it('reacts once to each fresh completion without replaying initial or repeated counters', () => {
  const view = render(<StrictMode>{content(4)}</StrictMode>);
  expect(zone()).toHaveAttribute('data-state', 'idle');
  view.rerender(<StrictMode>{content(5)}</StrictMode>);
  expect(zone()).toHaveAttribute('data-state', 'jump');
  const reaction = zone().getAttribute('data-reaction');
  view.rerender(<StrictMode>{content(6)}</StrictMode>);
  expect(zone()).toHaveAttribute('data-reaction', reaction);
  act(() => vi.advanceTimersByTime(640));
  expect(zone()).toHaveAttribute('data-state', 'jump');
  expect(zone()).not.toHaveAttribute('data-reaction', reaction);
  act(() => vi.advanceTimersByTime(640));
  expect(zone()).toHaveAttribute('data-state', 'idle');
  view.rerender(<StrictMode>{content(6)}</StrictMode>);
  expect(zone()).toHaveAttribute('data-state', 'idle');
});

it('holds success until a dialog closes and does not queue random moves behind it', () => {
  const view = render(content(0, true));
  view.rerender(content(1, true));
  act(() => vi.advanceTimersByTime(90_000));
  expect(zone()).toHaveAttribute('data-state', 'idle');
  expect(zone().querySelector('.pixel-sprite')).toHaveAttribute('data-still', 'true');
  view.rerender(content(1));
  expect(zone()).toHaveAttribute('data-state', 'jump');
  next();
  expect(zone()).toHaveAttribute('data-state', 'idle');
});

it('does not replay an already started reaction after a dialog interrupts it', () => {
  const view = render(content());
  view.rerender(content(1));
  expect(zone()).toHaveAttribute('data-state', 'jump');
  act(() => vi.advanceTimersByTime(200));
  view.rerender(content(1, true));
  expect(zone()).toHaveAttribute('data-state', 'idle');
  view.rerender(content(1));
  expect(zone()).toHaveAttribute('data-state', 'idle');
});

it('stops and consumes reactions under system reduced motion and resumes without replay', () => {
  const view = render(content());
  next();
  systemReduced = true;
  act(() => mediaChange());
  view.rerender(content(1));
  act(() => vi.advanceTimersByTime(90_000));
  expect(zone()).toHaveAttribute('data-state', 'idle');
  expect(zone().querySelector('.pixel-sprite')).toHaveAttribute('data-still', 'true');
  systemReduced = false;
  act(() => mediaChange());
  expect(zone()).toHaveAttribute('data-state', 'idle');
  view.rerender(content(2));
  expect(zone()).toHaveAttribute('data-state', 'jump');
});

it('honors application motion settings, cleans timers and disconnects observers on exit', () => {
  function Controls() {
    const { setReducedMotion } = useTheme();
    return <><button onClick={() => setReducedMotion(true)}>Ogranicz ruch</button>{content()}</>;
  }
  const view = render(<ThemeProvider><Controls /></ThemeProvider>);
  next();
  fireEvent.click(screen.getByRole('button', { name: 'Ogranicz ruch' }));
  expect(zone()).toHaveAttribute('data-state', 'idle');
  expect(zone().querySelector('.pixel-sprite')).toHaveAttribute('data-still', 'true');
  view.unmount();
  act(() => vi.runOnlyPendingTimers());
  expect(vi.getTimerCount()).toBe(0);
  expect(disconnect).toHaveBeenCalled();
});

it('pauses in a background tab and safely handles missing resize observers and zero width', () => {
  width = 0;
  vi.stubGlobal('ResizeObserver', undefined);
  const view = render(content());
  next();
  expect(zone()).toHaveAttribute('data-state', 'wave');
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(zone()).toHaveAttribute('data-state', 'idle');
  view.rerender(content(1));
  expect(vi.getTimerCount()).toBe(0);
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
