import { PixelSprite } from '../PixelSprite';
import type { SpriteSheet } from '../PixelSprite';
import './Mascot.css';

export type MascotMood = 'idle' | 'talk' | 'wave';

const sheet = (mood: MascotMood): SpriteSheet => ({ src: `/assets/mascot/penguin-${mood}.png`, frames: 8, width: 56, height: 59 });
export const MASCOT_SPRITES: Record<MascotMood, SpriteSheet> = { idle: sheet('idle'), talk: sheet('talk'), wave: sheet('wave') };
const DURATION: Record<MascotMood, number> = { idle: 1400, talk: 900, wave: 1000 };

export function Mascot({ mood = 'idle', scale = 2, still = false, className }: { mood?: MascotMood; scale?: number; still?: boolean; className?: string }) {
  return <span className={className ? `mascot ${className}` : 'mascot'} data-mood={mood}>
    <PixelSprite sprite={MASCOT_SPRITES[mood]} scale={scale} duration={DURATION[mood]} still={still} />
  </span>;
}
