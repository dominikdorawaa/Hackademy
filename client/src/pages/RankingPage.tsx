import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, BookOpen, Swords } from 'lucide-react';
import * as rankingApi from '../services/rankingApi';
import { useAuth } from '../context/AuthContext';
import UserAvatar from '../components/UserAvatar';
import { PixelSprite, SPRITES } from '../components/PixelSprite';
import { LeagueIcon } from '../components/arena/LeagueIcon';
import { leagueFor } from '../components/arena/leagues';
import { LoadingSkeleton, Skeleton } from '../components/common/Skeleton';
import { levelFromPoints, rankTitleFromPoints } from '../lib/level';
import type { RankingEntry, RankingSummaryDto } from '../types/api';
import '../components/room/room.css';
import './RankingPage.css';

type Metric = 'points' | 'elo';
type Result = { sessionKey: string | null; status: 'loading' | 'ready' | 'error'; data: RankingSummaryDto | null };
const format = (value: number) => value.toLocaleString('pl-PL');
const score = (entry: RankingEntry, metric: Metric) => metric === 'points' ? entry.points ?? 0 : entry.elo ?? 500;
const place = (entry: RankingEntry, metric: Metric) => metric === 'points' ? entry.rankPoints : entry.rankElo;

function Podium({ players, metric, username }: { players: RankingEntry[]; metric: Metric; username?: string }) {
  return (
    <ol className="ranking-podium" aria-label="Podium">
      {players.map(entry => {
        const position = place(entry, metric);
        const me = entry.username === username;
        const profile = me ? '/profile' : `/profile/${encodeURIComponent(entry.username)}`;
        return (
          <li key={entry.username} className={`ranking-podium-player place-${position}${me ? ' is-me' : ''}`} aria-current={me ? 'true' : undefined}>
            <div className="ranking-podium-avatar">
              {position === 1 && <PixelSprite sprite={SPRITES.trophy} still className="ranking-trophy" />}
              <Link to={profile} aria-label={`Profil gracza ${entry.username}`}><UserAvatar username={entry.username} avatar={entry.avatar} alt="" width={64} height={64} /></Link>
              <span className="ranking-podium-place">#{position}</span>
            </div>
            <div className="ranking-podium-name"><Link to={profile}>{entry.username}</Link>{me && <span className="ranking-you">Ty</span>}</div>
            <div className="ranking-podium-score"><strong>{format(score(entry, metric))}</strong><span>{metric === 'points' ? 'XP' : 'Elo'}</span></div>
            <span className="ranking-podium-detail">{metric === 'points' ? `Poziom ${levelFromPoints(score(entry, metric))}` : leagueFor(score(entry, metric)).league.name}</span>
            <div className="ranking-podium-step" aria-hidden="true"><span>{position}</span></div>
          </li>
        );
      })}
    </ol>
  );
}

function RankingGoal({ own, ranking, metric }: { own: RankingEntry; ranking: RankingEntry[]; metric: Metric }) {
  const unit = metric === 'points' ? 'XP' : 'Elo';
  const target = ranking.filter(entry => score(entry, metric) > score(own, metric)).sort((a, b) => score(a, metric) - score(b, metric))[0];
  if (place(own, metric) === 1) return <div className="ranking-goal is-leading"><PixelSprite sprite={SPRITES.trophy} still /><div><strong>Jesteś na szczycie!</strong><p>Pierwsze miejsce jest Twoje. Utrzymaj prowadzenie.</p></div></div>;
  if (!target) return null;
  const goal = score(target, metric) + 1;
  const gap = goal - score(own, metric);
  const position = place(target, metric);
  return (
    <div className="ranking-goal">
      <div className="ranking-goal-copy"><span>Twój następny cel{position ? `: #${position}` : ''}</span><strong>{target.username}</strong><p>Do wyprzedzenia <b>{format(gap)} {unit}</b></p></div>
      <Link to={metric === 'points' ? '/learn' : '/arena'} className="ranking-goal-action">{metric === 'points' ? 'Zdobądź XP' : 'Podejmij pojedynek'}<ArrowUpRight size={16} aria-hidden="true" /></Link>
      {goal > 0 && <progress className="ranking-goal-progress" max={goal} value={Math.max(0, score(own, metric))} aria-label={`Twój wynik na drodze do wyprzedzenia ${target.username}`} />}
    </div>
  );
}

function PlayerRow({ entry, metric, username }: { entry: RankingEntry; metric: Metric; username?: string }) {
  const me = entry.username === username;
  const position = metric === 'points' ? entry.rankPoints : entry.rankElo;
  const value = score(entry, metric);
  const { league } = leagueFor(entry.elo ?? 500);
  const profile = me ? '/profile' : `/profile/${encodeURIComponent(entry.username)}`;

  return (
    <tr className={me ? 'ranking-row is-me' : 'ranking-row'} aria-current={me ? 'true' : undefined}>
      <td className="ranking-place">{position && position > 0 ? `#${position}` : '–'}</td>
      <td>
        <div className="ranking-player">
          <Link to={profile} className="ranking-portrait" aria-label={`Profil gracza ${entry.username}`}>
            <UserAvatar username={entry.username} avatar={entry.avatar} alt="" width={40} height={40} />
          </Link>
          <div className="ranking-identity">
            <div className="ranking-name"><Link to={profile}>{entry.username}</Link>{me && <span className="ranking-you">Ty</span>}</div>
            <span className="ranking-player-detail">
              {metric === 'elo' ? <><LeagueIcon league={league} /><span>{league.name}</span></> : `Poziom ${levelFromPoints(value)} · ${rankTitleFromPoints(value)}`}
            </span>
          </div>
        </div>
      </td>
      <td className="ranking-score"><strong>{format(value)}</strong><span>{metric === 'points' ? 'XP' : 'Elo'}</span></td>
    </tr>
  );
}

function RankingBoard({ metric, data }: { metric: Metric; data: RankingSummaryDto }) {
  const players = [...data.ranking].sort((a, b) => score(b, metric) - score(a, metric) || a.username.localeCompare(b.username, 'pl')).slice(0, 10);
  const podium = players.slice(0, 3).filter(entry => { const position = place(entry, metric); return position !== null && position > 0 && position <= 3; });
  const rows = players.filter(entry => !podium.includes(entry));
  const username = data.user?.username ?? data.myRank?.username;
  const own = data.myRank;
  const showOwn = own && !players.some(player => player.username === own.username);
  const arena = metric === 'elo';
  const id = `ranking-${metric}`;

  return (
    <section className="ranking-board" aria-labelledby={id} data-tour={arena ? 'ranking-elo' : 'ranking-points'}>
      <header className="ranking-board-head">
        <h2 id={id}>{arena ? 'Ranking Areny' : 'Ranking nauki'}</h2>
        <p>{arena ? 'Elo zdobywane w pojedynkach. Każda walka ma znaczenie.' : 'XP zdobywane za rozwiązywanie zadań i pokoi.'}</p>
      </header>
      {podium.length > 0 && <Podium players={podium} metric={metric} username={username} />}
      {own && <RankingGoal own={own} ranking={data.ranking} metric={metric} />}
      {rows.length > 0 || showOwn ? (
        <table className="ranking-table">
          <caption className="ranking-sr">{arena ? 'Najlepsi gracze według Elo' : 'Najlepsi gracze według XP'}</caption>
          <thead><tr><th scope="col">Miejsce</th><th scope="col">Gracz</th><th scope="col">{arena ? 'Elo' : 'XP'}</th></tr></thead>
          <tbody>{rows.map(entry => <PlayerRow key={entry.username} entry={entry} metric={metric} username={username} />)}</tbody>
          {showOwn && <tbody className="ranking-personal"><tr><td colSpan={3} className="ranking-personal-label">Twoja pozycja</td></tr><PlayerRow entry={own} metric={metric} username={username} /></tbody>}
        </table>
      ) : players.length === 0 && <div className="ranking-empty"><h3>Pierwsze miejsce czeka</h3><p>{arena ? 'Po pierwszych pojedynkach pojawią się tu gracze Areny.' : 'Zdobywaj XP i dołącz do rankingu nauki.'}</p></div>}
      <footer className="ranking-board-footer">
        <span>Najlepsza dziesiątka{username ? ' i Twoja pozycja' : ''}</span>
        <Link to={arena ? '/arena' : '/learn'}>{arena ? 'Wejdź na arenę' : 'Zdobywaj XP'}<ArrowUpRight aria-hidden="true" size={16} /></Link>
      </footer>
    </section>
  );
}

export default function RankingPage() {
  const { sessionKey } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result>({ sessionKey, status: 'loading', data: null });
  const state = result.sessionKey === sessionKey ? result : { sessionKey, status: 'loading' as const, data: null };

  useEffect(() => {
    let active = true;
    setResult({ sessionKey, status: 'loading', data: null });
    rankingApi.getSummary({ sessionKey }).then(async response => {
      if (!response.ok) throw new Error('Ranking unavailable');
      const data = await response.json();
      if (active) setResult({ sessionKey, status: 'ready', data: { ranking: Array.isArray(data?.ranking) ? data.ranking : [], user: data?.user ?? null, myRank: data?.myRank ?? null } });
    }).catch(() => { if (active) setResult({ sessionKey, status: 'error', data: null }); });
    return () => { active = false; };
  }, [sessionKey, attempt]);

  return (
    <div className="room-tokens ranking-page">
      <div className="ranking-shell">
        <header className="ranking-heading">
          <div><h1>Ranking</h1><p>Dwie drogi na szczyt. Rozwiązuj zadania, zdobywaj XP i sprawdzaj się na Arenie.</p></div>
          <nav className="ranking-actions" aria-label="Rozwijaj swój wynik"><Link to="/learn"><BookOpen size={18} aria-hidden="true" />Ucz się</Link><Link to="/arena"><Swords size={18} aria-hidden="true" />Arena</Link></nav>
        </header>
        {state.status === 'loading' && <LoadingSkeleton label="Ładowanie rankingów"><div className="ranking-grid">{[0, 1].map(board => <div key={board} className="ranking-board ranking-loading"><Skeleton width="55%" height={36} />{Array.from({ length: 10 }, (_, row) => <Skeleton key={row} height={68} />)}</div>)}</div></LoadingSkeleton>}
        {state.status === 'error' && <section className="ranking-error" role="alert"><h2>Ranking chwilowo niedostępny</h2><p>Nie udało się pobrać wyników. Spróbuj ponownie za chwilę.</p><button type="button" onClick={() => setAttempt(value => value + 1)}>Spróbuj ponownie</button></section>}
        {state.status === 'ready' && state.data && <><div className="ranking-grid"><RankingBoard metric="points" data={state.data} /><RankingBoard metric="elo" data={state.data} /></div>{!state.data.user && !state.data.myRank && <p className="ranking-guest"><Link to="/login">Zaloguj się</Link>, aby zobaczyć swoją pozycję w obu rankingach.</p>}</>}
      </div>
    </div>
  );
}
