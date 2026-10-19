import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOnboarding } from '../context/OnboardingContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { getCurrentUser } from '../services/userApi';
import { confirmAvatar } from '../services/onboardingApi';
import { avatarFromUsername, fromAvatarConfig, saveAvatar, toAvatarConfig } from '../components/arena/avatar/avatarModel';
import type { Avatar } from '../components/arena/avatar/avatarModel';
import { PROFILE_UPDATED } from '../lib/profile';
import { AvatarStudio } from '../components/onboarding/AvatarStudio';
import type { StudioTab } from '../components/onboarding/AvatarStudio';
import { Mascot } from '../components/mascot/Mascot';
import { MascotBubble } from '../components/mascot/MascotBubble';
import './UserDashboardPage.css';
import './OnboardingPage.css';

const TIPS: Record<StudioTab, string> = {
  outfit: 'Zacznij od stroju. Każdy wygląda inaczej w walce i na ikonie profilu.',
  head: 'Fryzura czy czapka? Czapka chowa włosy, ale fryzura poczeka, aż ją zdejmiesz.',
  colors: 'Dobierz kolory skóry, włosów i ubrania. Podgląd zmienia się od razu.',
  icon: 'Wybierz pozę ikony. To ją zobaczą inni gracze obok Twojej nazwy.',
};

export default function OnboardingPage() {
  const { token } = useAuth();
  const { update } = useOnboarding();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState<'welcome' | 'studio'>('welcome');
  const [tab, setTab] = useState<StudioTab>('outfit');
  const [account, setAccount] = useState<{ username: string; avatar: Avatar } | null>(null);
  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    getCurrentUser({ Authorization: `Bearer ${token}` }, controller.signal)
      .then(async response => {
        if (!response.ok) throw new Error('account');
        const user = await response.json();
        if (!user?.username) throw new Error('account');
        const look = fromAvatarConfig(user.avatar) ?? avatarFromUsername(user.username);
        setAccount({ username: user.username, avatar: look });
        setLoadError(false);
      })
      .catch(() => { if (!controller.signal.aborted) setLoadError(true); });
    return () => controller.abort();
  }, [token, attempt]);

  useEffect(() => { window.scrollTo(0, 0); heading.current?.focus({ preventScroll: true }); }, [step]);

  const current = avatar ?? account?.avatar ?? null;

  const confirm = async () => {
    if (!current || !token || status === 'saving') return;
    setStatus('saving');
    try {
      const config = toAvatarConfig(current);
      const response = await confirmAvatar(config, { Authorization: `Bearer ${token}` });
      if (!response.ok) throw new Error('save');
      const state = await response.json();
      if (!state.avatarConfirmed) throw new Error('save');
      saveAvatar(current);
      window.dispatchEvent(new CustomEvent(PROFILE_UPDATED, { detail: { username: account?.username, avatar: config } }));
      update(state);
      navigate('/dashboard', { replace: true });
    } catch {
      setStatus('error');
    }
  };

  if (step === 'welcome') {
    return <div className="user-dashboard onboarding-page">
      <div className="onboarding-welcome">
        <p className="onboarding-step">Krok 1 z 2</p>
        <h1 ref={heading} tabIndex={-1} className="onboarding-title">Witaj w Hackademy{account ? `, ${account.username}` : ''}!</h1>
        <div className="onboarding-welcome-scene">
          <Mascot mood="wave" scale={4} still={reducedMotion} className="onboarding-welcome-mascot" />
        </div>
        <MascotBubble id="onboarding-welcome" title="Cześć! Jestem Bit." mood="talk" still={reducedMotion} mascot={false}
          actions={<button type="button" className="ud-btn ud-btn-solid" onClick={() => setStep('studio')}>Stwórzmy Twojego awatara</button>}>
          <p>Będę Twoim przewodnikiem po Hackademy. Uczysz się tu cyberbezpieczeństwa w ścieżkach, rozwiązujesz zadania i walczysz w Arenie.</p>
          <p>Najpierw stwórz swojego awatara. Będzie Cię reprezentował w profilu, rankingu, u znajomych i w walkach.</p>
        </MascotBubble>
      </div>
    </div>;
  }

  return <div className="user-dashboard onboarding-page">
    <header className="onboarding-header">
      <div>
        <p className="onboarding-step">Krok 2 z 2</p>
        <h1 ref={heading} tabIndex={-1} className="onboarding-title">Stwórz swojego awatara</h1>
      </div>
    </header>
    {loadError && !current ? <div className="onboarding-load-error" role="alert">
      <p>Nie udało się wczytać Twojego konta.</p>
      <button type="button" className="ud-btn ud-btn-solid" onClick={() => setAttempt(value => value + 1)}>Spróbuj ponownie</button>
    </div> : current ? <>
      <AvatarStudio avatar={current} onChange={setAvatar} reducedMotion={reducedMotion} tab={tab} onTab={setTab} disabled={status === 'saving'}
        aside={<div className="onboarding-confirm">
          <MascotBubble id="onboarding-tip" className="onboarding-confirm-bubble" mood={status === 'error' ? 'idle' : 'talk'} still={reducedMotion}
            title={status === 'error' ? 'Ups, nie udało się zapisać' : 'Podpowiedź'}
            actions={<button type="button" className="ud-btn ud-btn-solid onboarding-confirm-button" onClick={() => void confirm()} disabled={status === 'saving'}>
              {status === 'saving' ? 'Zapisuję…' : status === 'error' ? 'Spróbuj ponownie' : 'Zatwierdzam mój awatar'}
            </button>}>
            {status === 'error'
              ? <p role="alert">Twój awatar nie został zapisany na koncie. Twoje wybory zostały, spróbuj ponownie.</p>
              : <p>{TIPS[tab]}</p>}
          </MascotBubble>
        </div>} />
    </> : <p className="onboarding-loading" role="status">Wczytuję Twoje konto…</p>}
  </div>;
}
