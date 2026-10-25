import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { RankingEntry } from '../../types/api';
import { EloHelp } from '../arena/EloHelp';
import { LeagueIcon } from '../arena/LeagueIcon';
import { leagueFor, leagueProgress } from '../arena/leagues';

const formatNumberPL = (n: number) => (Number(n) || 0).toLocaleString('pl-PL');

// The dashboard's arena panel: league, Elo, progress to the next league and the place in the Elo ranking.
export function ArenaRankPanel({ rank }: { rank: RankingEntry | null }) {
  return (
    <section className="ud-panel ud-arena" aria-labelledby="ud-arena-title">
      <div className="ud-section-head">
        <h2 id="ud-arena-title">Arena</h2>
        <Link className="ud-link" to="/arena">
          Graj
        </Link>
      </div>
      {rank ? <ArenaRank rank={rank} /> : <ArenaRankMissing />}
    </section>
  );
}

function ArenaRank({ rank }: { rank: RankingEntry }) {
  const elo = rank.elo;
  const { league, next } = leagueFor(elo);

  return (
    <>
      <div className="ud-arena-hero">
        <LeagueIcon league={league} className="ud-arena-badge" />
        <div className="ud-arena-who">
          <span>Liga {league.name}</span>
          <p className="ud-level-xp">
            <strong>{formatNumberPL(elo)}</strong>{' '}
            <EloHelp />
          </p>
        </div>
      </div>

      {next && (
        <>
          <div className="ud-arena-span">
            <LeagueIcon league={league} />
            <div
              className="ud-meter"
              role="progressbar"
              aria-label={`Postęp do ligi ${next.name}`}
              aria-valuemin={league.min}
              aria-valuemax={next.min}
              aria-valuenow={elo}
            >
              <span style={{ '--ud-fill': leagueProgress(elo) } as CSSProperties} />
            </div>
            <LeagueIcon league={next} />
          </div>
          <p className="ud-arena-ends">
            <span>
              <b>{formatNumberPL(league.min)}</b> {league.name}
            </span>
            <span>
              {next.name} <b>{formatNumberPL(next.min)}</b>
            </span>
          </p>
        </>
      )}

      <dl className="ud-facts">
        <div>
          <dt>Miejsce w arenie</dt>
          <dd>{rank.rankElo != null ? `#${rank.rankElo}` : '–'}</dd>
        </div>
        {next ? (
          <div>
            <dt>Do awansu</dt>
            <dd>{formatNumberPL(next.min - elo)} Elo</dd>
          </div>
        ) : (
          <div>
            <dt>Liga</dt>
            <dd>Najwyższa</dd>
          </div>
        )}
      </dl>
    </>
  );
}

function ArenaRankMissing() {
  return (
    <>
      <p className="ud-level-xp">
        <strong>–</strong> Elo
      </p>
      <p className="ud-muted" role="status">
        Nie udało się wczytać rangi areny.
      </p>
    </>
  );
}
