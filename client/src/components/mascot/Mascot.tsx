import { PixelSprite } from '../PixelSprite';
import type { SpriteSheet } from '../PixelSprite';
import './Mascot.css';

export type MascotMood = 'idle' | 'talk' | 'wave' | 'walk' | 'calm';

const sheet = (mood: MascotMood, frames = 8): SpriteSheet => ({ src: `/assets/mascot/penguin-${mood}.png`, frames, width: 56, height: 59 });
export const MASCOT_SPRITES: Record<MascotMood, SpriteSheet> = { idle: sheet('idle'), talk: sheet('talk'), wave: sheet('wave'), walk: sheet('walk'), calm: sheet('calm', 10) };
const DURATION: Record<MascotMood, number> = { idle: 1400, talk: 900, wave: 1000, walk: 640, calm: 4000 };

export function Mascot({ mood = 'idle', scale = 2, still = false, className }: { mood?: MascotMood; scale?: number; still?: boolean; className?: string }) {
  return <span className={className ? `mascot ${className}` : 'mascot'} data-mood={mood}>
    <PixelSprite sprite={MASCOT_SPRITES[mood]} scale={scale} duration={DURATION[mood]} still={still} />
  </span>;
}
