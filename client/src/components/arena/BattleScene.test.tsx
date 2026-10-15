import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BattleScene from './BattleScene';
import type { BattleResult } from './battleAnimation';

const fighter = { name: 'Bajt', avatarSeed: 'alpha', hp: 100 };
const opponent = { name: 'Iskra', avatarSeed: 'beta', hp: 100 };
let animated: { element: Element; frames: Keyframe[]; cancel: ReturnType<typeof vi.fn> }[];

beforeEach(() => {
  vi.useFakeTimers();
  animated = [];
  Object.defineProperty(SVGElement.prototype, 'animate', { configurable: true, value(this: Element, frames: Keyframe[]) {
    const animation = { element: this, frames, cancel: vi.fn() }; animated.push(animation); return animation;
  } });
});
afterEach(() => { vi.useRealTimers(); Reflect.deleteProperty(SVGElement.prototype, 'animate'); });

function mount(result: BattleResult | null, reducedMotion = false) {
  const onImpact = vi.fn(), onComplete = vi.fn();
  const props = { left: fighter, right: opponent, result, reducedMotion, onImpact, onComplete };
  const view = render(<StrictMode><BattleScene {...props} /></StrictMode>);
  return { ...view, props, onImpact, onComplete };
}

describe('battle animation', () => {
  it.each(['left', 'right'] as const)('fires from %s, applies impact once and finishes at 900ms', attacker => {
    const { onImpact, onComplete, unmount } = mount({ id: 'hit', kind: 'hit', attacker });
    act(() => vi.advanceTimersByTime(0));
    const shot = animated.find(item => item.element.matches(`[data-projectile="${attacker}"]`))!;
    expect(shot.frames.at(-1)?.transform).toBe(`translateX(${attacker === 'left' ? 310 : -310}px)`);
    act(() => vi.advanceTimersByTime(649));
    expect(onImpact).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onImpact).toHaveBeenCalledOnce();
    expect(shot.cancel).toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(250));
    expect(onComplete).toHaveBeenCalledOnce();
    unmount();
    expect(animated.every(item => item.cancel.mock.calls.length > 0)).toBe(true);
  });

  it('collides both projectiles at the center without a damage animation', () => {
    const { onImpact } = mount({ id: 'clash', kind: 'clash', attacker: 'left' });
    act(() => vi.advanceTimersByTime(650));
    const shots = animated.filter(item => item.element.matches('[data-projectile]'));
    expect(shots.map(item => item.frames.at(-1)?.transform)).toEqual(['translateX(155px)', 'translateX(-155px)']);
    expect(animated.some(item => item.element.matches('[data-damage]'))).toBe(false);
    expect(onImpact).toHaveBeenCalledOnce();
  });

  it('kneels and raises the winning arm on defeat', () => {
    mount({ id: 'defeat', kind: 'defeat', attacker: 'right' });
    act(() => vi.advanceTimersByTime(900));
    expect(animated.some(item => item.element.closest('[data-fighter="left"]') && item.frames.at(-1)?.transform === 'rotate(65deg)')).toBe(true);
    expect(animated.some(item => item.element.closest('[data-fighter="right"]') && item.frames.at(-1)?.transform === 'rotate(-145deg)')).toBe(true);
  });

  it('uses immediate state updates without animations for reduced motion', () => {
    const { onImpact, onComplete } = mount({ id: 'reduced', kind: 'hit', attacker: 'left' }, true);
    act(() => vi.advanceTimersByTime(1));
    expect(onImpact).toHaveBeenCalledOnce();
    expect(animated).toHaveLength(0);
    act(() => vi.advanceTimersByTime(120));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('does not replay duplicate IDs or interrupt an animation on an HP rerender', () => {
    const event: BattleResult = { id: 'same', kind: 'hit', attacker: 'left' };
    const { rerender, props, onImpact, onComplete } = mount(event);
    act(() => vi.advanceTimersByTime(400));
    rerender(<StrictMode><BattleScene {...props} result={{ ...event }} right={{ ...opponent, hp: 80 }} /></StrictMode>);
    act(() => vi.advanceTimersByTime(500));
    expect(onImpact).toHaveBeenCalledOnce();
    expect(onComplete).toHaveBeenCalledOnce();
    rerender(<StrictMode><BattleScene {...props} result={null} /></StrictMode>);
    rerender(<StrictMode><BattleScene {...props} result={event} /></StrictMode>);
    act(() => vi.advanceTimersByTime(1000));
    expect(onImpact).toHaveBeenCalledOnce();
  });

  it('cancels scheduled state changes when removed before impact', () => {
    const { unmount, onImpact, onComplete } = mount({ id: 'cancel', kind: 'hit', attacker: 'left' });
    act(() => vi.advanceTimersByTime(300));
    unmount();
    act(() => vi.advanceTimersByTime(1000));
    expect(onImpact).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('restores supplied HP without a replay and uses a face fallback after an image error', () => {
    const { container } = mount(null);
    expect(screen.getByRole('meter', { name: 'HP: Bajt' })).toHaveAttribute('aria-valuenow', '100');
    const image = container.querySelector('image')!;
    fireEvent.error(image);
    expect(container.querySelectorAll('image')).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1000));
    expect(animated).toHaveLength(0);
  });
});
