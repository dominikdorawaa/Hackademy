import { useEffect, useId, useState } from 'react';
import { atlasViewBox } from './fighters';

export const KNEE_ROW = 45;

export function AvatarSprite({ atlas, atlasHeight, frames, frameTime = 110, loop = true, reducedMotion = false, knee, label }: {
  atlas: string; atlasHeight: number; frames: number[]; frameTime?: number; loop?: boolean; reducedMotion?: boolean; knee?: number; label: string;
}) {
  const sequence = frames.join(',');
  const [state, setState] = useState({ sequence, step: 0 });
  const step = state.sequence === sequence ? state.step : 0;
  const clip = useId().replace(/[^a-zA-Z0-9]/g, '');
  useEffect(() => {
    const count = sequence.split(',').length;
    if (reducedMotion || count <= 1 || (!loop && step >= count - 1)) return;
    const timer = setTimeout(() => setState({ sequence, step: loop ? (step + 1) % count : step + 1 }), frameTime);
    return () => clearTimeout(timer);
  }, [sequence, step, frameTime, loop, reducedMotion]);
  const frame = reducedMotion ? frames[loop ? 0 : frames.length - 1] : frames[step % frames.length];
  const image = <image href={atlas} width="576" height={atlasHeight} />;
  if (knee === undefined) return <svg className="avatar-sprite" viewBox={atlasViewBox(frame)} role="img" aria-label={label} data-frame={frame}>{image}</svg>;
  const x = frame % 9 * 64, y = Math.floor(frame / 9) * 64;
  return <svg className="avatar-sprite" viewBox={atlasViewBox(frame)} role="img" aria-label={label} data-frame={frame}>
    <clipPath id={`${clip}-legs`}><rect x={x} y={y + knee} width="64" height={64 - knee} /></clipPath>
    <clipPath id={`${clip}-body`}><rect x={x} y={y} width="64" height={knee} /></clipPath>
    <g clipPath={`url(#${clip}-legs)`}>{image}</g>
    <g className="avatar-sprite-body" clipPath={`url(#${clip}-body)`}>{image}</g>
  </svg>;
}
