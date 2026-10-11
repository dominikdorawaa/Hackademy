import type { BadgeDto } from '../../types/api';
import ProfileIcon from './ProfileIcon';

type SymbolKind = 'terminal' | 'code' | 'shield' | 'elite' | 'flame' | 'streak' | 'network' | 'award';

export function AchievementGlyph({ kind = 'award' }: { kind?: SymbolKind }) {
  return <ProfileIcon kind={kind} className="profile-achievement-glyph" />;
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
    {showStatus && <span className="profile-badge-status-mark"><ProfileIcon kind={badge.earned ? 'check' : 'lock'} weight="bold" /></span>}
  </span>;
}
