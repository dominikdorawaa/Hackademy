import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

const WIDTH = 320;
const HEIGHT = 120;

const ASSET = '/assets/pixel/banners/dyzur-zero';
const LED_DELAYS = [0, -1700, -3900, -5800];
export default function DyzurZeroBanner({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <div className={cn('path-art path-art--zero', className)}>
      <div className="path-art-stage">
        <img src={`${ASSET}.png`} alt="" width={WIDTH} height={HEIGHT} />
        <span className="path-art-anim" aria-hidden="true">
          <img className="path-art-penguin" src={`${ASSET}-penguin-blink.png`} alt="" width={WIDTH} height={HEIGHT} />
          <img className="path-art-cursor" src={`${ASSET}-cursor-off.png`} alt="" width={WIDTH} height={HEIGHT} />
          {LED_DELAYS.map((delay, index) => (
            <img key={index} className="path-art-led" src={`${ASSET}-led-${index + 1}-off.png`} alt="" width={WIDTH} height={HEIGHT} style={{ animationDelay: `${delay}ms` }} />
          ))}
        </span>
      </div>
      {children}
    </div>
  );
}
