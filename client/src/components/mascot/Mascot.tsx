import { PixelSprite } from '../PixelSprite';
import type { SpriteSheet } from '../PixelSprite';
import './Mascot.css';

export type MascotDance = 'groove' | 'sixseven' | 'scuba';
export type MascotMood = 'idle' | 'talk' | 'wave' | 'calm' | 'walkFront' | 'walkSide' | 'walkBack' | MascotDance;

export const MASCOT_DANCES: MascotDance[] = ['groove', 'sixseven', 'scuba'];
export const MASCOT_DANCE_NAMES: Record<MascotDance, string> = { groove: 'Luz', sixseven: 'Six-seven', scuba: 'Scuba' };

const sheet = (file: string, frames = 8): SpriteSheet => ({ src: `/assets/mascot/penguin-${file}.png`, frames, width: 58, height: 60 });
export const MASCOT_SPRITES: Record<MascotMood, SpriteSheet> = {
  idle: sheet('idle'), talk: sheet('talk'), wave: sheet('wave'), calm: sheet('calm', 10),
  walkFront: sheet('walk-front', 16), walkSide: sheet('walk-side', 16), walkBack: sheet('walk-back', 16),
  groove: sheet('dance-groove', 16), sixseven: sheet('dance-sixseven', 16), scuba: sheet('dance-scuba', 16),
};
const DURATION: Record<MascotMood, number> = { idle: 1400, talk: 900, wave: 1000, calm: 4000, walkFront: 960, walkSide: 960, walkBack: 960, groove: 1600, sixseven: 1600, scuba: 1600 };

export const mascotDuration = (mood: MascotMood) => DURATION[mood];

export function Mascot({ mood = 'idle', scale = 2, still = false, className }: { mood?: MascotMood; scale?: number; still?: boolean; className?: string }) {
  return <span className={className ? `mascot ${className}` : 'mascot'} data-mood={mood}>
    <PixelSprite key={mood} sprite={MASCOT_SPRITES[mood]} scale={scale} duration={DURATION[mood]} still={still} />
  </span>;
}
