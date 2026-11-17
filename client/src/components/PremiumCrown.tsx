import type { CSSProperties } from 'react';
import './PremiumCrown.css';

const SPRITE = { '--crown-sprite': 'url(/assets/premium/crown.png)' } as CSSProperties;

export function PremiumCrown({ className }: { className?: string }) {
  return <span className={['premium-crown', className].filter(Boolean).join(' ')} role="img" aria-label="Premium" style={SPRITE}>
    <span className="premium-crown-sprite" aria-hidden="true" />
  </span>;
}
