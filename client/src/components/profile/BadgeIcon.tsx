import type { BadgeDto } from '../../types/api';

type SymbolKind = 'terminal' | 'code' | 'shield' | 'elite' | 'flame' | 'streak' | 'network' | 'award';

export function AchievementGlyph({ kind = 'award' }: { kind?: SymbolKind }) {
  const symbols = {
    terminal: <><rect x="3" y="4.5" width="18" height="15" rx="3" /><path d="m7 9 3 3-3 3m6 0h4" /></>,
    code: <><path d="m8 7-5 5 5 5m8-10 5 5-5 5M13.5 5l-3 14" /></>,
    shield: <><path d="M12 3 4.5 6v5.5c0 4.5 3.2 7.3 7.5 9.5 4.3-2.2 7.5-5 7.5-9.5V6L12 3Z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
    elite: <><path d="m12 2 8.5 5v10L12 22l-8.5-5V7L12 2Z" /><path d="m7 10 2.5 2L12 8l2.5 4 2.5-2-1 6H8l-1-6Z" /></>,
    flame: <><path d="M13 3c.5 4-4 5-4 8 0 1.3.7 2.3 1.5 3 0-2 1.5-3 3-4 .5 2 3.5 3.2 3.5 6a5 5 0 0 1-10 0c-3-4.5 1-8 6-13Z" /></>,
    streak: <><path d="M13 4c.5 3.5-3.5 4.5-3.5 7.2 0 1 .5 1.8 1.2 2.5 0-1.7 1.4-2.5 2.7-3.4.4 1.8 3.1 2.8 3.1 5.3a4.5 4.5 0 0 1-9 0C5 11.8 8.5 8.8 13 4Z" /><path d="m4 6-1-1m17 1 1-1M3 12H2m19 0h1" /></>,
    network: <><circle cx="12" cy="5" r="2.5" /><circle cx="5" cy="18" r="2.5" /><circle cx="19" cy="18" r="2.5" /><path d="m10.8 7.2-4.6 8.5m7-8.5 4.6 8.5M7.5 18h9" /></>,
    award: <><circle cx="12" cy="9" r="6" /><path d="m7.5 13.5-1 8 5.5-3 5.5 3-1-8M10 9l1.4 1.4L14.5 7" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {symbols[kind]}
  </svg>;
}

function symbolFor(badge: BadgeDto): SymbolKind {
  const named: Record<string, SymbolKind> = {
    'hello world': 'terminal', 'script kiddie': 'code', hacker: 'shield', elite: 'elite',
    'streak novice': 'flame', 'streak master': 'streak', 'social butterfly': 'network',
  };
  const name = named[badge.name.trim().toLowerCase()];
  if (name) return name;
  switch (badge.progress?.conditionType) {
    case 'SOLVED_COUNT': return 'terminal';
    case 'POINTS': return badge.progress.target >= 5000 ? 'elite' : badge.progress.target >= 1000 ? 'shield' : 'code';
    case 'STREAK': return badge.progress.target >= 7 ? 'streak' : 'flame';
    case 'FRIENDS_COUNT': return 'network';
  }
  if (/fa-(code|baby)/.test(badge.icon)) return 'code';
  if (/fa-(shield|user-secret)/.test(badge.icon)) return 'shield';
  if (/fa-crown/.test(badge.icon)) return 'elite';
  if (/fa-fire-alt/.test(badge.icon)) return 'streak';
  if (/fa-fire/.test(badge.icon)) return 'flame';
  if (/fa-users/.test(badge.icon)) return 'network';
  if (/fa-(globe|terminal)/.test(badge.icon)) return 'terminal';
  return 'award';
}

export default function BadgeIcon({ badge, showStatus = true }: { badge: BadgeDto; showStatus?: boolean }) {
  const kind = symbolFor(badge);
  return <span className="profile-achievement-icon" data-earned={badge.earned} data-symbol={kind} aria-hidden="true">
    <AchievementGlyph kind={kind} />
    {showStatus && <span className="profile-badge-status-mark"><i className={badge.earned ? 'fas fa-check' : 'fas fa-lock'} /></span>}
  </span>;
}
