import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PageBackdrop from './PageBackdrop';

const boxes = new Map<string, { left: number; top: number }>();
let observed: Element[] = [];
let resize: () => void = () => {};
const disconnect = vi.fn();
const frames: FrameRequestCallback[] = [];

const rect = (left: number, top: number) => ({ left, top, right: left, bottom: top, width: 0, height: 0, x: left, y: top, toJSON: () => ({}) });

beforeEach(() => {
  boxes.clear();
  observed = [];
  frames.length = 0;
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) { return this.classList.contains('page-backdrop') ? 1280 : 0; });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) { return this.classList.contains('page-backdrop') ? 760 : 0; });
  vi.spyOn(HTMLElement.prototype, 'clientLeft', 'get').mockImplementation(function (this: HTMLElement) { return this.classList.contains('profile-header') ? 2 : 0; });
  vi.spyOn(HTMLElement.prototype, 'clientTop', 'get').mockImplementation(function (this: HTMLElement) { return this.classList.contains('profile-header') ? 2 : 0; });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const box = boxes.get(this.className) ?? { left: 0, top: -300 };
    return rect(box.left, box.top);
  });
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resize = callback; }
    observe(element: Element) { observed.push(element); }
    disconnect = disconnect;
  });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const flush = () => act(() => { frames.splice(0).forEach(frame => frame(0)); });

function Page({ panel = true, scene }: { panel?: boolean; scene?: string }) {
  return (
    <main className="site-canvas" data-scene={scene}>
      <PageBackdrop />
      <div className="site-page-content">{panel && <section className="profile-header" />}<p>Treść</p></div>
    </main>
  );
}

it('shows each scenery panel the same part of the scene as the page backdrop behind it', () => {
  boxes.set('profile-header', { left: 160, top: -238 });
  const { container } = render(<Page />);
  const backdrop = container.querySelector('.page-backdrop') as HTMLElement;
  const panel = container.querySelector('.profile-header') as HTMLElement;
  expect(backdrop.style.getPropertyValue('--scene-size')).toBe('1600px 800px');
  expect(backdrop.style.getPropertyValue('--scene-offset')).toBe('-160px 0px');
  expect(panel).toHaveAttribute('data-scene-aligned');
  expect(panel.style.getPropertyValue('--scene-size')).toBe('1600px 800px');
  expect(panel.style.getPropertyValue('--scene-offset')).toBe('-322px -64px');
  expect(observed).toContain(panel);
  expect(backdrop).toHaveAttribute('aria-hidden', 'true');
});

it('realigns panels after layout changes and new panels, and stops observing on exit', async () => {
  const view = render(<Page panel={false} />);
  view.rerender(<Page />);
  await act(async () => {});
  const panel = view.container.querySelector('.profile-header') as HTMLElement;
  boxes.set('profile-header', { left: 40, top: -100 });
  flush();
  expect(panel.style.getPropertyValue('--scene-offset')).toBe('-202px -202px');
  boxes.set('profile-header', { left: 60, top: -100 });
  resize();
  resize();
  expect(frames).toHaveLength(1);
  flush();
  expect(panel.style.getPropertyValue('--scene-offset')).toBe('-222px -202px');
  window.dispatchEvent(new Event('resize'));
  expect(frames).toHaveLength(1);
  view.unmount();
  expect(disconnect).toHaveBeenCalled();
  expect(cancelAnimationFrame).toHaveBeenCalled();
});

it('uses the focus point from the stylesheet and works without resize observers', () => {
  vi.stubGlobal('ResizeObserver', undefined);
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({ getPropertyValue: (name: string) => name === '--scene-focus' ? ' .65' : '' } as CSSStyleDeclaration);
  const { container } = render(<Page />);
  const backdrop = container.querySelector('.page-backdrop') as HTMLElement;
  expect(backdrop.style.getPropertyValue('--scene-offset')).toBe('-208px 0px');
});

it('skips the empty bands of the current scene and realigns when the theme changes', async () => {
  document.documentElement.setAttribute('data-theme', 'dark');
  boxes.set('profile-header', { left: 160, top: -238 });
  const { container } = render(<Page scene="ranking" />);
  const backdrop = container.querySelector('.page-backdrop') as HTMLElement;
  const panel = container.querySelector('.profile-header') as HTMLElement;
  expect(backdrop.style.getPropertyValue('--scene-size')).toBe('2000px 1000px');
  expect(backdrop.style.getPropertyValue('--scene-offset')).toBe('-360px -65px');
  expect(panel.style.getPropertyValue('--scene-offset')).toBe('-522px -129px');
  document.documentElement.setAttribute('data-theme', 'light');
  await act(async () => {});
  flush();
  expect(backdrop.style.getPropertyValue('--scene-offset')).toBe('-360px -70px');
  expect(panel.style.getPropertyValue('--scene-offset')).toBe('-522px -134px');
  document.documentElement.removeAttribute('data-theme');
});
