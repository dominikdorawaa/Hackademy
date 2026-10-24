import { Link, useLocation } from 'react-router-dom';
import { BookOpen, House, Sword, Trophy } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import type { CSSProperties } from 'react';
import { useRealtime } from '../context/RealtimeContext';
import './MobileTabBar.css';

const tabs: { to: string; label: string; icon: Icon }[] = [
  { to: '/dashboard', label: 'Start', icon: House },
  { to: '/learn', label: 'Ucz się', icon: BookOpen },
  { to: '/arena', label: 'Arena', icon: Sword },
  { to: '/ranking', label: 'Ranking', icon: Trophy },
];

// Screens that own the whole viewport (a room, a duel, onboarding) keep their space.
const fullScreen = [/^\/witaj/, /^\/arena\/battle\//, /^\/learn\/ukos/, /^\/login/, /^\/register/];

export function showsMobileTabBar(pathname: string) {
  return !fullScreen.some(pattern => pattern.test(pathname));
}

function within(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** The phone's main navigation: a floating dock of the four sections, with a sliding marker under the current one. */
export default function MobileTabBar() {
  const { pathname } = useLocation();
  const { state } = useRealtime();
  const current = tabs.findIndex(tab => within(pathname, tab.to));
  const waitingDuels = state?.challenges.length ?? 0;
  return <nav className="mobile-tabbar" aria-label="Nawigacja na telefonie">
    <div className="mobile-tabbar-dock" style={{ '--tab-index': current } as CSSProperties} data-current={current >= 0 || undefined}>
      <span className="mobile-tabbar-marker" aria-hidden="true" />
      {tabs.map((tab, index) => {
        const active = index === current;
        const TabIcon = tab.icon;
        return <Link key={tab.to} to={tab.to} className="mobile-tabbar-tab" aria-current={active ? 'page' : undefined}>
          <span className="mobile-tabbar-icon">
            <TabIcon size={22} weight={active ? 'fill' : 'regular'} aria-hidden="true" />
            {tab.to === '/arena' && waitingDuels > 0 && <span className="mobile-tabbar-dot" aria-hidden="true" />}
          </span>
          <span className="mobile-tabbar-label">{tab.label}</span>
          {tab.to === '/arena' && waitingDuels > 0 && <span className="sr-only">, czekające wyzwania: {waitingDuels}</span>}
        </Link>;
      })}
    </div>
  </nav>;
}
