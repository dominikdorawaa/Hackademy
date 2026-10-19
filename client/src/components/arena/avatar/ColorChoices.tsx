import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import { Check, X } from 'lucide-react';
import { CUSTOM_COLOR, rampFor } from './avatarModel';
import type { Ramp } from './avatarModel';
import { colorName, LIGHT_COLORS } from './avatarOptions';
import { hexToHsv, hsvToHex, isLight } from './colorMath';
import type { Hsv } from './colorMath';
import './ColorChoices.css';

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

function ColorWheel({ label, initial, onPick, onClose }: { label: string; initial: string; onPick: (hex: string) => void; onClose: () => void }) {
  const [hsv, setHsv] = useState(() => hexToHsv(initial));
  const [draft, setDraft] = useState(initial);
  const wheel = useRef<HTMLDivElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const hex = hsvToHex(hsv);
  const id = useId();

  useEffect(() => {
    wheel.current?.focus({ preventScroll: true });
    popover.current?.scrollIntoView?.({ block: 'start' });
  }, []);

  const commit = (next: Hsv) => { setHsv(next); setDraft(hsvToHex(next)); onPick(hsvToHex(next)); };
  const fromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const radius = rect.width / 2, dx = event.clientX - rect.left - radius, dy = event.clientY - rect.top - radius;
    const next = { h: (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360, s: clamp(Math.hypot(dx, dy) / radius), v: hsv.v || 1 };
    setHsv(next);
    setDraft(hsvToHex(next));
    return next;
  };
  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 15 : 5;
    const next = event.key === 'ArrowRight' ? { ...hsv, h: (hsv.h + step) % 360 }
      : event.key === 'ArrowLeft' ? { ...hsv, h: (hsv.h - step + 360) % 360 }
      : event.key === 'ArrowUp' ? { ...hsv, s: clamp(hsv.s + step / 100) }
      : event.key === 'ArrowDown' ? { ...hsv, s: clamp(hsv.s - step / 100) } : null;
    if (!next) return;
    event.preventDefault();
    commit(next);
  };
  const marker = { left: `${50 + Math.sin(hsv.h * Math.PI / 180) * hsv.s * 50}%`, top: `${50 - Math.cos(hsv.h * Math.PI / 180) * hsv.s * 50}%`, background: hex } as CSSProperties;

  return <div ref={popover} className="color-wheel-popover" role="dialog" aria-label={`${label}: wybierz dowolny kolor`}
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); onClose(); } }}>
    <div className="color-wheel-head">
      <p>{label}: dowolny kolor</p>
      <button type="button" className="color-wheel-close" aria-label="Zamknij" onClick={onClose}><X size={18} aria-hidden="true" /></button>
    </div>
    <div ref={wheel} className="color-wheel" tabIndex={0} role="slider" aria-label="Koło kolorów" aria-valuemin={0} aria-valuemax={359} aria-valuenow={Math.round(hsv.h)}
      aria-valuetext={`Odcień ${Math.round(hsv.h)} stopni, nasycenie ${Math.round(hsv.s * 100)} procent`}
      onKeyDown={keys}
      onPointerDown={event => { dragging.current = true; event.currentTarget.setPointerCapture?.(event.pointerId); fromPointer(event); }}
      onPointerMove={event => { if (dragging.current) fromPointer(event); }}
      onPointerUp={event => { if (!dragging.current) return; dragging.current = false; commit(fromPointer(event)); }}>
      <span className="color-wheel-marker" style={marker} aria-hidden="true" />
    </div>
    <label className="color-wheel-row" htmlFor={`${id}-value`}>
      <span>Jasność</span>
      <input id={`${id}-value`} type="range" min={0} max={100} value={Math.round(hsv.v * 100)} style={{ '--hue': hsvToHex({ ...hsv, v: 1 }) } as CSSProperties}
        onChange={event => commit({ ...hsv, v: Number(event.target.value) / 100 })} />
    </label>
    <div className="color-wheel-row">
      <span className="color-wheel-preview" style={{ background: hex }} aria-hidden="true" />
      <label htmlFor={`${id}-hex`} className="sr-only">Kod koloru</label>
      <input id={`${id}-hex`} className="color-wheel-hex" value={draft} maxLength={7} spellCheck={false}
        aria-invalid={!CUSTOM_COLOR.test(draft.toLowerCase())}
        onChange={event => {
          const text = event.target.value.startsWith('#') ? event.target.value : `#${event.target.value}`;
          setDraft(text);
          if (CUSTOM_COLOR.test(text.toLowerCase())) { setHsv(hexToHsv(text.toLowerCase())); onPick(text.toLowerCase()); }
        }} />
      <button type="button" className="ud-btn ud-btn-solid ud-btn-small" onClick={onClose}>Gotowe</button>
    </div>
  </div>;
}

export function ColorChoices({ legend, value, options, presets, onChange, name }: {
  legend: string; value: string; options: Record<string, Ramp>; presets: string[]; onChange: (value: string) => void; name: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const labelId = useId();
  const custom = !presets.includes(value);
  const current = rampFor(options, value)[2];

  useEffect(() => {
    if (!open) return;
    const close = (event: globalThis.PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const shut = () => { setOpen(false); trigger.current?.focus(); };

  return <div className="color-choices" ref={root}>
    <h3 id={labelId} className="color-choices-legend">{legend} <span>{colorName(value)}</span></h3>
    <div className="color-choices-row" role="radiogroup" aria-labelledby={labelId}>
      {presets.map(preset => <label key={preset} className="color-swatch" data-selected={value === preset} title={colorName(preset)}>
        <input type="radio" name={name} checked={value === preset} onChange={() => onChange(preset)} aria-label={`${legend}: ${colorName(preset)}`} />
        <span style={{ background: `linear-gradient(135deg, ${options[preset][3]} 0 45%, ${options[preset][1]} 45% 100%)` }} aria-hidden="true">
          {value === preset && <Check size={16} style={{ color: LIGHT_COLORS.includes(preset) ? '#111827' : '#ffffff' }} />}
        </span>
      </label>)}
      <button ref={trigger} type="button" className="color-custom" data-selected={custom} aria-haspopup="dialog" aria-expanded={open}
        aria-label={custom ? `${legend}: ${colorName(value)}, zmień` : `${legend}: wybierz własny kolor`} title="Własny kolor" onClick={() => setOpen(state => !state)}>
        <span style={custom ? { background: current } : undefined} aria-hidden="true">
          {custom && <Check size={16} style={{ color: isLight(current) ? '#111827' : '#ffffff' }} />}
        </span>
      </button>
    </div>
    {open && <ColorWheel label={legend} initial={CUSTOM_COLOR.test(value) ? value : current} onPick={onChange} onClose={shut} />}
  </div>;
}
