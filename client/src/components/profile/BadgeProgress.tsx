import type { BadgeDto } from '../../types/api';
import { XP_UNIT, formatNumberPL } from '../../lib/units';

const units = {
  POINTS: XP_UNIT,
  STREAK: 'dni z rzędu',
  SOLVED_COUNT: 'rozwiązanych pokoi',
  FRIENDS_COUNT: 'znajomych',
};

export default function BadgeProgress({ badge }: { badge: BadgeDto }) {
  const data = badge.progress;
  if (!data || data.target < 0) return null;
  const target = data.target;
  const current = badge.earned ? target : Math.max(0, Math.min(data.current, target));
  const percent = target === 0 ? 100 : Math.round(current / target * 100);
  return <div className="badge-goal-progress">
    <div><span>{formatNumberPL(current)} / {formatNumberPL(target)} {units[data.conditionType]}</span><span>{percent}%</span></div>
    <progress max={Math.max(1, target)} value={target === 0 ? 1 : current}
      aria-label={`Postęp osiągnięcia: ${badge.name}`} />
  </div>;
}
