import ProfileIcon from './ProfileIcon';
import { useEffect, useRef, useState } from 'react';
import type { BadgeDto } from '../../types/api';
import { Button } from '../ui/button';
import BadgeIcon, { AchievementGlyph } from './BadgeIcon';
import BadgeProgress from './BadgeProgress';
import type { BadgeFilter } from './ProfileBadges';

const PAGE_SIZE = 6;

export default function BadgeCatalog({ badges, initialFilter, own, onClose }: {
  badges: BadgeDto[];
  initialFilter: BadgeFilter;
  own: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [view, setView] = useState<'personal' | 'global'>('personal');
  const [filter, setFilter] = useState(initialFilter);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const earnedCount = badges.filter(badge => badge.earned).length;
  const percent = Math.round(earnedCount / badges.length * 100);
  const query = search.trim().toLocaleLowerCase('pl-PL');
  const filtered = badges.filter(badge =>
    (view === 'global' || filter === 'all' || (filter === 'earned' ? badge.earned : !badge.earned)) &&
    `${badge.name} ${badge.description}`.toLocaleLowerCase('pl-PL').includes(query),
  ).sort((a, b) => view === 'global'
    ? b.rarityPercentage - a.rarityPercentage || a.id - b.id
    : Number(b.earned) - Number(a.earned) || (b.earnedAt ?? '').localeCompare(a.earnedAt ?? '') || a.id - b.id,
  );
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const currentPage = Math.min(page, Math.max(0, pageCount - 1));
  const start = currentPage * PAGE_SIZE;

  useEffect(() => {
    const element = dialog.current!;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function switchView(next: 'personal' | 'global') {
    setView(next); setPage(0);
  }

  return <dialog ref={dialog} className="badge-catalog" aria-labelledby="badge-catalog-title"
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <header className="badge-catalog-header">
      <div className="badge-catalog-title-row">
        <h2 id="badge-catalog-title"><AchievementGlyph /> Osiągnięcia Hackademy</h2>
        <Button variant="ghost" size="sm" aria-label="Zamknij osiągnięcia" onClick={onClose}>
          <ProfileIcon kind="close" weight="bold" />
        </Button>
      </div>
      <div className="badge-catalog-progress">
        <p>Zdobyto <strong>{earnedCount} z {badges.length}</strong> osiągnięć <span>({percent}%)</span></p>
        <progress aria-label="Zdobyte osiągnięcia" max={badges.length} value={earnedCount} />
      </div>
      <div className="badge-catalog-tabs" role="tablist" aria-label="Widok osiągnięć">
        <button role="tab" id="badge-personal-tab" aria-controls="badge-catalog-panel" aria-selected={view === 'personal'}
          tabIndex={view === 'personal' ? 0 : -1} onClick={() => switchView('personal')}
          onKeyDown={event => { if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); switchView('global'); document.getElementById('badge-global-tab')?.focus(); } }}>
          {own ? 'Moje osiągnięcia' : 'Osiągnięcia użytkownika'}
        </button>
        <button role="tab" id="badge-global-tab" aria-controls="badge-catalog-panel" aria-selected={view === 'global'}
          tabIndex={view === 'global' ? 0 : -1} onClick={() => switchView('global')}
          onKeyDown={event => { if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); switchView('personal'); document.getElementById('badge-personal-tab')?.focus(); } }}>
          Osiągnięcia globalne
        </button>
      </div>
    </header>
    <div className="badge-catalog-body" id="badge-catalog-panel" role="tabpanel"
      aria-labelledby={view === 'personal' ? 'badge-personal-tab' : 'badge-global-tab'}>
      <div className="badge-catalog-toolbar">
        <input type="search" aria-label="Szukaj osiągnięć" placeholder="Szukaj osiągnięcia…" value={search}
          onChange={event => { setSearch(event.target.value); setPage(0); }} />
        {view === 'personal' ? <select aria-label="Filtr odznak" value={filter}
          onChange={event => { setFilter(event.target.value as BadgeFilter); setPage(0); }}>
          <option value="all">Wszystkie ({badges.length})</option>
          <option value="earned">Zdobyte ({earnedCount})</option>
          <option value="locked">Do zdobycia ({badges.length - earnedCount})</option>
        </select> : <p>Od najczęściej zdobywanych</p>}
      </div>
      {filtered.length ? <ul className="badge-catalog-list" aria-label="Lista odznak">
        {filtered.slice(start, start + PAGE_SIZE).map(badge => <li key={badge.id} className="badge-catalog-item">
          <BadgeIcon badge={view === 'global' ? { ...badge, earned: true } : badge} showStatus={view === 'personal'} />
          <div className="badge-catalog-item-copy">
            <h3>{badge.name}</h3>
            <p>{badge.description}</p>
            <span>{badge.rarityPercentage.toLocaleString('pl-PL', { maximumFractionDigits: 1 })}% graczy zdobyło to osiągnięcie</span>
          </div>
          <div className="badge-catalog-item-status">
            {view === 'global' ? <>
              <strong>{badge.rarityPercentage.toLocaleString('pl-PL', { maximumFractionDigits: 1 })}%</strong>
              <progress max={100} value={badge.rarityPercentage} aria-label={`Popularność: ${badge.name}`} />
            </> : badge.earned ? <>
              <span className="badge-catalog-unlocked">Zdobyta</span>
              {badge.earnedAt && <time dateTime={badge.earnedAt}>Odblokowano: {new Date(badge.earnedAt).toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' })}</time>}
            </> : <span>Do zdobycia</span>}
            {view === 'personal' && <BadgeProgress badge={badge} />}
          </div>
        </li>)}
      </ul> : <p role="status" className="profile-muted">Brak osiągnięć pasujących do wyszukiwania i filtra.</p>}
      {pageCount > 1 && <nav className="profile-badge-pagination" aria-label="Strony odznak">
        <p className="profile-muted" aria-live="polite">{start + 1}–{Math.min(start + PAGE_SIZE, filtered.length)} z {filtered.length} odznak</p>
        <div className="profile-badge-page-controls">
          <Button variant="outline" size="sm" disabled={currentPage === 0} aria-label="Poprzednia strona odznak" onClick={() => setPage(currentPage - 1)}>
            <ProfileIcon kind="left" weight="bold" />
          </Button>
          <select aria-label="Strona odznak" value={currentPage} onChange={event => setPage(Number(event.target.value))}>
            {Array.from({ length: pageCount }, (_, index) => <option key={index} value={index}>Strona {index + 1} z {pageCount}</option>)}
          </select>
          <Button variant="outline" size="sm" disabled={currentPage === pageCount - 1} aria-label="Następna strona odznak" onClick={() => setPage(currentPage + 1)}>
            <ProfileIcon kind="right" weight="bold" />
          </Button>
        </div>
      </nav>}
    </div>
  </dialog>;
}
