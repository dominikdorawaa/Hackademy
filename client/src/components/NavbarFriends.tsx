import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import UserAvatar from './UserAvatar';
import NavIconButton from './NavIconButton';
import { useRealtime } from '../context/RealtimeContext';
import '../styles/presence.css';
import './NavbarFriends.css';

export default function NavbarFriends() {
  const { state } = useRealtime();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const friends = state?.friends ?? [];
  const online = friends.filter(friend => friend.online).sort((a, b) => a.username.localeCompare(b.username, 'pl'));

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const label = online.length ? `Znajomi online: ${online.length}` : 'Znajomi, nikt nie jest online';

  return (
    <div ref={rootRef} className="nav-friends">
      <NavIconButton data-slot="nav-friends" className="nav-friends-toggle" aria-label={label} aria-expanded={open}
        onClick={() => setOpen(!open)}>
        <Users aria-hidden="true" />
        {online.length > 0 && (
          <span className="nav-friends-count" aria-hidden="true">
            <span className="presence-dot" />
            {online.length}
          </span>
        )}
      </NavIconButton>
      {open && (
        <div className="nav-friends-dropdown" role="group" aria-label="Znajomi online">
          <div className="nav-friends-header">
            <h3>Znajomi online</h3>
            <span>{online.length} z {friends.length}</span>
          </div>
          {online.length === 0 ? (
            <p className="nav-friends-empty">
              {friends.length ? 'Nikt z Twoich znajomych nie jest teraz online.' : 'Nie masz jeszcze znajomych.'}
            </p>
          ) : (
            <ul className="nav-friends-list">
              {online.map(friend => (
                <li key={friend.id}>
                  <Link to={`/profile/${encodeURIComponent(friend.username)}`} onClick={() => setOpen(false)}>
                    <span className="nav-friends-avatar">
                      <UserAvatar username={friend.username} avatar={friend.avatar} alt="" />
                      <span className="presence-dot" aria-hidden="true" />
                    </span>
                    <span className="nav-friends-name">{friend.username}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link to="/friends" className="nav-friends-all" onClick={() => setOpen(false)}>
            Wszyscy znajomi
          </Link>
        </div>
      )}
    </div>
  );
}
