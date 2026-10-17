import type { CSSProperties } from 'react';
import './PixelSprite.css';

export interface SpriteSheet { src: string; frames: number; width: number; height: number }

export const SPRITES = {
  flame: { src: '/assets/pixel/streak-flame.png', frames: 8, width: 23, height: 25 },
  flag: { src: '/assets/pixel/capture-flag.png', frames: 8, width: 28, height: 44 },
  bug: { src: '/assets/pixel/lost-bug.png', frames: 8, width: 38, height: 37 },
  room: { src: '/assets/pixel/step-room.png', frames: 8, width: 42, height: 43 },
  puzzle: { src: '/assets/pixel/step-puzzle.png', frames: 8, width: 42, height: 27 },
  trophy: { src: '/assets/pixel/step-trophy.png', frames: 8, width: 34, height: 42 },
} satisfies Record<string, SpriteSheet>;

export function PixelSprite({ sprite, scale = 1, duration = 800, still = false, className }: {
  sprite: SpriteSheet; scale?: number; duration?: number; still?: boolean; className?: string;
}) {
  const style = {
    '--sprite': `url(${sprite.src})`,
    '--sprite-frames': sprite.frames,
    '--sprite-width': `${sprite.width * scale}px`,
    '--sprite-height': `${sprite.height * scale}px`,
    '--sprite-duration': `${duration}ms`,
  } as CSSProperties;
  return <span className={className ? `pixel-sprite ${className}` : 'pixel-sprite'} data-still={still} style={style} aria-hidden="true" />;
}
