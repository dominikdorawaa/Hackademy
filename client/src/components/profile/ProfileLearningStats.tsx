import type { ActivityDto } from '../../types/api';
import { profileActivityFacts, solvedRoomsLabel } from '../../lib/activity';

export default function ProfileLearningStats({ activity, loading }: {
  activity: ActivityDto[] | null;
  loading: boolean;
}) {
  const facts = activity ? profileActivityFacts(activity, new Date()) : null;
  const best = facts?.bestDay;
  const rows = best && facts ? [
    {
      label: 'Rekord jednego dnia',
      value: best.count.toLocaleString('pl-PL'),
      detail: `${solvedRoomsLabel(best.count)} · ${best.date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}`,
    },
    {
      label: 'Najdłuższa seria',
      value: `${facts.longestStreak} ${facts.longestStreak === 1 ? 'dzień' : 'dni'}`,
      detail: 'Z co najmniej jednym rozwiązaniem dziennie',
    },
    {
      label: 'Najaktywniejszy dzień',
      value: best.date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }),
      detail: `${best.count.toLocaleString('pl-PL')} ${solvedRoomsLabel(best.count)}`,
    },
    {
      label: 'Średnia w aktywnym dniu',
      value: facts.averagePerActiveDay.toLocaleString('pl-PL', { maximumFractionDigits: 1 }),
      detail: 'Rozwiązań na dzień z aktywnością',
    },
  ] : [];

  return <section className="profile-section profile-learning-stats" aria-labelledby="profile-learning-stats-title">
    <div className="profile-section-heading"><h2 id="profile-learning-stats-title">Statystyki nauki</h2></div>
    <p className="profile-stats-period">Ostatnie 12 tygodni</p>
    {loading ? <p className="profile-muted" role="status">Ładowanie statystyk…</p>
      : !activity ? <p className="profile-muted">Statystyki są niedostępne. Ponów pobieranie w sekcji „Regularność nauki”.</p>
      : !rows.length ? <p className="profile-muted">Statystyki pojawią się po pierwszym rozwiązanym pokoju.</p>
      : <dl className="profile-learning-stats-list">{rows.map(row => <div key={row.label}>
        <dt>{row.label}<small>{row.detail}</small></dt><dd>{row.value}</dd>
      </div>)}</dl>}
  </section>;
}
