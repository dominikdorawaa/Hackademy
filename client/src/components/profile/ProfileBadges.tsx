import { useEffect, useRef, useState } from 'react';
import type { BadgeDto } from '../../types/api';
import { Button } from '../ui/button';
import BadgeCatalog from './BadgeCatalog';
import BadgeIcon from './BadgeIcon';

export type BadgeFilter = 'all' | 'earned' | 'locked';
const PAGE_SIZE = 6;

export default function ProfileBadges({ badges, own = true }: { badges: BadgeDto[]; own?: boolean }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [catalog, setCatalog] = useState(false);
  const [filter, setFilter] = useState<BadgeFilter>('all');
  const trigger = useRef<HTMLButtonElement>(null);
  const wasOpened = useRef(false);
  useEffect(() => {
    if (catalog) wasOpened.current = true;
    else if (wasOpened.current) trigger.current?.focus();
  }, [catalog]);
  const sorted = [...badges].sort((a, b) =>
    Number(b.earned) - Number(a.earned) ||
    (b.earnedAt ?? '').localeCompare(a.earnedAt ?? '') || a.id - b.id,
  );
  const earned = sorted.filter(badge => badge.earned);
  const locked = sorted.filter(badge => !badge.earned);
  const selected = sorted.find(badge => badge.id === selectedId) ?? sorted[0];
  const percent = badges.length ? Math.round(earned.length / badges.length * 100) : 0;

  function openCatalog(nextFilter: BadgeFilter, opener: HTMLButtonElement) {
    trigger.current = opener;
    setCatalog(true); setFilter(nextFilter);
  }
  function iconRow(items: BadgeDto[], status: 'earned' | 'locked') {
    return <div className="profile-achievement-row" role="group" aria-label={status === 'earned' ? 'Zdobyte odznaki' : 'Zablokowane odznaki'}>
      {items.slice(0, PAGE_SIZE).map(badge => <button key={badge.id} type="button"
        className="profile-achievement-tile" aria-pressed={selected?.id === badge.id}
        aria-label={`${badge.name} - ${badge.earned ? 'zdobyta' : 'zablokowana'}`}
        title={badge.name} onClick={() => setSelectedId(badge.id)}>
        <BadgeIcon badge={badge} />
      </button>)}
      {items.length > PAGE_SIZE && <button type="button" className="profile-achievement-more"
        aria-label={`Zobacz ${status === 'earned' ? 'zdobyte' : 'zablokowane'} odznaki - pozostało ${items.length - PAGE_SIZE}`}
        onClick={event => openCatalog(status, event.currentTarget)}>+{items.length - PAGE_SIZE}</button>}
    </div>;
  }

  if (!badges.length) return <p className="profile-muted">Brak dostępnych odznak.</p>;

  return <div className="profile-achievements">
    <div className="profile-achievement-summary"><div className="profile-achievement-progress">
      <p>Odblokowano <strong>{earned.length}/{badges.length}</strong> <span>({percent}%)</span></p>
    </div>
      {selected && <div className="profile-achievement-featured" aria-live="polite">
        <BadgeIcon badge={selected} />
        <div><h3>{selected.name}</h3><p>{selected.description}</p>
          <span className="profile-achievement-state" data-earned={selected.earned}><i className={selected.earned ? 'fas fa-check-circle' : 'fas fa-lock'} aria-hidden="true" /> {selected.earned ? 'Zdobyta' : 'Do zdobycia'}</span>
        </div>
      </div>}
    </div>
    <div className="profile-collection-content">
      {earned.length ? <div><p className="profile-collection-label">Zdobyte osiągnięcia</p>{iconRow(earned, 'earned')}</div> : <p className="profile-muted">Nie zdobyto jeszcze żadnej odznaki.</p>}
      {locked.length > 0 && <div className="profile-achievement-locked">
        <p className="profile-muted">Zablokowane osiągnięcia</p>
        {iconRow(locked, 'locked')}
      </div>}
      <Button variant="link" size="sm" className="profile-achievement-all" onClick={event => openCatalog('all', event.currentTarget)}>
        Zobacz wszystkie odznaki
      </Button>
    </div>
    {catalog && <BadgeCatalog badges={badges} initialFilter={filter} own={own} onClose={() => setCatalog(false)} />}
  </div>;
}
