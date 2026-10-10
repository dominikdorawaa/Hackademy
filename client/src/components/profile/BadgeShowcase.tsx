import type { BadgeDto } from '../../types/api';
import { Button } from '../ui/button';
import BadgeIcon from './BadgeIcon';

export default function BadgeShowcase({ badges, selectedIds, own, onEdit }: {
  badges: BadgeDto[]; selectedIds: number[]; own: boolean; onEdit: () => void;
}) {
  const earned = badges.filter(badge => badge.earned);
  if (!earned.length) return null;
  const selected = selectedIds.flatMap(id => { const badge = earned.find(item => item.id === id); return badge ? [badge] : []; });
  const displayed = selected.length ? selected : [...earned].sort((a, b) => (b.earnedAt ?? '').localeCompare(a.earnedAt ?? '') || a.id - b.id).slice(0, 3);
  return <section className="profile-showcase" aria-labelledby="profile-showcase-title">
    <div className="profile-showcase-heading">
      <h2 id="profile-showcase-title">Wyróżnione osiągnięcia</h2>
      {own && <Button variant="ghost" size="sm" onClick={onEdit}>Wybierz odznaki</Button>}
    </div>
    <ul className="profile-showcase-grid">{displayed.map(badge => <li key={badge.id}>
      <BadgeIcon badge={badge} /><div><h3>{badge.name}</h3><p>{badge.description}</p>
        <span>{badge.rarityPercentage.toLocaleString('pl-PL', { maximumFractionDigits: 1 })}% użytkowników zdobyło tę odznakę</span></div>
    </li>)}</ul>
  </section>;
}
