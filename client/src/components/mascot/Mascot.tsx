import { PixelSprite } from '../PixelSprite';
import type { SpriteSheet } from '../PixelSprite';
import './Mascot.css';

export type MascotMood = 'idle' | 'talk' | 'wave' | 'calm' | 'walkFront' | 'walkSide' | 'walkBack';

const sheet = (file: string, frames = 8): SpriteSheet => ({ src: `/assets/mascot/penguin-${file}.png`, frames, width: 58, height: 60 });
export const MASCOT_SPRITES: Record<MascotMood, SpriteSheet> = {
  idle: sheet('idle'), talk: sheet('talk'), wave: sheet('wave'), calm: sheet('calm', 10),
  walkFront: sheet('walk-front'), walkSide: sheet('walk-side'), walkBack: sheet('walk-back'),
};
const DURATION: Record<MascotMood, number> = { idle: 1400, talk: 900, wave: 1000, calm: 4000, walkFront: 720, walkSide: 720, walkBack: 720 };

export function Mascot({ mood = 'idle', scale = 2, still = false, className }: { mood?: MascotMood; scale?: number; still?: boolean; className?: string }) {
  return <span className={className ? `mascot ${className}` : 'mascot'} data-mood={mood}>
    <PixelSprite sprite={MASCOT_SPRITES[mood]} scale={scale} duration={DURATION[mood]} still={still} />
  </span>;
}
