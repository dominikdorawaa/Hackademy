import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useClerk } from '@clerk/react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNotificationPreferences } from '../context/NotificationPreferencesContext';
import * as userApi from '../services/userApi';
import type { NotificationPreferences } from '../services/userApi';
import type { DashboardUser } from '../types/api';
import type { ApiResponse } from '../services/http';
import './SettingsPage.css';
import { LoadingSkeleton, Skeleton } from '../components/common/Skeleton';
import { Play } from 'lucide-react';
import { chooseVariant, playSound, selectedVariant, soundVariants, unlockAudio } from '../lib/notificationSounds';
import type { SoundEvent } from '../lib/notificationSounds';
import { USERNAME_MAX, USERNAME_MIN, usernameProblem } from '../lib/username';

const sections = {
  account: { title: 'Konto', description: 'Dane logowania i profil publiczny.' },
  notifications: { title: 'Powiadomienia', description: 'Wybierz, o czym i jak chcesz się dowiadywać.' },
  appearance: { title: 'Wygląd', description: 'Dostosuj animacje do swoich preferencji.' },
  security: { title: 'Bezpieczeństwo', description: 'Zadbaj o dostęp do swojego konta.' },
};
type Section = keyof typeof sections;

const soundEvents: SoundEvent[] = ['friendRequests', 'challenges', 'matchFound', 'friendOnline'];
const eventNames: Record<SoundEvent, string> = {
  friendRequests: 'Zaproszenie do znajomych', challenges: 'Wyzwanie w Arenie', matchFound: 'Znaleziony mecz', friendOnline: 'Znajomy online',
};
const silentOutcome: Record<SoundEvent, string> = {
  friendRequests: 'tylko na stronie Znajomi', challenges: 'tylko w Arenie', matchFound: 'mecz otworzy się bez sygnału',
  friendOnline: 'bez komunikatu i sygnału',
};

function eventOutcome(event: SoundEvent, preferences: NotificationPreferences, systemAllowed: boolean) {
  if (!preferences[event]) return silentOutcome[event];
  const channels = [
    event === 'friendOnline' ? 'komunikat w rogu ekranu' : event !== 'matchFound' && 'dzwonek w górnym pasku',
    preferences.sound && 'dźwięk',
    preferences.browserNotifications && systemAllowed && 'powiadomienie systemowe, gdy karta jest w tle',
  ].filter(Boolean);
  return channels.length ? channels.join(', ') : silentOutcome[event];
}

async function responseError(response: ApiResponse<unknown>, fallback: string) {
  if (response.status === 401) return 'Sesja wygasła. Zaloguj się ponownie.';
  try {
    const body = await response.json() as Record<string, unknown>;
    if (body.message === 'Incorrect current password') return 'Obecne hasło jest nieprawidłowe.';
    if (typeof body.newUsername === 'string') return `${body.newUsername}.`;
  } catch { return fallback; }
  return fallback;
}

function SettingRow({ title, description, extra, children }: { title: string; description: string; extra?: ReactNode; children: ReactNode }) {
  return <div className="settings-row"><div><h3>{title}</h3><p>{description}</p>{extra}</div><div className="settings-control">{children}</div></div>;
}

function Switch({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return <button type="button" className="settings-switch" role="switch" aria-label={label} aria-checked={checked}
    disabled={disabled} onClick={() => onChange(!checked)}><span /></button>;
}

export default function SettingsPage() {
  const { user, sessionKey, refreshUser, logout } = useAuth();
  const { reducedMotion, setReducedMotion } = useTheme();
  const { preferences, loaded, saving, error: preferenceError, reload, update } = useNotificationPreferences();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const requestedSection = search.get('section');
  const section: Section = requestedSection && Object.hasOwn(sections, requestedSection) ? requestedSection as Section : 'account';
  const [account, setAccount] = useState<DashboardUser | null>(null);
  const [accountError, setAccountError] = useState('');
  const [accountAttempt, setAccountAttempt] = useState(0);
  const [username, setUsername] = useState(user?.username ?? '');
  const { openUserProfile } = useClerk();
  const [busy, setBusy] = useState<'username' | 'password' | 'permission' | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null);
  const activeToken = useRef(sessionKey);
  useLayoutEffect(() => { activeToken.current = sessionKey; }, [sessionKey]);
  const submitting = useRef(false);
  const notificationsSupported = 'Notification' in window && window.isSecureContext;
  const systemAllowed = notificationsSupported && Notification.permission === 'granted';
  const matchFoundSilent = !preferences.sound && !(preferences.browserNotifications && systemAllowed);
  const [variants, setVariants] = useState(() => Object.fromEntries(soundEvents.map(event => [event, selectedVariant(event).id])) as Record<SoundEvent, string>);

  useEffect(() => {
    if (!sessionKey) return;
    const controller = new AbortController();
    setAccount(null);
    setAccountError('');
    void (async () => {
      try {
        const response = await userApi.getCurrentUser({ sessionKey }, controller.signal);
        if (!response.ok) throw new Error(await responseError(response, 'Nie udało się pobrać danych konta.'));
        const data = await response.json();
        if (!controller.signal.aborted) { setAccount(data); setUsername(data.username); }
      } catch (error) {
        if (!controller.signal.aborted) setAccountError(error instanceof Error ? error.message : 'Nie udało się pobrać danych konta.');
      }
    })();
    return () => controller.abort();
  }, [sessionKey, accountAttempt]);

  const selectSection = (next: Section) => {
    const parameters = new URLSearchParams(search);
    parameters.set('section', next);
    setSearch(parameters);
    setFeedback(null);
  };

  const changeName = async (event: FormEvent) => {
    event.preventDefault();
    if (!sessionKey || submitting.current) return;
    const newUsername = username.trim();
    const problem = usernameProblem(newUsername);
    if (problem) {
      setFeedback({ message: `${problem}.`, error: true });
      return;
    }
    submitting.current = true;
    setBusy('username');
    setFeedback(null);
    try {
      const response = await userApi.changeUsername(newUsername, { sessionKey });
      if (response.status === 409) throw new Error('Ta nazwa jest już zajęta. Wybierz inną.');
      if (!response.ok) throw new Error(await responseError(response, 'Nie udało się zmienić nazwy użytkownika. Spróbuj ponownie.'));
      await response.json();
      if (activeToken.current !== sessionKey) return;
      await refreshUser();
      setFeedback({ message: 'Nazwa użytkownika została zmieniona.', error: false });
    } catch (error) {
      if (activeToken.current === sessionKey) setFeedback({ message: error instanceof Error ? error.message : 'Nie udało się zmienić nazwy użytkownika.', error: true });
    } finally { submitting.current = false; setBusy(null); }
  };

  const changeNotification = async (key: keyof NotificationPreferences, value: boolean) => {
    if (key === 'browserNotifications' && value) {
      if (!notificationsSupported) return;
      setBusy('permission');
      try {
        const permission = await Notification.requestPermission();
        if (activeToken.current !== sessionKey) return;
        if (permission !== 'granted') {
          setFeedback({ message: 'Przeglądarka nie udzieliła zgody. Możesz ją zmienić w ustawieniach uprawnień tej strony.', error: true });
          return;
        }
      } catch {
        setFeedback({ message: 'Nie udało się uzyskać zgody na powiadomienia w tej przeglądarce.', error: true });
        return;
      } finally { setBusy(null); }
    }
    setFeedback(null);
    const saved = await update(key, value);
    if (saved) setFeedback({ message: 'Preferencje zostały zapisane.', error: false });
  };
  const previewSound = async (event: SoundEvent) => {
    if (!await unlockAudio() || !playSound(event)) {
      setFeedback({ message: 'Ta przeglądarka nie odtwarza dźwięków na tej stronie.', error: true });
      return;
    }
    setFeedback(preferences.sound ? null : { message: 'Tak brzmi ten sygnał. Włącz „Dźwięk”, aby grał przy prawdziwych zdarzeniach.', error: false });
  };

  const previewNotification = async () => {
    if (!notificationsSupported) return;
    let permission = Notification.permission;
    if (permission === 'default') {
      setBusy('permission');
      try { permission = await Notification.requestPermission(); } catch { permission = 'denied'; } finally { setBusy(null); }
      if (activeToken.current !== sessionKey) return;
    }
    if (permission !== 'granted') {
      setFeedback({ message: 'Przeglądarka blokuje powiadomienia z Hackademy. Zezwól na nie w ustawieniach strony (ikona obok adresu).', error: true });
      return;
    }
    try {
      new Notification('Próbne powiadomienie Hackademy', { body: 'Tak zobaczysz zaproszenie, wyzwanie albo znaleziony mecz, gdy Hackademy jest w tle.', tag: 'hackademy-preview' });
    } catch {
      setFeedback({ message: 'Nie udało się wyświetlić powiadomienia na tym urządzeniu.', error: true });
      return;
    }
    setFeedback({ message: preferences.browserNotifications
      ? 'Wysłano próbne powiadomienie. Jeśli go nie widzisz, sprawdź ustawienia powiadomień systemu, np. tryb „Nie przeszkadzać”.'
      : 'Wysłano próbne powiadomienie. Włącz przełącznik, aby dostawać je przy prawdziwych zdarzeniach.', error: false });
  };

  const notificationSwitch = (key: keyof NotificationPreferences, label: string, unavailable = false) => !loaded && !preferenceError
    ? <Skeleton width={44} height={26} radius={20} />
    : <Switch label={label}
    checked={preferences[key]} disabled={!loaded || saving || busy === 'permission' || unavailable}
    onChange={value => void changeNotification(key, value)} />;

  return <div className="hackademy-container settings-page">
    <header className="settings-heading"><h1>Ustawienia</h1><p>Twoje konto, powiadomienia i sposób korzystania z Hackademy.</p></header>
    <div className="settings-layout">
      <nav className="settings-nav" aria-label="Sekcje ustawień">{(Object.keys(sections) as Section[]).map(key => <button key={key}
        type="button" aria-current={section === key ? 'page' : undefined} onClick={() => selectSection(key)}>{sections[key].title}</button>)}</nav>
      <section className="settings-content" aria-labelledby="settings-section-title">
        <header className="settings-section-heading"><h2 id="settings-section-title">{sections[section].title}</h2><p>{sections[section].description}</p></header>
        {section === 'account' && <>
          <h3 className="settings-group-title">Dane konta</h3>
          {accountError ? <div className="settings-error"><p role="alert">{accountError}</p><button className="settings-button" onClick={() => setAccountAttempt(value => value + 1)}>Spróbuj ponownie</button></div>
            : !account ? <LoadingSkeleton label="Ładowanie danych konta" className="settings-form">
              <Skeleton width={140} height={14} />
              <Skeleton height={42} radius={8} />
              <Skeleton width="70%" height={14} />
              <Skeleton width={130} height={40} radius={8} />
            </LoadingSkeleton> : <>
              <form className="settings-form" onSubmit={event => void changeName(event)}>
                <label htmlFor="settings-username">Nazwa użytkownika</label>
                <input id="settings-username" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} required minLength={USERNAME_MIN} maxLength={USERNAME_MAX} disabled={!!busy} aria-describedby="settings-username-help" />
                <p id="settings-username-help">Tak zobaczą Cię inni użytkownicy. Od {USERNAME_MIN} do {USERNAME_MAX} znaków: litery, cyfry, _ i -.</p>
                <button className="settings-button settings-button-primary" disabled={!!busy || username.trim() === account.username}>{busy === 'username' ? 'Zapisywanie…' : 'Zapisz nazwę'}</button>
              </form>
              <SettingRow title="Adres e-mail" description="Adres używany do logowania."><span className="settings-email">{account.email}</span></SettingRow>
            </>}
          <h3 className="settings-group-title">Profil publiczny</h3>
          <SettingRow title="Avatar, bio i zainteresowania" description="Personalizacja profilu w jednym miejscu."><Link className="settings-button" to="/profile">Edytuj profil</Link></SettingRow>
        </>}
        {section === 'notifications' && <>
          {preferenceError && <div className="settings-error"><p role="alert">{preferenceError}</p>{!loaded && <button className="settings-button" onClick={reload}>Spróbuj ponownie</button>}</div>}
          {!loaded && !preferenceError && <p role="status" aria-label="Ładowanie preferencji" className="sr-only">Ładowanie preferencji</p>}
          <h3 className="settings-group-title">O czym chcesz wiedzieć</h3>
          <SettingRow title="Zaproszenia do znajomych" description="Nowe zaproszenie pojawi się w dzwonku w górnym pasku i włączy sygnały wybrane niżej. Po wyłączeniu zobaczysz je tylko na stronie Znajomi.">{notificationSwitch('friendRequests', 'Zaproszenia do znajomych')}</SettingRow>
          <SettingRow title="Wyzwania w Arenie" description="Wyzwanie do pojedynku pojawi się w dzwonku w górnym pasku i włączy sygnały wybrane niżej. Po wyłączeniu zobaczysz je tylko w Arenie.">{notificationSwitch('challenges', 'Wyzwania w Arenie')}</SettingRow>
          <SettingRow title="Znaleziony mecz" description={matchFoundSilent
            ? 'Włącz dźwięk albo powiadomienia systemowe poniżej, aby ta opcja miała efekt.'
            : 'Gdy znajdziemy przeciwnika, usłyszysz sygnał lub dostaniesz powiadomienie systemowe. Mecz otworzy się sam także bez tego.'}>
            {notificationSwitch('matchFound', 'Znaleziony mecz', matchFoundSilent)}</SettingRow>
          <SettingRow title="Znajomi online: komunikat" description="Krótki komunikat w rogu ekranu i sygnał wybrany niżej, gdy znajomy wejdzie do aplikacji.">{notificationSwitch('friendOnline', 'Komunikat o znajomych online')}</SettingRow>
          <SettingRow title="Znajomi online: dzwonek" description="Jednorazowe powiadomienie w dzwonku w górnym pasku, gdy znajomy wejdzie online.">{notificationSwitch('friendOnlineBell', 'Znajomi online w dzwonku')}</SettingRow>
          <h3 className="settings-group-title">Jak chcesz się dowiadywać</h3>
          <SettingRow title="Dźwięk" description="Krótki sygnał, inny dla każdego zdarzenia. Gra, gdy Hackademy jest otwarte, po pierwszym kliknięciu na stronie (wymóg przeglądarki)."
            extra={<ul className="settings-sound-list" aria-label="Sygnały do odsłuchania">{soundEvents.map(event => <li key={event}>
              <span>{eventNames[event]}</span>
              <select aria-label={`Wariant sygnału: ${eventNames[event]}`} value={variants[event]} onChange={change => {
                chooseVariant(event, change.target.value);
                setVariants(previous => ({ ...previous, [event]: change.target.value }));
                void previewSound(event);
              }}>{soundVariants[event].map(variant => <option key={variant.id} value={variant.id}>{variant.name}</option>)}</select>
              <button type="button" className="settings-button settings-button-small" aria-label={`Odtwórz próbnie: ${eventNames[event]}`}
                onClick={() => void previewSound(event)}><Play size={14} aria-hidden="true" />Odtwórz</button>
            </li>)}</ul>}>{notificationSwitch('sound', 'Dźwięk powiadomień')}</SettingRow>
          <SettingRow title="Powiadomienia systemowe" description={notificationsSupported
            ? 'Dymek systemu, gdy Hackademy jest w innej karcie albo zminimalizowane. Na aktywnej karcie wystarczą dzwonek i dźwięk.'
            : 'Ta przeglądarka nie obsługuje powiadomień na tej stronie.'}
            extra={notificationsSupported && <button type="button" className="settings-button settings-button-small settings-preview" disabled={busy === 'permission'}
              onClick={() => void previewNotification()}>Wyślij próbne</button>}>
            {notificationSwitch('browserNotifications', 'Powiadomienia systemowe', !notificationsSupported)}</SettingRow>
          {notificationsSupported && preferences.browserNotifications && !systemAllowed && <p className="settings-footnote">Powiadomienia są włączone na koncie, ale ta przeglądarka nie ma zgody. Kliknij „Wyślij próbne”, aby ją nadać.</p>}
          <h3 className="settings-group-title">Co się teraz stanie</h3>
          <dl className="settings-summary">{soundEvents.map(event => <div key={event}>
            <dt>{eventNames[event]}</dt><dd>{eventOutcome(event, preferences, systemAllowed)}</dd>
          </div>)}</dl>
          <p className="settings-footnote">Preferencje zapisują się na koncie i działają na każdym urządzeniu.</p>
        </>}
        {section === 'appearance' && <>
          <h3 className="settings-group-title">Dostępność</h3>
          <SettingRow title="Ogranicz animacje" description="Spokojniejsze przejścia i mniej ruchu w interfejsie."><Switch label="Ogranicz animacje" checked={reducedMotion} onChange={value => { setReducedMotion(value); setFeedback({ message: 'Preferencja została zapisana na tym urządzeniu.', error: false }); }} /></SettingRow>
          <p className="settings-footnote">Ustawienia systemowe ograniczające ruch są zawsze respektowane. Preferencja animacji zapisuje się na tym urządzeniu.</p>
        </>}
        {section === 'security' && <>
          <h3 className="settings-group-title">Zmiana hasła</h3>
          <SettingRow title="Hasło i metody logowania" description="Zmień hasło, zarządzaj adresami e-mail i połączonymi kontami."><button className="settings-button" onClick={() => openUserProfile()}>Zarządzaj dostępem</button></SettingRow>
          <h3 className="settings-group-title">Bieżąca sesja</h3>
          <SettingRow title="Wyloguj się z tego urządzenia" description="Zakończ korzystanie z konta w tej przeglądarce."><button className="settings-button" onClick={() => { logout(); navigate('/login'); }}>Wyloguj się</button></SettingRow>
        </>}
        <div className={`settings-feedback ${feedback?.error ? 'settings-feedback-error' : ''}`} role={feedback?.error ? 'alert' : 'status'} aria-live="polite">{saving ? 'Zapisywanie preferencji…' : feedback?.message}</div>
      </section>
    </div>
  </div>;
}
