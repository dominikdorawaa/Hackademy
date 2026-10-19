import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useOnboarding } from '../../context/OnboardingContext';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { finishTour } from '../../services/onboardingApi';
import { ONBOARDING_PATH, TOUR_STEP_KEY } from '../../lib/onboarding';
import { MOBILE_TOUR_WIDTH, placeBubble, TOUR_STEPS } from '../../lib/tour';
import type { Box } from '../../lib/tour';
import { MascotBubble } from '../mascot/MascotBubble';
import './GuidedTour.css';

const MISSING_MS = 2500;
const MOVE_MS = 650;

const readStep = () => {
  try {
    const value = Number(sessionStorage.getItem(TOUR_STEP_KEY));
    return Number.isInteger(value) && value >= 0 && value < TOUR_STEPS.length ? value : 0;
  } catch { return 0; }
};
const writeStep = (step: number | null) => {
  try { if (step === null) sessionStorage.removeItem(TOUR_STEP_KEY); else sessionStorage.setItem(TOUR_STEP_KEY, String(step)); } catch { return; }
};

export default function GuidedTour() {
  const { token, isAuthenticated } = useAuth();
  const { status, state, update } = useOnboarding();
  const location = useLocation();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState(readStep);
  const [box, setBox] = useState<Box | null>(null);
  const [moving, setMoving] = useState(false);
  const [bubbleSize, setBubbleSize] = useState({ width: 380, height: 220 });
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [saving, setSaving] = useState<'COMPLETED' | 'SKIPPED' | null>(null);
  const [error, setError] = useState(false);
  const bubble = useRef<HTMLDivElement>(null);
  const direction = useRef(1);
  const active = isAuthenticated && status === 'ready' && !!state?.avatarConfirmed && state.tourStatus === 'PENDING' && location.pathname !== ONBOARDING_PATH;
  const current = TOUR_STEPS[step];
  const onPage = location.pathname === current.path;
  const pageSteps = TOUR_STEPS.filter(item => item.page === current.page);
  const pageIndex = pageSteps.indexOf(current);

  useEffect(() => { if (active) writeStep(step); }, [active, step]);

  useEffect(() => {
    if (!active) return;
    document.documentElement.setAttribute('data-tour-active', '');
    return () => document.documentElement.removeAttribute('data-tour-active');
  }, [active]);

  useEffect(() => {
    if (active && !onPage) navigate(current.path);
  }, [active, onPage, current.path, navigate]);

  useEffect(() => {
    if (!active) return;
    const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [active]);

  useEffect(() => {
    if (!active || reducedMotion) return;
    const start = requestAnimationFrame(() => setMoving(true));
    const stop = setTimeout(() => setMoving(false), MOVE_MS);
    return () => { cancelAnimationFrame(start); clearTimeout(stop); };
  }, [active, step, reducedMotion]);

  useEffect(() => {
    if (!active || !onPage) return;
    let frame = 0, scrolled = false, marked: HTMLElement | null = null;
    const started = performance.now();
    const measure = () => {
      const element = document.querySelector<HTMLElement>(`[data-tour="${current.target}"]`);
      if (element) {
        if (marked !== element) { marked?.removeAttribute('data-tour-current'); element.setAttribute('data-tour-current', ''); marked = element; }
        if (!scrolled) {
          scrolled = true;
          const header = document.querySelector('.navbar')?.getBoundingClientRect().bottom ?? 0;
          const rect = element.getBoundingClientRect();
          const room = window.innerHeight - header - (window.innerWidth < MOBILE_TOUR_WIDTH ? 300 : 0);
          const offset = rect.height < room ? Math.max(0, (room - rect.height) / 2) : 16;
          window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - header - offset), behavior: reducedMotion ? 'auto' : 'smooth' });
        }
        const rect = element.getBoundingClientRect();
        setBox(previous => previous && previous.top === rect.top && previous.left === rect.left && previous.width === rect.width && previous.height === rect.height
          ? previous : { top: rect.top, left: rect.left, width: rect.width, height: rect.height });
      } else if (performance.now() - started > MISSING_MS) {
        const next = step + direction.current;
        if (next >= 0 && next < TOUR_STEPS.length) { setStep(next); return; }
        setBox(null);
      }
      frame = requestAnimationFrame(measure);
    };
    frame = requestAnimationFrame(measure);
    return () => { cancelAnimationFrame(frame); marked?.removeAttribute('data-tour-current'); };
  }, [active, onPage, step, current.target, reducedMotion]);

  useEffect(() => {
    const element = bubble.current;
    if (!active || !element) return;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      setBubbleSize(previous => Math.abs(previous.width - rect.width) < 1 && Math.abs(previous.height - rect.height) < 1 ? previous : { width: rect.width, height: rect.height });
    };
    const frame = requestAnimationFrame(measure);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); };
  }, [active, step, onPage]);

  useEffect(() => {
    if (active && onPage) bubble.current?.querySelector<HTMLButtonElement>('[data-tour-primary]')?.focus({ preventScroll: true });
  }, [active, onPage, step]);

  const finish = useCallback(async (result: 'COMPLETED' | 'SKIPPED') => {
    if (!token || saving) return;
    setSaving(result);
    setError(false);
    try {
      const response = await finishTour(result, { Authorization: `Bearer ${token}` });
      if (!response.ok) throw new Error('tour');
      writeStep(null);
      update(await response.json());
    } catch {
      setError(true);
    } finally {
      setSaving(null);
    }
  }, [token, saving, update]);

  if (!active) return null;

  const last = step === TOUR_STEPS.length - 1;
  const go = (delta: number) => { direction.current = delta; setStep(Math.min(TOUR_STEPS.length - 1, Math.max(0, step + delta))); };
  const next = () => { if (last) void finish('COMPLETED'); else go(1); };
  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      const items = [...(bubble.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
      if (!items.length) return;
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      const target = event.shiftKey ? (index <= 0 ? items.length - 1 : index - 1) : (index === items.length - 1 ? 0 : index + 1);
      event.preventDefault();
      items[target].focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      bubble.current?.querySelector<HTMLButtonElement>('[data-tour-skip]')?.focus();
    }
  };
  const place = placeBubble(onPage ? box : null, bubbleSize, viewport);
  const spotlight = onPage && box ? { top: box.top - 8, left: box.left - 8, width: box.width + 16, height: box.height + 16 } : null;

  return <div className="user-dashboard guided-tour" data-reduced-motion={reducedMotion}>
    <div className={spotlight ? 'tour-dim has-spotlight' : 'tour-dim'} aria-hidden="true" />
    {spotlight && <div className="tour-spotlight" style={spotlight as CSSProperties} aria-hidden="true" data-testid="tour-spotlight" />}
    <div className={`tour-bubble is-${place.mode}`} data-moving={moving} style={place.mode === 'float' ? { top: place.top, left: place.left } : undefined} onKeyDown={keys}>
      <MascotBubble ref={bubble} id="tour" role="dialog" title={current.title} mood={moving ? 'walk' : 'talk'} still={reducedMotion}
        actions={<>
          <span className="tour-progress">{current.page} · {pageIndex + 1} z {pageSteps.length}</span>
          <button type="button" className="ud-btn ud-btn-small" onClick={() => go(-1)} disabled={step === 0 || !!saving}>Wstecz</button>
          <button type="button" className="ud-btn ud-btn-solid ud-btn-small" onClick={next} disabled={!!saving} data-tour-primary>{saving === 'COMPLETED' ? 'Zapisuję…' : last ? 'Zakończ' : 'Dalej'}</button>
          <button type="button" className="ud-btn ud-btn-small tour-skip" onClick={() => void finish('SKIPPED')} disabled={!!saving} data-tour-skip>{saving === 'SKIPPED' ? 'Zapisuję…' : 'Pomiń przewodnik'}</button>
        </>}>
        <p>{current.text}</p>
        <p className="tour-overall" aria-hidden="true"><span style={{ width: `${((step + 1) / TOUR_STEPS.length) * 100}%` }} /></p>
        {error && <p className="tour-error" role="alert">Nie udało się zapisać przewodnika. Spróbuj ponownie.</p>}
      </MascotBubble>
    </div>
  </div>;
}
