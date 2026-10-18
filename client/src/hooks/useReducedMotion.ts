import { useSyncExternalStore } from 'react';
import { useAppReducedMotion } from '../context/ThemeContext';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const subscribe = (onChange: () => void) => {
  if (typeof window.matchMedia !== 'function') return () => undefined;
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};
const systemReducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION_QUERY).matches;

/** True when the system or the in-app setting asks for less motion. */
export function useReducedMotion() {
  const system = useSyncExternalStore(subscribe, systemReducedMotion, () => false);
  const app = useAppReducedMotion();
  return system || app;
}
