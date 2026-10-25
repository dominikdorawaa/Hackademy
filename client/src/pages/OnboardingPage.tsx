import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOnboarding } from '../context/OnboardingContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { changeUsername, checkUsername, getCurrentUser } from '../services/userApi';
import { confirmAvatar } from '../services/onboardingApi';
import { avatarFromUsername, fromAvatarConfig, saveAvatar, toAvatarConfig } from '../components/arena/avatar/avatarModel';
import type { Avatar } from '../components/arena/avatar/avatarModel';
import { PROFILE_UPDATED } from '../lib/profile';
import { USERNAME_MAX, USERNAME_TAKEN, usernameProblem } from '../lib/username';
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
  finisher: 'Wybierz cios, którym zakończysz wygraną walkę w Arenie.',
  dance: 'Wybierz taniec, który zatańczysz po wygranej walce.',
  icon: 'Wybierz pozę ikony. To ją zobaczą inni gracze obok Twojej nazwy.',
};
const CHECK_DELAY_MS = 400;
type NameCheck = { name: string; state: 'checking' | 'available' | 'taken' | 'invalid' | 'error'; message: string | null };

export default function OnboardingPage() {
  const { sessionKey } = useAuth();
  const { update } = useOnboarding();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState<'welcome' | 'name' | 'studio'>('welcome');
  const [tab, setTab] = useState<StudioTab>('outfit');
  const [account, setAccount] = useState<{ username: string; avatar: Avatar } | null>(null);
  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [name, setName] = useState<string | null>(null);
  const [check, setCheck] = useState<NameCheck | null>(null);
  const [naming, setNaming] = useState<'idle' | 'saving' | 'error'>('idle');
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!sessionKey) return;
    const controller = new AbortController();
    getCurrentUser({ sessionKey }, controller.signal)
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
  }, [sessionKey, attempt]);

  useEffect(() => { window.scrollTo(0, 0); heading.current?.focus({ preventScroll: true }); }, [step]);

  const current = avatar ?? account?.avatar ?? null;
  const chosen = (name ?? account?.username ?? '').trim();
  const problem = usernameProblem(chosen);
  const own = chosen === account?.username;
  const verdict: NameCheck | null = !account ? null
    : problem ? { name: chosen, state: 'invalid', message: problem }
    : own ? { name: chosen, state: 'available', message: null }
    : check?.name === chosen ? check : { name: chosen, state: 'checking', message: null };

  useEffect(() => {
    if (step !== 'name' || !sessionKey || !account || problem || own) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      checkUsername(chosen, { sessionKey }, controller.signal)
        .then(async response => {
          if (!response.ok) throw new Error('check');
          const result = await response.json();
          setCheck({ name: chosen, state: result.available ? 'available' : result.reason === 'taken' ? 'taken' : 'invalid', message: result.message });
        })
        .catch(() => { if (!controller.signal.aborted) setCheck({ name: chosen, state: 'error', message: null }); });
    }, CHECK_DELAY_MS);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [step, sessionKey, account, chosen, problem, own]);

  const saveName = async (event: FormEvent) => {
    event.preventDefault();
    if (!account || !sessionKey || naming === 'saving' || verdict?.state === 'invalid' || verdict?.state === 'taken') return;
    if (own) { setStep('studio'); return; }
    setNaming('saving');
    try {
      const response = await changeUsername(chosen, { sessionKey });
      if (response.status === 409) { setCheck({ name: chosen, state: 'taken', message: USERNAME_TAKEN }); setNaming('idle'); return; }
      if (response.status === 400) {
        const body = await response.json() as { newUsername?: string };
        if (body.newUsername) { setCheck({ name: chosen, state: 'invalid', message: body.newUsername }); setNaming('idle'); return; }
      }
      if (!response.ok) throw new Error('rename');
      const { username } = await response.json();
      window.dispatchEvent(new CustomEvent(PROFILE_UPDATED, { detail: { username, previousUsername: account.username } }));
      setAccount({ ...account, username });
      setName(null);
      setNaming('idle');
      setStep('studio');
    } catch {
      setNaming('error');
    }
  };

  const confirm = async () => {
    if (!current || !sessionKey || status === 'saving') return;
    setStatus('saving');
    try {
      const config = toAvatarConfig(current);
      const response = await confirmAvatar(config, { sessionKey });
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
        <p className="onboarding-step">Krok 1 z 3</p>
        <h1 ref={heading} tabIndex={-1} className="onboarding-title">Witaj w Hackademy{account ? `, ${account.username}` : ''}!</h1>
        <div className="onboarding-welcome-scene">
          <Mascot mood="calm" scale={4} still={reducedMotion} className="onboarding-welcome-mascot" />
        </div>
        <MascotBubble id="onboarding-welcome" title="Cześć! Jestem Bit." mood="talk" still={reducedMotion} mascot={false}
          actions={<button type="button" className="ud-btn ud-btn-solid" onClick={() => setStep('name')}>Wybierz swoją nazwę</button>}>
          <p>Będę Twoim przewodnikiem po Hackademy. Uczysz się tu cyberbezpieczeństwa w ścieżkach, rozwiązujesz zadania i walczysz w Arenie.</p>
          <p>Najpierw wybierz nazwę profilu i stwórz swojego awatara. Będą Cię reprezentować w profilu, rankingu, u znajomych i w walkach.</p>
        </MascotBubble>
      </div>
    </div>;
  }

  if (step === 'name') {
    const note = naming === 'error' ? 'Nie udało się zapisać nazwy. Spróbuj ponownie.'
      : verdict?.state === 'checking' ? 'Sprawdzam, czy nazwa jest wolna…'
      : verdict?.state === 'available' ? 'Ta nazwa jest wolna.'
      : verdict?.state === 'error' ? 'Nie udało się sprawdzić nazwy. Możesz spróbować ją zapisać.'
      : verdict?.message ?? '';
    const blocked = !account || naming === 'saving' || verdict?.state === 'invalid' || verdict?.state === 'taken' || verdict?.state === 'checking';
    return <div className="user-dashboard onboarding-page">
      <div className="onboarding-welcome">
        <p className="onboarding-step">Krok 2 z 3</p>
        <h1 ref={heading} tabIndex={-1} className="onboarding-title">Jak mamy Cię nazywać?</h1>
        <form className="onboarding-name" onSubmit={event => void saveName(event)} noValidate>
          <label htmlFor="onboarding-username">Nazwa profilu</label>
          <input id="onboarding-username" autoComplete="username" value={name ?? account?.username ?? ''} maxLength={USERNAME_MAX}
            onChange={event => { setName(event.target.value); if (naming === 'error') setNaming('idle'); }} disabled={!account || naming === 'saving'}
            aria-invalid={verdict?.state === 'invalid' || verdict?.state === 'taken'} aria-describedby="onboarding-username-help onboarding-username-status" />
          <p id="onboarding-username-help" className="onboarding-name-help">Od 3 do 20 znaków: litery, cyfry, _ i -. Tę nazwę zobaczą inni gracze.</p>
          <p id="onboarding-username-status" className="onboarding-name-status" role="status" aria-live="polite"
            data-state={naming === 'error' ? 'error' : verdict?.state}>{note}</p>
          <button type="submit" className="ud-btn ud-btn-solid" disabled={blocked}>{naming === 'saving' ? 'Zapisuję…' : 'Dalej'}</button>
        </form>
        {loadError && !account && <div className="onboarding-load-error" role="alert">
          <p>Nie udało się wczytać Twojego konta.</p>
          <button type="button" className="ud-btn ud-btn-solid" onClick={() => setAttempt(value => value + 1)}>Spróbuj ponownie</button>
        </div>}
      </div>
    </div>;
  }

  return <div className="user-dashboard onboarding-page">
    <header className="onboarding-header">
      <div>
        <p className="onboarding-step">Krok 3 z 3</p>
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
