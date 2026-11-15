export type ToastKind = 'success' | 'warning' | 'error' | 'info';

export interface ToastOptions {
  title?: string;
  duration?: number;
}

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  title: string;
  duration: number;
}

export const TOAST_DURATION_MS = 5000;
export const LONG_TOAST_DURATION_MS = 8000;
export const MAX_TOASTS = 4;

const titles: Record<ToastKind, string> = { success: 'Sukces', warning: 'Uwaga', error: 'Błąd', info: 'Informacja' };

let toasts: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function publish(next: ToastItem[]) {
  toasts = next;
  listeners.forEach(listener => listener());
}

function show(kind: ToastKind, message: string, options: ToastOptions = {}) {
  const id = nextId++;
  const duration = options.duration ?? (kind === 'error' || kind === 'warning' ? LONG_TOAST_DURATION_MS : TOAST_DURATION_MS);
  const others = toasts.filter(item => item.kind !== kind || item.message !== message);
  publish([...others, { id, kind, message, title: options.title ?? titles[kind], duration }].slice(-MAX_TOASTS));
  return id;
}

export const toast = {
  success: (message: string, options?: ToastOptions) => show('success', message, options),
  warning: (message: string, options?: ToastOptions) => show('warning', message, options),
  error: (message: string, options?: ToastOptions) => show('error', message, options),
  info: (message: string, options?: ToastOptions) => show('info', message, options),
  dismiss: (id: number) => publish(toasts.filter(item => item.id !== id)),
  clear: () => publish([]),
};

export function subscribeToasts(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function currentToasts() {
  return toasts;
}
