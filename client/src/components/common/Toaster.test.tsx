import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Toaster from './Toaster';
import { LONG_TOAST_DURATION_MS, MAX_TOASTS, TOAST_DURATION_MS, currentToasts, subscribeToasts, toast } from './toast';

const message = (text: string) => screen.getByText(text, { selector: '.px-toast-message' });
const card = (text: string) => message(text).closest('li')!;

afterEach(() => {
  vi.useRealTimers();
  document.body.querySelectorAll('.realtime-toasts, .rate-limit-notices').forEach(element => element.remove());
});

describe('toast store', () => {
  it('gives every kind its own title and duration and notifies subscribers', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToasts(listener);
    toast.success('Zapisano.');
    toast.info('Informacja testowa.');
    toast.warning('Uważaj.');
    toast.error('Nie udało się.', { title: 'Awaria' });
    expect(currentToasts().map(item => [item.kind, item.title, item.duration])).toEqual([
      ['success', 'Sukces', TOAST_DURATION_MS],
      ['info', 'Informacja', TOAST_DURATION_MS],
      ['warning', 'Uwaga', LONG_TOAST_DURATION_MS],
      ['error', 'Awaria', LONG_TOAST_DURATION_MS],
    ]);
    expect(listener).toHaveBeenCalledTimes(4);
    unsubscribe();
    toast.clear();
    expect(listener).toHaveBeenCalledTimes(4);
    expect(currentToasts()).toEqual([]);
  });

  it('replaces a repeated message and keeps only the newest toasts', () => {
    const first = toast.success('Zapisano.');
    const again = toast.success('Zapisano.', { duration: 1000 });
    expect(again).not.toBe(first);
    expect(currentToasts()).toEqual([expect.objectContaining({ id: again, duration: 1000 })]);
    for (let index = 0; index < MAX_TOASTS + 2; index += 1) toast.info(`Komunikat ${index}`);
    expect(currentToasts().map(item => item.message)).toEqual(Array.from({ length: MAX_TOASTS }, (_, index) => `Komunikat ${index + 2}`));
    toast.dismiss(currentToasts()[0].id);
    expect(currentToasts()).toHaveLength(MAX_TOASTS - 1);
  });
});

describe('toaster', () => {
  it('stacks messages in polite and assertive live regions with a title and a close button', () => {
    render(<Toaster />);
    const [polite, assertive] = Array.from(document.querySelectorAll('.px-toasts-group'));
    expect(polite).toHaveAttribute('aria-live', 'polite');
    expect(assertive).toHaveAttribute('aria-live', 'assertive');
    expect(polite).toBeEmptyDOMElement();
    expect(assertive).toBeEmptyDOMElement();
    act(() => {
      toast.success('Zapisano szkic.');
      toast.error('Nie udało się zapisać.');
      toast.warning('Zapisz szkic przed podglądem.');
      toast.info('Tak brzmi ten sygnał.');
    });
    expect(within(polite as HTMLElement).getByRole('list', { name: 'Komunikaty' })).toHaveTextContent('SukcesZapisano szkic.InformacjaTak brzmi ten sygnał.');
    expect(within(assertive as HTMLElement).getByRole('list', { name: 'Pilne komunikaty' })).toHaveTextContent('BłądNie udało się zapisać.UwagaZapisz szkic przed podglądem.');
    expect(card('Zapisano szkic.')).toHaveAttribute('data-type', 'success');
    expect(card('Zapisz szkic przed podglądem.')).toHaveAttribute('data-type', 'warning');
    const close = within(card('Nie udało się zapisać.')).getByRole('button', { name: 'Zamknij komunikat' });
    expect(close).toHaveAccessibleDescription('Nie udało się zapisać.');
    fireEvent.click(close);
    expect(screen.queryByText('Nie udało się zapisać.')).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('hides each toast on its own after its duration', () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => { toast.success('Krótki.'); toast.error('Długi.'); });
    expect(card('Krótki.').style.getPropertyValue('--px-toast-duration')).toBe(`${TOAST_DURATION_MS}ms`);
    act(() => { vi.advanceTimersByTime(TOAST_DURATION_MS); });
    expect(screen.queryByText('Krótki.')).not.toBeInTheDocument();
    expect(message('Długi.')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(LONG_TOAST_DURATION_MS - TOAST_DURATION_MS); });
    expect(screen.queryByText('Długi.')).not.toBeInTheDocument();
  });

  it('pauses the countdown while the pointer or focus is on the toast', () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => { toast.success('Zatrzymany.'); });
    act(() => { vi.advanceTimersByTime(3000); });
    fireEvent.mouseEnter(card('Zatrzymany.'));
    expect(card('Zatrzymany.')).toHaveAttribute('data-paused', 'true');
    act(() => { vi.advanceTimersByTime(10000); });
    expect(message('Zatrzymany.')).toBeInTheDocument();
    fireEvent.mouseLeave(card('Zatrzymany.'));
    const close = within(card('Zatrzymany.')).getByRole('button');
    fireEvent.focus(close);
    act(() => { vi.advanceTimersByTime(10000); });
    expect(message('Zatrzymany.')).toBeInTheDocument();
    fireEvent.blur(close, { relatedTarget: card('Zatrzymany.') });
    act(() => { vi.advanceTimersByTime(10000); });
    expect(message('Zatrzymany.')).toBeInTheDocument();
    fireEvent.blur(close, { relatedTarget: document.body });
    expect(card('Zatrzymany.')).not.toHaveAttribute('data-paused');
    act(() => { vi.advanceTimersByTime(1999); });
    expect(message('Zatrzymany.')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.queryByText('Zatrzymany.')).not.toBeInTheDocument();
  });

  it('rises above realtime notices that share its corner and follows their size', () => {
    const observers: ResizeObserverCallback[] = [];
    const disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', class { constructor(callback: ResizeObserverCallback) { observers.push(callback); } observe() {} disconnect = disconnect; });
    const box = (element: Element, rect: Partial<DOMRect>) => vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ top: 0, bottom: 0, left: 0, right: 0, height: 0, width: 0, x: 0, y: 0, toJSON: () => ({}), ...rect });
    const realtime = document.body.appendChild(Object.assign(document.createElement('div'), { className: 'realtime-toasts' }));
    const limit = document.body.appendChild(Object.assign(document.createElement('div'), { className: 'rate-limit-notices' }));
    const realtimeBox = box(realtime, { top: 700, bottom: 784, left: 900, right: 1260, height: 84 });
    box(limit, { top: 740, bottom: 784, left: 16, right: 376, height: 44 });
    const stack = render(<Toaster />).baseElement.querySelector('.px-toasts') as HTMLElement;
    box(stack, { top: 784, bottom: 784, left: 880, right: 1260 });
    act(() => { toast.success('Nad powiadomieniem.'); });
    expect(stack.style.getPropertyValue('--px-toasts-lift')).toBe('92px');
    realtimeBox.mockReturnValue({ ...realtime.getBoundingClientRect(), height: 0 });
    act(() => { observers[0]([], {} as ResizeObserver); });
    expect(stack.style.getPropertyValue('--px-toasts-lift')).toBe('0px');
    act(() => { toast.clear(); });
    expect(disconnect).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('measures once when the browser cannot observe sizes', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const stack = render(<Toaster />).baseElement.querySelector('.px-toasts') as HTMLElement;
    act(() => { toast.info('Bez obserwatora.'); });
    expect(stack.style.getPropertyValue('--px-toasts-lift')).toBe('0px');
    vi.unstubAllGlobals();
  });
});
