import type { ActivityDto } from '../../types/api';
import { localDateKey, profileActivityFacts } from '../../lib/activity';

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
      unit: 'rozwiązań',
    },
    {
      label: 'Najdłuższa seria',
      value: facts.longestStreak.toLocaleString('pl-PL'),
      unit: facts.longestStreak === 1 ? 'dzień z aktywnością' : 'dni z aktywnością',
    },
    {
      label: 'Średnia w aktywnym dniu',
      value: facts.averagePerActiveDay.toLocaleString('pl-PL', { maximumFractionDigits: 1 }),
      unit: 'rozwiązań',
    },
  ] : [];

  return <section className="profile-section profile-learning-stats" aria-labelledby="profile-learning-stats-title">
    <div className="profile-stats-heading"><h2 id="profile-learning-stats-title">Statystyki nauki</h2>
      <p className="profile-stats-period">Ostatnie 12 tygodni</p></div>
    {loading ? <p className="profile-muted" role="status">Ładowanie statystyk…</p>
      : !activity ? <p className="profile-muted">Statystyki są niedostępne. Ponów pobieranie w sekcji „Regularność nauki”.</p>
      : !rows.length ? <p className="profile-muted">Statystyki pojawią się po pierwszym rozwiązanym pokoju.</p>
      : <dl className="profile-learning-stats-list">{rows.map(row => <div key={row.label}>
        <dt>{row.label}</dt><dd><span className="profile-stat-value">{row.value}</span><span className="profile-stat-unit">{row.unit}</span></dd>
      </div>)}
        {best && <div className="profile-stat-date"><dt>Najaktywniejszy dzień</dt>
          <dd><time dateTime={localDateKey(best.date)}>{best.date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}</time></dd>
        </div>}
      </dl>}
  </section>;
}
