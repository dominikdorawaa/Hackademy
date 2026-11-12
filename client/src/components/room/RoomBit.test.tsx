import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import RoomBit, { REACTION_FRAMES, REACTION_MS, RoomBitContext, type RoomBitState } from './RoomBit';

const layer = () => document.querySelector('.room-bit-layer') as HTMLElement | null;
const sheet = () => (document.querySelector('.room-bit-sprite') as HTMLElement).style.getPropertyValue('--bit-sheet');
const view = (state: RoomBitState | null) => <RoomBitContext.Provider value={state}><div className="room-body-shell"><RoomBit /></div></RoomBitContext.Provider>;
const base: RoomBitState = { successCount: 0, wrongCount: 0, hintCount: 0, finishCount: 0 };

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.removeItem('app-reduced-motion');
  document.documentElement.removeAttribute('data-reduced-motion');
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it('renders nothing outside a room that asks for Bit', () => {
  render(view(null));
  expect(layer()).toBeNull();
});

it('picks one edge when the room opens and keeps it for every reaction', () => {
  vi.spyOn(Math, 'random').mockReturnValue(.2);
  const { rerender } = render(view(base));
  expect(layer()).toHaveAttribute('data-side', 'top');
  expect(layer()).toHaveAttribute('data-pose', 'idle');
  expect(sheet()).toBe('url(/assets/mascot/bit-peek/hang-idle.png)');
  vi.spyOn(Math, 'random').mockReturnValue(.9);
  rerender(view({ ...base, successCount: 1 }));
  expect(layer()).toHaveAttribute('data-pose', 'correct');
  expect(layer()).toHaveAttribute('data-side', 'top');
  expect(sheet()).toBe('url(/assets/mascot/bit-peek/hang-correct.png)');
  expect((document.querySelector('.room-bit-sprite') as HTMLElement).style.getPropertyValue('--bit-frames')).toBe(String(REACTION_FRAMES));
  expect(document.querySelector('.room-bit-bubble')).toHaveTextContent('Świetnie!');
  act(() => vi.advanceTimersByTime(REACTION_MS));
  expect(layer()).toHaveAttribute('data-pose', 'idle');
  expect(document.querySelector('.room-bit-bubble')).toBeNull();
});

it('reacts to wrong answers, hints and the finished room from the side edge', () => {
  vi.spyOn(Math, 'random').mockReturnValue(.7);
  const { rerender } = render(view(base));
  expect(layer()).toHaveAttribute('data-side', 'side');
  rerender(view({ ...base, wrongCount: 1 }));
  expect(layer()).toHaveAttribute('data-pose', 'wrong');
  expect(sheet()).toBe('url(/assets/mascot/bit-peek/side-wrong.png)');
  rerender(view({ ...base, wrongCount: 1, hintCount: 1 }));
  expect(layer()).toHaveAttribute('data-pose', 'hint');
  rerender(view({ ...base, wrongCount: 1, hintCount: 1, successCount: 1, finishCount: 1 }));
  expect(layer()).toHaveAttribute('data-pose', 'finish');
  expect(document.querySelector('.room-bit-bubble')).toHaveTextContent('Pokój zaliczony!');
});

it('stays hidden while paused except for the finished room', () => {
  const { rerender } = render(view({ ...base, paused: true }));
  rerender(view({ ...base, paused: true, successCount: 1 }));
  expect(layer()).toHaveAttribute('data-pose', 'idle');
  rerender(view({ ...base, paused: true, successCount: 1, finishCount: 1 }));
  expect(layer()).toHaveAttribute('data-pose', 'finish');
  rerender(view({ ...base, successCount: 2, finishCount: 1 }));
  expect(layer()).toHaveAttribute('data-pose', 'correct');
  rerender(view({ ...base, paused: true, successCount: 2, finishCount: 1 }));
  expect(layer()).toHaveAttribute('data-pose', 'idle');
});

it('shows a still reaction pose when motion is reduced', () => {
  document.documentElement.setAttribute('data-reduced-motion', 'true');
  localStorage.setItem('app-reduced-motion', 'true');
  const { rerender } = render(view(base));
  rerender(view({ ...base, successCount: 1 }));
  expect(layer()).toHaveAttribute('data-pose', 'correct');
  expect(document.querySelector('.room-bit-sprite')).not.toHaveAttribute('data-animated');
});
