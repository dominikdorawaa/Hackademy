import type { ActivityDto } from '../../types/api';
import { localDateKey, profileActivityFacts, solvedRoomsLabel } from '../../lib/activity';
import ProfileIcon from './ProfileIcon';
import { LoadingSkeleton, Skeleton } from '../common/Skeleton';
import type { ProfileIconKind } from './ProfileIcon';

export default function ProfileLearningStats({ activity, loading }: {
  activity: ActivityDto[] | null;
  loading: boolean;
}) {
  const facts = activity ? profileActivityFacts(activity, new Date()) : null;
  const best = facts?.bestDay;
  const rows = best && facts ? [
    {
      label: 'Rekord dnia',
      icon: 'award' as ProfileIconKind,
      value: best.count.toLocaleString('pl-PL'),
      unit: solvedRoomsLabel(best.count).split(' ').at(-1),
    },
    {
      label: 'Najdłuższa seria',
      icon: 'streak' as ProfileIconKind,
      value: facts.longestStreak.toLocaleString('pl-PL'),
      unit: facts.longestStreak === 1 ? 'dzień' : 'dni',
    },
    {
      label: 'Średnia',
      icon: 'network' as ProfileIconKind,
      value: facts.averagePerActiveDay.toLocaleString('pl-PL', { maximumFractionDigits: 1 }),
      unit: 'na aktywny dzień',
    },
  ] : [];

  return <section className="profile-section profile-learning-stats" aria-labelledby="profile-learning-stats-title">
    <div className="profile-stats-heading"><h2 id="profile-learning-stats-title">Statystyki nauki</h2>
      <p className="profile-stats-period">Ostatnie 12 tygodni</p></div>
    {loading ? <LoadingSkeleton label="Ładowanie statystyk" className="profile-learning-stats-list">
      {[0, 1, 2, 3].map(index => <div key={index} aria-hidden="true"><Skeleton width="45%" height={16} style={{ marginBottom: 8 }} /><Skeleton width={64} height={28} /></div>)}
    </LoadingSkeleton>
      : !activity ? <p className="profile-muted">Statystyki są niedostępne. Ponów pobieranie w sekcji „Regularność nauki”.</p>
      : !rows.length ? <p className="profile-muted">Statystyki pojawią się po pierwszym rozwiązanym pokoju.</p>
      : <dl className="profile-learning-stats-list">{rows.map(row => <div key={row.label}>
        <dt><ProfileIcon kind={row.icon} size={20} />{row.label}</dt><dd><span className="profile-stat-value">{row.value}</span>{row.label === 'Średnia' && <span className="sr-only"> rozwiązań </span>}<span className="profile-stat-unit">{row.unit}</span></dd>
      </div>)}
        {best && <div className="profile-stat-date"><dt><ProfileIcon kind="calendar" size={20} />Dzień rekordu</dt>
          <dd><time dateTime={localDateKey(best.date)}>{best.date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}</time></dd>
        </div>}
      </dl>}
  </section>;
}
