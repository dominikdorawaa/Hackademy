import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNotificationPreferences } from '../context/NotificationPreferencesContext';
import * as userApi from '../services/userApi';
import type { NotificationPreferences } from '../services/userApi';
import type { DashboardUser } from '../types/api';
import type { ApiResponse } from '../services/http';
import './SettingsPage.css';
import { LoadingSkeleton, Skeleton } from '../components/common/Skeleton';

const sections = {
  account: { title: 'Konto', description: 'Dane logowania i profil publiczny.' },
  notifications: { title: 'Powiadomienia', description: 'Wybierz, o czym i jak chcesz się dowiadywać.' },
  appearance: { title: 'Wygląd', description: 'Dostosuj animacje do swoich preferencji.' },
  security: { title: 'Bezpieczeństwo', description: 'Zadbaj o dostęp do swojego konta.' },
};
type Section = keyof typeof sections;

async function responseError(response: ApiResponse<unknown>, fallback: string) {
  if (response.status === 401 || response.status === 403) return 'Sesja wygasła. Zaloguj się ponownie.';
  try {
    const body = await response.json() as Record<string, unknown>;
    if (body.message === 'Incorrect current password') return 'Obecne hasło jest nieprawidłowe.';
    if (body.message === 'Username already taken') return 'Ta nazwa jest już zajęta. Wybierz inną.';
  } catch { return fallback; }
  return fallback;
}

function SettingRow({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <div className="settings-row"><div><h3>{title}</h3><p>{description}</p></div><div className="settings-control">{children}</div></div>;
}

function Switch({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return <button type="button" className="settings-switch" role="switch" aria-label={label} aria-checked={checked}
    disabled={disabled} onClick={() => onChange(!checked)}><span /></button>;
}

export default function SettingsPage() {
  const { user, token, login, logout } = useAuth();
  const { reducedMotion, setReducedMotion } = useTheme();
  const { preferences, loaded, saving, error: preferenceError, reload, update } = useNotificationPreferences();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const requestedSection = search.get('section');
  const section: Section = requestedSection && Object.hasOwn(sections, requestedSection) ? requestedSection as Section : 'account';
  const [account, setAccount] = useState<DashboardUser | null>(null);
  const [accountError, setAccountError] = useState('');
  const [accountAttempt, setAccountAttempt] = useState(0);
  const [username, setUsername] = useState(user?.sub ?? '');
  const [password, setPassword] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState<'username' | 'password' | 'permission' | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null);
  const activeToken = useRef(token);
  useLayoutEffect(() => { activeToken.current = token; }, [token]);
  const submitting = useRef(false);
  const notificationsSupported = 'Notification' in window && window.isSecureContext;

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    setAccount(null);
    setAccountError('');
    void (async () => {
      try {
        const response = await userApi.getCurrentUser({ Authorization: `Bearer ${token}` }, controller.signal);
        if (!response.ok) throw new Error(await responseError(response, 'Nie udało się pobrać danych konta.'));
        const data = await response.json();
        if (!controller.signal.aborted) { setAccount(data); setUsername(data.username); }
      } catch (error) {
        if (!controller.signal.aborted) setAccountError(error instanceof Error ? error.message : 'Nie udało się pobrać danych konta.');
      }
    })();
    return () => controller.abort();
  }, [token, accountAttempt]);

  const selectSection = (next: Section) => {
    const parameters = new URLSearchParams(search);
    parameters.set('section', next);
    setSearch(parameters);
    setFeedback(null);
  };

  const changeName = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || submitting.current) return;
    const newUsername = username.trim();
    if (newUsername.length < 3 || newUsername.length > 20) {
      setFeedback({ message: 'Nazwa użytkownika musi mieć od 3 do 20 znaków.', error: true });
      return;
    }
    submitting.current = true;
    setBusy('username');
    setFeedback(null);
    try {
      const response = await userApi.changeUsername(newUsername, { Authorization: `Bearer ${token}` });
      if (!response.ok) throw new Error(await responseError(response, 'Nie udało się zmienić nazwy użytkownika. Spróbuj ponownie.'));
      const result = await response.json();
      if (activeToken.current !== token) return;
      login(result.token);
      setFeedback({ message: 'Nazwa użytkownika została zmieniona.', error: false });
    } catch (error) {
      if (activeToken.current === token) setFeedback({ message: error instanceof Error ? error.message : 'Nie udało się zmienić nazwy użytkownika.', error: true });
    } finally { submitting.current = false; setBusy(null); }
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || submitting.current) return;
    if (password.next !== password.confirm) {
      setFeedback({ message: 'Nowe hasła muszą być identyczne.', error: true });
      return;
    }
    submitting.current = true;
    setBusy('password');
    setFeedback(null);
    try {
      const response = await userApi.changePassword(password.current, password.next, { Authorization: `Bearer ${token}` });
      if (!response.ok) throw new Error(await responseError(response, 'Nie udało się zmienić hasła. Spróbuj ponownie.'));
      if (activeToken.current !== token) return;
      setPassword({ current: '', next: '', confirm: '' });
      setFeedback({ message: 'Hasło zostało zmienione.', error: false });
    } catch (error) {
      if (activeToken.current === token) setFeedback({ message: error instanceof Error ? error.message : 'Nie udało się zmienić hasła.', error: true });
    } finally { submitting.current = false; setBusy(null); }
  };

  const changeNotification = async (key: keyof NotificationPreferences, value: boolean) => {
    if (key === 'browserNotifications' && value) {
      if (!notificationsSupported) return;
      setBusy('permission');
      try {
        const permission = await Notification.requestPermission();
        if (activeToken.current !== token) return;
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
                <input id="settings-username" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} required minLength={3} maxLength={20} disabled={!!busy} aria-describedby="settings-username-help" />
                <p id="settings-username-help">Tak zobaczą Cię inni użytkownicy. Od 3 do 20 znaków.</p>
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
          <h3 className="settings-group-title">Powiadomienia w aplikacji</h3>
          <SettingRow title="Zaproszenia do znajomych" description="Pokaż nowe prośby w centrum powiadomień.">{notificationSwitch('friendRequests', 'Zaproszenia do znajomych')}</SettingRow>
          <SettingRow title="Wyzwania w Arenie" description="Pokaż zaproszenia do pojedynku w centrum powiadomień.">{notificationSwitch('challenges', 'Wyzwania w Arenie')}</SettingRow>
          <SettingRow title="Znaleziony mecz" description="Powiadom mnie dźwiękiem lub w przeglądarce, gdy mecz jest gotowy.">{notificationSwitch('matchFound', 'Znaleziony mecz')}</SettingRow>
          <h3 className="settings-group-title">Sposób powiadamiania</h3>
          <SettingRow title="Dźwięk" description="Krótki sygnał przy nowym zaproszeniu, wyzwaniu lub znalezionym meczu.">{notificationSwitch('sound', 'Dźwięk powiadomień')}</SettingRow>
          <SettingRow title="Powiadomienia przeglądarkowe" description={notificationsSupported ? 'Dowiedz się o wydarzeniu, gdy korzystasz z innej karty.' : 'Ta przeglądarka nie obsługuje powiadomień na tej stronie.'}>{notificationSwitch('browserNotifications', 'Powiadomienia przeglądarkowe', !notificationsSupported)}</SettingRow>
          {notificationsSupported && preferences.browserNotifications && Notification.permission !== 'granted' && <p className="settings-footnote">Powiadomienia są zapisane na koncie, ale to urządzenie wymaga zgody. Wyłącz i włącz przełącznik, aby ją nadać.</p>}
          <p className="settings-footnote">Wyciszenie nie zatrzymuje wyszukiwania ani przejścia do znalezionego meczu. Zaproszenia nadal znajdziesz na stronie znajomych i w Arenie.</p>
          <p className="settings-footnote">Preferencje zapisują się na koncie. Dźwięk wymaga wcześniejszej interakcji ze stroną.</p>
        </>}
        {section === 'appearance' && <>
          <h3 className="settings-group-title">Dostępność</h3>
          <SettingRow title="Ogranicz animacje" description="Spokojniejsze przejścia i mniej ruchu w interfejsie."><Switch label="Ogranicz animacje" checked={reducedMotion} onChange={value => { setReducedMotion(value); setFeedback({ message: 'Preferencja została zapisana na tym urządzeniu.', error: false }); }} /></SettingRow>
          <p className="settings-footnote">Ustawienia systemowe ograniczające ruch są zawsze respektowane. Preferencja animacji zapisuje się na tym urządzeniu.</p>
        </>}
        {section === 'security' && <>
          <h3 className="settings-group-title">Zmiana hasła</h3>
          <form className="settings-form" onSubmit={event => void changePassword(event)}>
            <label htmlFor="settings-current-password">Obecne hasło</label><input id="settings-current-password" type="password" autoComplete="current-password" required disabled={!!busy} value={password.current} onChange={event => setPassword({ ...password, current: event.target.value })} />
            <label htmlFor="settings-new-password">Nowe hasło</label><input id="settings-new-password" type="password" autoComplete="new-password" required disabled={!!busy} value={password.next} onChange={event => setPassword({ ...password, next: event.target.value })} />
            <label htmlFor="settings-confirm-password">Powtórz nowe hasło</label><input id="settings-confirm-password" type="password" autoComplete="new-password" required disabled={!!busy} value={password.confirm} onChange={event => setPassword({ ...password, confirm: event.target.value })} />
            <button className="settings-button settings-button-primary" disabled={!!busy}>{busy === 'password' ? 'Zapisywanie…' : 'Zmień hasło'}</button>
          </form>
          <h3 className="settings-group-title">Bieżąca sesja</h3>
          <SettingRow title="Wyloguj się z tego urządzenia" description="Zakończ korzystanie z konta w tej przeglądarce."><button className="settings-button" onClick={() => { logout(); navigate('/login'); }}>Wyloguj się</button></SettingRow>
        </>}
        <div className={`settings-feedback ${feedback?.error ? 'settings-feedback-error' : ''}`} role={feedback?.error ? 'alert' : 'status'} aria-live="polite">{saving ? 'Zapisywanie preferencji…' : feedback?.message}</div>
      </section>
    </div>
  </div>;
}
