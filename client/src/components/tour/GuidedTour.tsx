import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties, KeyboardEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useOnboarding } from '../../context/OnboardingContext';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { finishTour } from '../../services/onboardingApi';
import { ONBOARDING_PATH, TOUR_STEP_KEY } from '../../lib/onboarding';
import { placeBubble, scrollTargetTop, TOUR_STEPS } from '../../lib/tour';
import type { Box } from '../../lib/tour';
import { MascotBubble } from '../mascot/MascotBubble';
import './GuidedTour.css';

const MISSING_MS = 2500;
const SETTLE_MS = 150;
const WALK_SPEED = 0.28;
const MIN_WALK_MS = 600;
const MAX_WALK_MS = 2600;

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
  const { sessionKey, isAuthenticated } = useAuth();
  const { status, state, update } = useOnboarding();
  const location = useLocation();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState(readStep);
  const [box, setBox] = useState<(Box & { step: number }) | null>(null);
  const [moving, setMoving] = useState(false);
  const [walk, setWalk] = useState<{ mood: 'walkFront' | 'walkSide' | 'walkBack'; flip: boolean; ms: number }>({ mood: 'walkFront', flip: false, ms: MIN_WALK_MS });
  const [shown, setShown] = useState<{ step: number; top: number; left: number } | null>(null);
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
    if (!active || !onPage) return;
    let frame = 0, scrolled = false, marked: HTMLElement | null = null;
    const started = performance.now();
    const measure = () => {
      const element = document.querySelector<HTMLElement>(`[data-tour="${current.target}"]`);
      if (element) {
        if (marked !== element) { marked?.removeAttribute('data-tour-current'); element.setAttribute('data-tour-current', ''); marked = element; }
        const rect = element.getBoundingClientRect();
        const next = { top: Math.round(rect.top + window.scrollY), left: Math.round(rect.left + window.scrollX), width: Math.round(rect.width), height: Math.round(rect.height) };
        if (!scrolled) {
          scrolled = true;
          const view = { width: window.innerWidth, height: window.innerHeight };
          const floating = placeBubble(next, bubbleSize, view).mode === 'float';
          window.scrollTo({ top: scrollTargetTop(next, bubbleSize.height, view, floating), behavior: reducedMotion ? 'auto' : 'smooth' });
        }
        setBox(previous => previous && previous.step === step && previous.top === next.top && previous.left === next.left && previous.width === next.width && previous.height === next.height ? previous : { ...next, step });
      } else if (performance.now() - started > MISSING_MS || (performance.now() - started > SETTLE_MS && TOUR_STEPS.some(item => item.path === current.path && item.target !== current.target && document.querySelector(`[data-tour="${item.target}"]`)))) {
        const next = step + direction.current;
        if (next >= 0 && next < TOUR_STEPS.length) { setStep(next); return; }
        setBox(null);
      }
      frame = requestAnimationFrame(measure);
    };
    frame = requestAnimationFrame(measure);
    return () => { cancelAnimationFrame(frame); marked?.removeAttribute('data-tour-current'); };
  }, [active, onPage, step, current.path, current.target, reducedMotion, bubbleSize]);

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

  const place = placeBubble(box, bubbleSize, viewport);

  const arrived = box?.step === step;
  useEffect(() => {
    if (!active || !arrived || place.mode !== 'float') return;
    if (shown?.step === step) {
      if (Math.abs(shown.top - place.top) > 1 || Math.abs(shown.left - place.left) > 1) {
        const frame = requestAnimationFrame(() => setShown({ step, top: place.top, left: place.left }));
        return () => cancelAnimationFrame(frame);
      }
      return;
    }
    const dx = shown ? place.left - shown.left : 0, dy = shown ? place.top - shown.top : 0, distance = Math.hypot(dx, dy);
    const ms = !shown || reducedMotion || distance <= 4 ? 0 : Math.round(Math.min(MAX_WALK_MS, Math.max(MIN_WALK_MS, distance / WALK_SPEED)));
    const mood = Math.abs(dx) >= Math.abs(dy) ? 'walkSide' : dy < 0 ? 'walkBack' : 'walkFront';
    const frame = requestAnimationFrame(() => {
      setWalk({ mood, flip: mood === 'walkSide' && dx < 0, ms });
      setShown({ step, top: place.top, left: place.left });
      setMoving(ms > 0);
    });
    return () => cancelAnimationFrame(frame);
  }, [active, arrived, step, place.mode, place.top, place.left, shown, reducedMotion]);

  useEffect(() => {
    if (!moving) return;
    const stop = setTimeout(() => setMoving(false), walk.ms + 60);
    return () => clearTimeout(stop);
  }, [moving, walk]);


  const finish = useCallback(async (result: 'COMPLETED' | 'SKIPPED') => {
    if (!sessionKey || saving) return;
    setSaving(result);
    setError(false);
    try {
      const response = await finishTour(result, { sessionKey });
      if (!response.ok) throw new Error('tour');
      writeStep(null);
      update(await response.json());
    } catch {
      setError(true);
    } finally {
      setSaving(null);
    }
  }, [sessionKey, saving, update]);

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
  const walking = moving || (place.mode === 'float' && shown?.step !== step);
  const spotlight = onPage && box ? { top: box.top - 8, left: box.left - 8, width: box.width + 16, height: box.height + 16 } : null;

  return createPortal(<div className="user-dashboard guided-tour" data-reduced-motion={reducedMotion}>
    <div className={spotlight ? 'tour-dim has-spotlight' : 'tour-dim'} aria-hidden="true" />
    {spotlight && <div className="tour-spotlight" style={spotlight as CSSProperties} aria-hidden="true" data-testid="tour-spotlight" />}
    <div className={`tour-bubble is-${place.mode}`} data-moving={walking} data-facing={walk.flip ? 'left' : 'right'} style={place.mode === 'float' && shown ? { top: shown.top, left: shown.left, '--walk': `${walk.ms}ms` } as CSSProperties : undefined} onKeyDown={keys}>
      <MascotBubble ref={bubble} id="tour" role="dialog" title={current.title} mood={walking && !reducedMotion ? walk.mood : 'talk'} still={reducedMotion}
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
  </div>, document.body);
}
