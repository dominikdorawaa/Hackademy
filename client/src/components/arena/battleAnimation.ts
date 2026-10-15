export type BattleSide = 'left' | 'right';
export type BattleKind = 'hit' | 'clash' | 'defeat';
export interface BattleResult { id: string; kind: BattleKind; attacker: BattleSide }

export function playBattle(root: SVGSVGElement, result: BattleResult, reducedMotion: boolean,
  onImpact: () => void, onComplete: () => void) {
  const animations: Animation[] = [];
  const projectiles: Animation[] = [];
  const timers: ReturnType<typeof setTimeout>[] = [];
  const target: BattleSide = result.attacker === 'left' ? 'right' : 'left';
  const animate = (selector: string, frames: Keyframe[], options: KeyframeAnimationOptions) => {
    const element = root.querySelector<SVGElement>(selector);
    if (!element?.animate) return;
    const animation = element.animate(frames, { fill: 'both', ...options });
    animations.push(animation);
    return animation;
  };
  const later = (callback: () => void, delay: number) => timers.push(setTimeout(callback, delay));

  if (!reducedMotion) {
    const shooters: BattleSide[] = result.kind === 'clash' ? ['left', 'right'] : [result.attacker];
    shooters.forEach(side => {
      animate(`[data-fighter="${side}"] [data-part="body"]`, [
        { transform: 'translate(0, 0) rotate(0deg)' },
        { transform: 'translate(-4px, 0) rotate(-5deg)', offset: .25 },
        { transform: 'translate(5px, 0) rotate(5deg)', offset: .4 },
        { transform: 'translate(0, 0) rotate(0deg)' },
      ], { duration: 700 });
      animate(`[data-fighter="${side}"] [data-part="arm"]`, [
        { transform: 'rotate(0deg)' }, { transform: 'rotate(35deg)', offset: .25 },
        { transform: 'rotate(-65deg)', offset: .4 }, { transform: 'rotate(0deg)' },
      ], { duration: 700 });
      animate(`[data-charge="${side}"]`, [
        { opacity: 0, transform: 'scale(.2)' }, { opacity: 1, transform: 'scale(1.3)' },
        { opacity: 0, transform: 'scale(.8)' },
      ], { duration: 300 });
      const distance = result.kind === 'clash' ? 155 : 310;
      const projectile = animate(`[data-projectile="${side}"]`, [
        { opacity: 1, transform: 'translateX(0)' },
        { opacity: 1, transform: `translateX(${side === 'left' ? distance : -distance}px)` },
      ], { duration: 400, delay: 250, fill: 'forwards', easing: 'cubic-bezier(.3,0,.7,1)' });
      if (projectile) projectiles.push(projectile);
    });
    later(() => {
      projectiles.forEach(animation => animation.cancel());
      animate('[data-impact]', [{ opacity: 1, transform: 'scale(.4)' }, { opacity: 0, transform: 'scale(1.6)' }], { duration: 250 });
      if (result.kind !== 'clash') {
        animate(`[data-fighter="${target}"] [data-part="recoil"]`, [
          { transform: 'translateX(0)' }, { transform: 'translateX(-10px) rotate(-8deg)' },
          { transform: 'translateX(0)' },
        ], { duration: 250 });
        animate('[data-damage]', [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-24px)' }], { duration: 600 });
      }
      if (result.kind === 'defeat') {
        animate(`[data-fighter="${target}"] [data-part="body"]`, [
          { transform: 'translateY(0) rotate(0deg)' }, { transform: 'translateY(22px) rotate(-12deg)' },
        ], { duration: 250 });
        animate(`[data-fighter="${target}"] [data-part="leg"]`, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(65deg)' }], { duration: 250 });
        animate(`[data-fighter="${result.attacker}"] [data-part="arm"]`, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-145deg)' }], { duration: 250 });
      }
      onImpact();
    }, 650);
  } else {
    later(onImpact, 0);
  }
  later(onComplete, reducedMotion ? 120 : 900);
  return () => { timers.forEach(clearTimeout); animations.forEach(animation => animation.cancel()); };
}
