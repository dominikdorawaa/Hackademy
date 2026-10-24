import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useAuth } from '../context/AuthContext';
import { getCurrentUser, saveAvatar as saveAccountAvatar } from '../services/userApi';
import { PROFILE_UPDATED } from '../lib/profile';
import { fromAvatarConfig, readAvatar, saveAvatar, toAvatarConfig } from '../components/arena/avatar/avatarModel';
import type { Avatar } from '../components/arena/avatar/avatarModel';
import { AvatarStudio } from '../components/onboarding/AvatarStudio';
import type { StudioTab } from '../components/onboarding/AvatarStudio';
import './ArenaAvatarPage.css';
import './UserDashboardPage.css';

export default function ArenaAvatarPage() {
  const [params] = useSearchParams();
  const fromProfile = params.get('from') === 'profile';
  const reducedMotion = useReducedMotion();
  const [avatar, setAvatar] = useState<Avatar>(readAvatar);
  const [saved, setSaved] = useState(() => JSON.stringify(readAvatar()));
  const [tab, setTab] = useState<StudioTab>('outfit');
  const dirty = saved !== JSON.stringify(avatar);
  const { isAuthenticated, sessionKey } = useAuth();
  const sessionToken = isAuthenticated && sessionKey ? sessionKey : null;
  const [account, setAccount] = useState<{ sessionKey: string; status: 'ready' | 'error'; username: string | null } | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  useEffect(() => {
    if (!sessionToken) return;
    const controller = new AbortController();
    getCurrentUser({ sessionKey: sessionToken }, controller.signal)
      .then(response => { if (!response.ok) throw new Error('account'); return response.json(); })
      .then(user => {
        if (!user?.username) throw new Error('account');
        setAccount({ sessionKey: sessionToken, status: 'ready', username: user.username });
        const remote = fromAvatarConfig(user.avatar);
        if (remote) { setAvatar(remote); setSaved(JSON.stringify(remote)); } else setSaved('');
      })
      .catch(() => { if (!controller.signal.aborted) setAccount({ sessionKey: sessionToken, status: 'error', username: null }); });
    return () => controller.abort();
  }, [sessionToken]);
  const accountState = !sessionToken ? 'guest' : account?.sessionKey !== sessionToken ? 'loading' : account.status;
  const signedIn = accountState === 'ready';
  const blocked = accountState === 'loading' || accountState === 'error';
  const save = async () => {
    if (blocked) return;
    saveAvatar(avatar);
    if (signedIn) {
      setStatus('saving');
      try {
        const config = toAvatarConfig(avatar);
        const response = await saveAccountAvatar(config, { sessionKey });
        if (!response.ok) throw new Error('save failed');
        window.dispatchEvent(new CustomEvent(PROFILE_UPDATED, { detail: { username: account?.username, avatar: config } }));
      } catch {
        setStatus('error');
        return;
      }
    }
    setSaved(JSON.stringify(avatar));
    setStatus('idle');
  };
  const note = status === 'error' ? 'Nie udało się zapisać awatara na koncie. Spróbuj ponownie.'
    : accountState === 'loading' ? 'Wczytuję awatar z Twojego konta…'
    : accountState === 'error' ? 'Nie udało się wczytać awatara z konta. Odśwież stronę, żeby zapisać zmiany.'
    : signedIn && saved === '' ? 'Ten awatar nie jest jeszcze zapisany na Twoim koncie.'
    : dirty ? 'Masz niezapisane zmiany.'
    : signedIn ? 'Awatar jest zapisany na Twoim koncie i widoczny w profilu, rankingu i u znajomych.'
    : 'Awatar jest zapisany w tej przeglądarce. Zaloguj się, żeby zapisać go na koncie.';
  return <div className="user-dashboard avatar-page">
    <header className="avatar-heading">
      <div><Link to={fromProfile ? '/profile' : '/arena'}><ArrowLeft size={16} aria-hidden="true" />{fromProfile ? 'Wróć do profilu' : 'Wróć do Areny'}</Link><h1>Twój awatar</h1></div>
      <div className="avatar-actions">
        <button type="button" className="ud-btn ud-btn-solid" onClick={save} disabled={!dirty || blocked || status === 'saving'}>{status === 'saving' ? 'Zapisuję…' : dirty ? 'Zapisz awatar' : 'Zapisano'}</button>
      </div>
    </header>
    <AvatarStudio avatar={avatar} onChange={setAvatar} reducedMotion={reducedMotion} tab={tab} onTab={setTab} disabled={accountState === 'loading'}
      aside={<p className="avatar-note" role="status" aria-live="polite" data-state={status === 'error' || accountState === 'error' ? 'error' : status}>{note}</p>} />
  </div>;
}
