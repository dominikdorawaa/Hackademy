import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useClerk, useUser } from '@clerk/react';
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
import { ArrowsDownUp, Bell, CaretDown, ChatCircleText, Desktop, PaintBrush, PersonSimpleRun, ShieldCheck, SpeakerHigh, Sword, UserCircle } from '@phosphor-icons/react';
import { ArenaRunner } from '../components/arena/ArenaLoader';
import InvitationCard from '../components/InvitationCard';
import { useReducedMotion } from '../hooks/useReducedMotion';
import type { Icon } from '@phosphor-icons/react';
import { useUsernameChange, validateUsername } from '../hooks/useUsernameChange';
import { chooseVariant, playSound, selectedVariant, soundVariants, unlockAudio } from '../lib/notificationSounds';
import type { SoundEvent } from '../lib/notificationSounds';
import { USERNAME_MAX } from '../lib/username';
import { getActivitySharing, saveActivitySharing } from '../services/presenceApi';
import { DeleteAccountDialog } from '../components/settings/DeleteAccountDialog';
import { rememberAccountDeleted } from '../lib/accountDeletion';

const sections: Record<'account' | 'notifications' | 'appearance' | 'security', { title: string; description: string; icon: Icon }> = {
  account: { title: 'Konto', description: 'Dane logowania i profil publiczny.', icon: UserCircle },
  notifications: { title: 'Powiadomienia', description: 'Wybierz, o czym i jak chcesz się dowiadywać.', icon: Bell },
  appearance: { title: 'Wygląd', description: 'Motyw i animacje dopasowane do Ciebie.', icon: PaintBrush },
  security: { title: 'Bezpieczeństwo', description: 'Zadbaj o dostęp do swojego konta.', icon: ShieldCheck },
};
type Section = keyof typeof sections;

const soundEvents: SoundEvent[] = ['friendRequests', 'challenges', 'matchFound', 'friendOnline'];
const eventNames: Record<SoundEvent, string> = {
  friendRequests: 'Zaproszenie do znajomych', challenges: 'Wyzwanie w Arenie', matchFound: 'Znaleziony mecz', friendOnline: 'Znajomy online',
};
type Channel = 'bell' | 'toast' | 'sound' | 'system';
type Topic = SoundEvent | 'friendOnlineBell';
const channelInfo: Record<Channel, { label: string; icon: Icon }> = {
  bell: { label: 'Dzwonek', icon: Bell }, toast: { label: 'Komunikat', icon: ChatCircleText },
  sound: { label: 'Dźwięk', icon: SpeakerHigh }, system: { label: 'Systemowe', icon: Desktop },
};
const topicChannels: Record<Topic, Channel[]> = {
  friendRequests: ['bell', 'toast', 'sound', 'system'], challenges: ['bell', 'toast', 'sound', 'system'], matchFound: ['sound', 'system'],
  friendOnline: ['toast', 'sound', 'system'], friendOnlineBell: ['bell'],
};

function channelActive(channel: Channel, preferences: NotificationPreferences, systemAllowed: boolean) {
  if (channel === 'sound') return preferences.sound;
  if (channel === 'system') return preferences.browserNotifications && systemAllowed;
  return true;
}

function ChannelChips({ topic, preferences, systemAllowed }: { topic: Topic; preferences: NotificationPreferences; systemAllowed: boolean }) {
  const enabled = preferences[topic];
  return <ul className="settings-channels" aria-label="Gdzie to zobaczysz">{topicChannels[topic].map(channel => {
    const active = enabled && channelActive(channel, preferences, systemAllowed);
    const ChannelIcon = channelInfo[channel].icon;
    return <li key={channel} data-active={active}><ChannelIcon size={16} weight={active ? 'fill' : 'regular'} aria-hidden="true" />
      {channelInfo[channel].label}{!active && <span className="sr-only"> (wyłączone)</span>}</li>;
  })}</ul>;
}

function NotificationPreview({ ownName, ownAvatar }: { ownName?: string; ownAvatar?: DashboardUser['avatar'] }) {
  return <div className="settings-preview-strip">
    <figure><figcaption>Zaproszenie do znajomych</figcaption>
      <div inert><InvitationCard kind="friend" actor="ola_sec" /></div></figure>
    <figure><figcaption>Wyzwanie w Arenie</figcaption>
      <div inert><InvitationCard kind="challenge" actor="kuba_root" elo={812} ownName={ownName} ownAvatar={ownAvatar} /></div></figure>
    <p className="settings-preview-note">Zaproszenie widać w rogu ekranu przez 5 sekund, wyzwanie przez 15. Najechanie na komunikat wstrzymuje odliczanie, a potem zostaje on w dzwonku.</p>
  </div>;
}

async function responseError(response: ApiResponse<unknown>, fallback: string, passMessage = false) {
  if (response.status === 401) return 'Sesja wygasła. Zaloguj się ponownie.';
  try {
    const body = await response.json() as Record<string, unknown>;
    if (passMessage && typeof body.message === 'string' && response.status !== 500) return body.message;
    if (body.message === 'Incorrect current password') return 'Obecne hasło jest nieprawidłowe.';
    if (typeof body.newUsername === 'string') return `${body.newUsername}.`;
  } catch { return fallback; }
  return fallback;
}

function SettingRow({ title, description, extra, children }: { title: string; description: string; extra?: ReactNode; children: ReactNode }) {
  return <div className="settings-row"><div className="settings-row-text"><h4>{title}</h4><p>{description}</p>{extra}</div><div className="settings-control">{children}</div></div>;
}

function SettingsGroup({ id, title, danger, children }: { id: string; title: string; danger?: boolean; children: ReactNode }) {
  return <section className={danger ? 'settings-group settings-group-danger' : 'settings-group'} aria-labelledby={`settings-group-${id}`}>
    <h3 id={`settings-group-${id}`} className="settings-group-title">{title}</h3>
    <div className="settings-panel">{children}</div>
  </section>;
}

function Switch({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return <button type="button" className="settings-switch" role="switch" aria-label={label} aria-checked={checked}
    disabled={disabled} onClick={() => onChange(!checked)}><span /></button>;
}

export default function SettingsPage() {
  const { user, sessionKey, logout } = useAuth();
  const { theme, setPreference, reducedMotion, setReducedMotion } = useTheme();
  const calmMotion = useReducedMotion();
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
  const { isLoaded: clerkLoaded, user: clerkUser } = useUser();
  const [busy, setBusy] = useState<'permission' | null>(null);
  const { change: changeUsername, changing: renaming } = useUsernameChange();
  const [nameError, setNameError] = useState('');
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null);
  const activeToken = useRef(sessionKey);
  useLayoutEffect(() => { activeToken.current = sessionKey; }, [sessionKey]);
  const notificationsSupported = 'Notification' in window && window.isSecureContext;
  const systemAllowed = notificationsSupported && Notification.permission === 'granted';
  const matchFoundSilent = !preferences.sound && !(preferences.browserNotifications && systemAllowed);
  const [sharing, setSharing] = useState<boolean | null>(null);
  const [savingSharing, setSavingSharing] = useState(false);
  const [sharingFailed, setSharingFailed] = useState(false);
  const [sharingAttempt, setSharingAttempt] = useState(0);
  const [variants, setVariants] = useState(() => Object.fromEntries(soundEvents.map(event => [event, selectedVariant(event).id])) as Record<SoundEvent, string>);

  useEffect(() => {
    if (!sessionKey) return;
    const controller = new AbortController();
    setSharingFailed(false);
    getActivitySharing({ sessionKey }, controller.signal)
      .then(async response => {
        if (!response.ok) throw new Error();
        setSharing((await response.json()).enabled);
      })
      .catch(() => { if (!controller.signal.aborted) setSharingFailed(true); });
    return () => controller.abort();
  }, [sessionKey, sharingAttempt]);

  const deleteAccount = async (confirmation: userApi.AccountDeletionConfirmation) => {
    if (!sessionKey) throw new Error('Sesja wygasła. Zaloguj się ponownie.');
    const response = await userApi.deleteAccount(confirmation, { sessionKey });
    if (!response.ok) throw new Error(await responseError(response, 'Nie udało się usunąć konta. Spróbuj ponownie.', true));
    rememberAccountDeleted();
    await logout().catch(() => {});
    navigate('/', { replace: true });
  };

  const changeSharing = async (enabled: boolean) => {
    if (!sessionKey) return;
    setSavingSharing(true);
    try {
      const response = await saveActivitySharing(enabled, { sessionKey });
      if (!response.ok) throw new Error();
      setSharing((await response.json()).enabled);
      setFeedback({ message: enabled ? 'Znajomi znów widzą, co robisz.' : 'Znajomi widzą już tylko, czy jesteś online.', error: false });
    } catch {
      setFeedback({ message: 'Nie udało się zapisać ustawienia prywatności.', error: true });
    } finally {
      setSavingSharing(false);
    }
  };

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

  // The naming rules only show up once the typed name breaks them.
  const unchangedName = !account || username.trim() === account.username;
  const typedNameProblem = unchangedName ? null : validateUsername(username);
  const nameProblem = nameError || typedNameProblem;

  const changeName = async (event: FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    setNameError('');
    const result = await changeUsername(username);
    if (!result) return;
    if (!result.ok) { setNameError(result.error); return; }
    setAccount(previous => previous && { ...previous, username: result.username });
    setFeedback({ message: 'Nazwa użytkownika została zmieniona.', error: false });
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
      // No tag: a repeated tag silently replaces the previous bubble, so a second test would show nothing.
      const notification = new Notification('Próbne powiadomienie Hackademy', { body: 'Tak zobaczysz zaproszenie, wyzwanie albo znaleziony mecz, gdy Hackademy jest w tle.' });
      notification.onerror = () => setFeedback({ message: 'System nie wyświetlił powiadomienia. Sprawdź, czy ustawienia systemu pozwalają przeglądarce pokazywać powiadomienia.', error: true });
    } catch {
      setFeedback({ message: 'Nie udało się wyświetlić powiadomienia na tym urządzeniu.', error: true });
      return;
    }
    setFeedback({ message: preferences.browserNotifications
      ? 'Wysłano próbne powiadomienie. Jeśli go nie widzisz, wyłącz tryb „Nie przeszkadzać” i sprawdź, czy system pozwala przeglądarce pokazywać powiadomienia.'
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
      <nav className="settings-nav" aria-label="Sekcje ustawień">{(Object.keys(sections) as Section[]).map(key => {
        const SectionIcon = sections[key].icon;
        return <button key={key} type="button" aria-current={section === key ? 'page' : undefined} onClick={() => selectSection(key)}>
          <SectionIcon size={20} weight={section === key ? 'fill' : 'regular'} aria-hidden="true" />{sections[key].title}</button>;
      })}</nav>
      <section className="settings-content" aria-labelledby="settings-section-title">
        <header className="settings-section-heading"><h2 id="settings-section-title">{sections[section].title}</h2><p>{sections[section].description}</p></header>
        {section === 'account' && <>
          <SettingsGroup id="account" title="Dane konta">
          {accountError ? <div className="settings-error"><p role="alert">{accountError}</p><button className="settings-button" onClick={() => setAccountAttempt(value => value + 1)}>Spróbuj ponownie</button></div>
            : !account ? <LoadingSkeleton label="Ładowanie danych konta" className="settings-form">
              <Skeleton width={140} height={14} tone="raised" />
              <Skeleton height={48} radius={6} tone="raised" />
              <Skeleton width="70%" height={14} tone="raised" />
              <Skeleton width={150} height={48} radius={6} tone="raised" />
            </LoadingSkeleton> : <>
              <form className="settings-row settings-name" noValidate onSubmit={event => void changeName(event)}>
                <div className="settings-row-text"><h4><label htmlFor="settings-username">Nazwa użytkownika</label></h4>
                  <p id="settings-username-help">Tak zobaczą Cię inni użytkownicy. Możesz ją też zmienić w edycji profilu.</p></div>
                <div className="settings-control settings-name-control">
                  <input id="settings-username" autoComplete="username" value={username} maxLength={USERNAME_MAX} disabled={renaming}
                    aria-invalid={!!nameProblem} aria-describedby={nameProblem ? 'settings-username-error settings-username-help' : 'settings-username-help'}
                    onChange={event => { setUsername(event.target.value); setNameError(''); }} />
                  <button className="settings-button" disabled={renaming || unchangedName || !!typedNameProblem}>{renaming ? 'Zapisywanie…' : 'Zapisz nazwę'}</button>
                  {nameProblem && <p id="settings-username-error" className="settings-field-error" role="alert">{nameProblem}</p>}
                </div>
              </form>
              <SettingRow title="Adres e-mail" description="Służy do logowania. Aby go zmienić, dodaj nowy adres, potwierdź go kodem i ustaw jako główny."
                extra={<p className="settings-email">{account.email}</p>}>
                <button type="button" className="settings-button" onClick={() => openUserProfile()}>Zmień adres</button></SettingRow>
            </>}
          </SettingsGroup>
          <SettingsGroup id="profile" title="Profil publiczny">
            <SettingRow title="Avatar, bio i zainteresowania" description="Personalizacja profilu w jednym miejscu."><Link className="settings-button" to="/profile">Edytuj profil</Link></SettingRow>
          </SettingsGroup>
          <SettingsGroup id="privacy" title="Prywatność">
            {sharingFailed && <div className="settings-error"><p role="alert">Nie udało się wczytać ustawienia prywatności.</p>
              <button className="settings-button" onClick={() => setSharingAttempt(value => value + 1)}>Spróbuj ponownie</button></div>}
            <SettingRow title="Pokazuj znajomym, co robię" description={sharing === false
              ? 'Wyłączone: znajomi widzą tylko, czy jesteś online.'
              : 'Znajomi zobaczą, czy jesteś w pojedynku, w kolejce Areny albo w którym pokoju, a po wyjściu czas ostatniej wizyty.'}>
              <Switch label="Pokazuj znajomym, co robię" checked={sharing ?? true} disabled={sharing === null || savingSharing}
                onChange={value => void changeSharing(value)} /></SettingRow>
          </SettingsGroup>
        </>}
        {section === 'notifications' && <>
          {preferenceError && <div className="settings-error"><p role="alert">{preferenceError}</p>{!loaded && <button className="settings-button" onClick={reload}>Spróbuj ponownie</button>}</div>}
          {!loaded && !preferenceError && <p role="status" aria-label="Ładowanie preferencji" className="sr-only">Ładowanie preferencji</p>}
          <SettingsGroup id="preview" title="Tak to wygląda">
            <NotificationPreview ownName={account?.username ?? user?.username} ownAvatar={account?.avatar ?? user?.avatar} />
          </SettingsGroup>
          <SettingsGroup id="topics" title="O czym chcesz wiedzieć">
          <SettingRow title="Zaproszenia do znajomych" description={preferences.friendRequests ? 'Gdy ktoś zaprosi Cię do znajomych.' : 'Wyłączone: zobaczysz je tylko na stronie Znajomi.'}
            extra={<ChannelChips topic="friendRequests" preferences={preferences} systemAllowed={systemAllowed} />}>{notificationSwitch('friendRequests', 'Zaproszenia do znajomych')}</SettingRow>
          <SettingRow title="Wyzwania w Arenie" description={preferences.challenges ? 'Gdy ktoś wyzwie Cię na pojedynek.' : 'Wyłączone: zobaczysz je tylko w Arenie.'}
            extra={<ChannelChips topic="challenges" preferences={preferences} systemAllowed={systemAllowed} />}>{notificationSwitch('challenges', 'Wyzwania w Arenie')}</SettingRow>
          <SettingRow title="Znaleziony mecz" description={matchFoundSilent
            ? 'Włącz dźwięk albo powiadomienia systemowe, aby ta opcja miała efekt.'
            : 'Gdy znajdziemy Ci przeciwnika. Mecz i tak otworzy się sam.'}
            extra={<ChannelChips topic="matchFound" preferences={preferences} systemAllowed={systemAllowed} />}>
            {notificationSwitch('matchFound', 'Znaleziony mecz', matchFoundSilent)}</SettingRow>
          <SettingRow title="Znajomi online: komunikat" description={preferences.friendOnline ? 'Gdy znajomy wejdzie do aplikacji.' : 'Wyłączone: bez komunikatu i sygnału.'}
            extra={<ChannelChips topic="friendOnline" preferences={preferences} systemAllowed={systemAllowed} />}>{notificationSwitch('friendOnline', 'Komunikat o znajomych online')}</SettingRow>
          <SettingRow title="Znajomi online: dzwonek" description={preferences.friendOnlineBell ? 'Jednorazowo, gdy znajomy wejdzie online.' : 'Wyłączone: bez wpisu w dzwonku.'}
            extra={<ChannelChips topic="friendOnlineBell" preferences={preferences} systemAllowed={systemAllowed} />}>{notificationSwitch('friendOnlineBell', 'Znajomi online w dzwonku')}</SettingRow>
          </SettingsGroup>
          <SettingsGroup id="channels" title="Jak chcesz się dowiadywać">
          <SettingRow title="Dźwięk" description="Inny sygnał dla każdego zdarzenia, gdy Hackademy jest otwarte."
            extra={<details className="settings-sounds"><summary>Wybierz sygnały<CaretDown size={14} aria-hidden="true" /></summary>
              <ul className="settings-sound-list" aria-label="Sygnały do odsłuchania">{soundEvents.map(event => <li key={event}>
              <span>{eventNames[event]}</span>
              <select aria-label={`Wariant sygnału: ${eventNames[event]}`} value={variants[event]} onChange={change => {
                chooseVariant(event, change.target.value);
                setVariants(previous => ({ ...previous, [event]: change.target.value }));
                void previewSound(event);
              }}>{soundVariants[event].map(variant => <option key={variant.id} value={variant.id}>{variant.name}</option>)}</select>
              <button type="button" className="settings-button settings-button-small" aria-label={`Odtwórz próbnie: ${eventNames[event]}`}
                onClick={() => void previewSound(event)}><Play size={14} aria-hidden="true" />Odtwórz</button>
            </li>)}</ul></details>}>{notificationSwitch('sound', 'Dźwięk powiadomień')}</SettingRow>
          <SettingRow title="Powiadomienia systemowe" description={notificationsSupported
            ? 'Dymek systemu, gdy Hackademy jest w tle.'
            : 'Ta przeglądarka nie obsługuje powiadomień na tej stronie.'}
            extra={notificationsSupported && <button type="button" className="settings-button settings-button-small settings-preview" disabled={busy === 'permission'}
              onClick={() => void previewNotification()}>Wyślij próbne</button>}>
            {notificationSwitch('browserNotifications', 'Powiadomienia systemowe', !notificationsSupported)}</SettingRow>
          {notificationsSupported && preferences.browserNotifications && !systemAllowed && <p className="settings-footnote">Powiadomienia są włączone na koncie, ale ta przeglądarka nie ma zgody. Kliknij „Wyślij próbne”, aby ją nadać.</p>}
          </SettingsGroup>
          <p className="settings-footnote">Preferencje zapisują się na koncie i działają na każdym urządzeniu.</p>
        </>}
        {section === 'appearance' && <>
          <SettingsGroup id="theme" title="Motyw">
            <div className="settings-row"><div className="settings-row-text"><h4 id="settings-theme-label">Motyw interfejsu</h4><p>Ciemny jest domyślny. Wybór zapisuje się na tym urządzeniu.</p></div>
              <div className="settings-control"><div className="settings-segmented" role="radiogroup" aria-labelledby="settings-theme-label">
                {([['dark', 'Ciemny'], ['light', 'Jasny']] as const).map(([value, label]) => <label key={value}>
                  <input type="radio" name="settings-theme" value={value} checked={theme === value} onChange={() => setPreference(value)} /><span>{label}</span>
                </label>)}
              </div></div></div>
          </SettingsGroup>
          <SettingsGroup id="motion" title="Dostępność">
            <SettingRow title="Ogranicz animacje" description="Zatrzymuje ruch w całej aplikacji."
              extra={<div className="settings-motion">
                <ul className="settings-motion-list">
                  <li><PersonSimpleRun size={18} aria-hidden="true" />Awatary i maskotki stoją w miejscu</li>
                  <li><Sword size={18} aria-hidden="true" />Pojedynki w Arenie bez animacji ciosów</li>
                  <li><ArrowsDownUp size={18} aria-hidden="true" />Przejścia i przewijanie bez płynnego ruchu</li>
                </ul>
                <figure className="settings-motion-demo" aria-hidden="true"><ArenaRunner avatar={account?.avatar ?? user?.avatar} className="settings-motion-runner" />
                  <figcaption>{calmMotion ? 'Podgląd: stoi' : 'Podgląd: biegnie'}</figcaption></figure>
              </div>}><Switch label="Ogranicz animacje" checked={reducedMotion} onChange={value => { setReducedMotion(value); setFeedback({ message: 'Preferencja została zapisana na tym urządzeniu.', error: false }); }} /></SettingRow>
          </SettingsGroup>
          <p className="settings-footnote">Ustawienia systemowe ograniczające ruch są zawsze respektowane. Preferencja animacji zapisuje się na tym urządzeniu.</p>
        </>}
        {section === 'security' && <>
          <SettingsGroup id="password" title="Hasło i logowanie">
            <SettingRow title="Hasło i metody logowania" description="Zmień hasło, zarządzaj adresami e-mail i połączonymi kontami."><button className="settings-button" onClick={() => openUserProfile()}>Zarządzaj dostępem</button></SettingRow>
          </SettingsGroup>
          <SettingsGroup id="session" title="Bieżąca sesja">
            <SettingRow title="Wyloguj się z tego urządzenia" description="Zakończ korzystanie z konta w tej przeglądarce."><button className="settings-button" onClick={() => { logout(); navigate('/login'); }}>Wyloguj się</button></SettingRow>
          </SettingsGroup>
          <SettingsGroup id="danger" title="Strefa niebezpieczna" danger>
            <SettingRow title="Usuń konto" description="Konto znika od razu i na zawsze. Nastąpi wylogowanie, a adres e-mail i nazwa użytkownika będą wolne do ponownej rejestracji.">
              <DeleteAccountDialog username={account?.username ?? user?.username ?? ''} passwordEnabled={clerkLoaded ? clerkUser?.passwordEnabled : undefined}
                onDelete={deleteAccount} /></SettingRow>
          </SettingsGroup>
        </>}
        <div className={`settings-feedback ${feedback?.error ? 'settings-feedback-error' : ''}`} role={feedback?.error ? 'alert' : 'status'} aria-live="polite">{saving ? 'Zapisywanie preferencji…' : feedback?.message}</div>
      </section>
    </div>
  </div>;
}
