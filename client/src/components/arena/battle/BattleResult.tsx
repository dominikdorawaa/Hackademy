import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { formatEloChange } from '../../../lib/units';
import type { Outcome } from './battleView';

export const ELO_COUNT_MS = 1400;
const CONFETTI = 36;
const COLORS = ['#5fb4ff', '#ffb15c', '#2fd0b0', '#ffe066', '#ff7eb6', '#eef4ff'];

const easeOut = (t: number) => 1 - (1 - t) ** 3;

function EloCount({ change, still }: { change: number; still: boolean }) {
  const [shown, setShown] = useState<number | null>(still || change === 0 ? null : 0);
  useEffect(() => {
    if (still || change === 0) return;
    let frame = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      start ??= now;
      const progress = Math.min(1, (now - start) / ELO_COUNT_MS);
      setShown(progress >= 1 ? null : Math.round(change * easeOut(progress)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [change, still]);
  if (shown === null) return <p className="battle-result-elo">{formatEloChange(change)}</p>;
  return (
    <p className="battle-result-elo is-counting">
      <span aria-hidden="true">{formatEloChange(shown)}</span>
      <span className="sr-only">{formatEloChange(change)}</span>
    </p>
  );
}

function Confetti() {
  return (
    <div className="battle-confetti" aria-hidden="true">
      {Array.from({ length: CONFETTI }, (_, index) => {
        const style = {
          '--x': `${(index * 37) % 100}%`,
          '--drift': `${((index * 53) % 41) - 20}vw`,
          '--spin': `${((index * 71) % 5) + 2}turn`,
          '--delay': `${(index * 97) % 900}ms`,
          '--fall': `${2200 + ((index * 131) % 1400)}ms`,
          '--size': `${6 + (index % 3) * 4}px`,
          background: COLORS[index % COLORS.length],
        } as CSSProperties;
        return <span key={index} style={style} />;
      })}
    </div>
  );
}

export function BattleResult({ result, title, text, change, still }: { result: Outcome; title: string; text: string; change: number; still: boolean }) {
  return <>
    {result === 'win' && !still && <Confetti />}
    <section className={`battle-result is-${result}`} aria-labelledby="battle-result-title">
      <h1 id="battle-result-title">{title}</h1>
      <p>{text}</p>
      <EloCount change={change} still={still} />
      <Link className="ud-btn ud-btn-solid" to="/arena">Wróć do Areny</Link>
    </section>
  </>;
}
