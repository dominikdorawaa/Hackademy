import { useEffect, useState } from 'react';
import { atlasViewBox } from './fighters';

export function AvatarSprite({ atlas, atlasHeight, frames, frameTime = 110, loop = true, reducedMotion = false, label }: {
  atlas: string; atlasHeight: number; frames: number[]; frameTime?: number; loop?: boolean; reducedMotion?: boolean; label: string;
}) {
  const sequence = frames.join(',');
  const [state, setState] = useState({ sequence, step: 0 });
  useEffect(() => {
    if (reducedMotion) return;
    const count = sequence.split(',').length;
    const timer = setInterval(() => setState(previous => {
      const step = previous.sequence === sequence ? previous.step + 1 : 1;
      return { sequence, step: loop ? step : Math.min(step, count - 1) };
    }), frameTime);
    return () => clearInterval(timer);
  }, [sequence, frameTime, loop, reducedMotion]);
  const step = state.sequence === sequence ? state.step : 0;
  const frame = reducedMotion ? frames[loop ? 0 : frames.length - 1] : frames[step % frames.length];
  return <svg className="avatar-sprite" viewBox={atlasViewBox(frame)} role="img" aria-label={label} data-frame={frame}>
    <image href={atlas} width="576" height={atlasHeight} />
  </svg>;
}
