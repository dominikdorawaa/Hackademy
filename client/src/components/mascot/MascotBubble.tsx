import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import { Mascot } from './Mascot';
import type { MascotMood } from './Mascot';
import './MascotBubble.css';

export const MascotBubble = forwardRef<HTMLDivElement, {
  title: string; children: ReactNode; actions?: ReactNode; mood?: MascotMood; still?: boolean; className?: string; id?: string; role?: 'dialog' | 'region'; mascot?: boolean; onMascotClick?: () => void;
}>(function MascotBubble({ title, children, actions, mood = 'talk', still = false, className, id, role = 'region', mascot = true, onMascotClick }, ref) {
  const titleId = `${id ?? 'mascot'}-title`;
  return <div ref={ref} id={id} className={className ? `mascot-bubble ${className}` : 'mascot-bubble'} role={role} aria-labelledby={titleId} tabIndex={-1}>
    {mascot && (onMascotClick
      ? <button type="button" className="mascot-dance-button" aria-label="Pingwin Bit, zatańcz" onClick={onMascotClick}><Mascot mood={mood} still={still} className="mascot-bubble-mascot" /></button>
      : <Mascot mood={mood} still={still} className="mascot-bubble-mascot" />)}
    <div className="mascot-bubble-box">
      <p className="mascot-bubble-name">Pingwin Bit</p>
      <h2 id={titleId} className="mascot-bubble-title">{title}</h2>
      <div className="mascot-bubble-text" aria-live="polite">{children}</div>
      {actions && <div className="mascot-bubble-actions">{actions}</div>}
    </div>
  </div>;
});
