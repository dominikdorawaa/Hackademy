import { useEffect, useState } from 'react';
import { PixelSprite } from '../PixelSprite';
import type { SpriteSheet } from '../PixelSprite';
import './Mascot.css';

export type MascotMood = 'idle' | 'talk' | 'wave' | 'calm' | 'walkFront' | 'walkSide' | 'walkBack' | 'scuba';

const sheet = (file: string, frames = 8): SpriteSheet => ({ src: `/assets/mascot/penguin-${file}.png`, frames, width: 58, height: 59 });
export const MASCOT_SPRITES: Record<MascotMood, SpriteSheet> = {
  idle: sheet('idle'), talk: sheet('talk'), wave: sheet('wave'), calm: sheet('calm', 10),
  walkFront: sheet('walk-front', 16), walkSide: sheet('walk-side', 16), walkBack: sheet('walk-back', 16),
  scuba: sheet('dance-scuba', 16),
};
const DURATION: Record<MascotMood, number> = { idle: 1400, talk: 900, wave: 1000, calm: 4000, walkFront: 960, walkSide: 960, walkBack: 960, scuba: 1760 };
export const DANCE_LOOPS = 2;
export const DANCE_MS = DURATION.scuba * DANCE_LOOPS;

export function Mascot({ mood = 'idle', scale = 2, still = false, interactive = true, className }: { mood?: MascotMood; scale?: number; still?: boolean; interactive?: boolean; className?: string }) {
  const [dancing, setDancing] = useState(false);

  useEffect(() => {
    if (!dancing) return;
    const stop = setTimeout(() => setDancing(false), DANCE_MS);
    return () => clearTimeout(stop);
  }, [dancing]);

  const shown = dancing && !still ? 'scuba' : mood;
  const sprite = <span className={className ? `mascot ${className}` : 'mascot'} data-mood={shown}>
    <PixelSprite key={shown} sprite={MASCOT_SPRITES[shown]} scale={scale} duration={DURATION[shown]} still={still} />
  </span>;
  if (still || !interactive) return sprite;
  return <button type="button" className="mascot-dance-button" aria-label="Pingwin Bit, zatańcz" onClick={() => setDancing(true)}>{sprite}</button>;
}
