import { Link } from 'react-router-dom';
import { PremiumCrown } from '../PremiumCrown';
import './ArenaDailyLimit.css';

export function ArenaGamesLeft({ left, limit }: { left: number; limit: number }) {
  return <div className="arena-games" role="status" aria-label={`Dziś zostało Ci ${left} z ${limit} walk`}>
    <span className="arena-games-label">Walki dziś</span>
    <span className="arena-games-pips" aria-hidden="true">
      {Array.from({ length: limit }, (_, index) => <span key={index} className={index < left ? 'is-left' : undefined} />)}
    </span>
    <span className="arena-games-count" aria-hidden="true">{left}/{limit}</span>
    <Link className="arena-games-premium" to="/premium"><PremiumCrown className="arena-games-crown" />Bez limitu z Premium</Link>
  </div>;
}

export function ArenaLimitNote() {
  return <p className="arena-limit-note">
    <PremiumCrown className="arena-games-crown" />
    <span>Dzisiejsze walki są wykorzystane, więc wyzwania wrócą o północy. <Link to="/premium">Graj bez limitu z Premium</Link></span>
  </p>;
}

export function ArenaLimitReached({ limit }: { limit: number }) {
  return <section className="arena-limit-reached" aria-labelledby="arena-limit-title">
    <PremiumCrown className="arena-limit-crown" />
    <div className="arena-limit-copy">
      <h2 id="arena-limit-title">Na dziś to wszystko</h2>
      <p>Dzisiejszy limit darmowych walk ({limit}) jest wykorzystany. Kolejne walki odblokują się o północy, a z Premium walczysz bez limitu.</p>
    </div>
    <Link className="arena-limit-cta" to="/premium">Graj dalej z Premium</Link>
  </section>;
}
