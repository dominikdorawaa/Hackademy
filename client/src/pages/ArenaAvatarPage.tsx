import { useEffect, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getCurrentUser, saveAvatar as saveAccountAvatar } from '../services/userApi';
import { PROFILE_UPDATED } from '../lib/profile';
import { AvatarSprite } from '../components/arena/avatar/AvatarSprite';
import { useAvatarAtlas, useAvatarPortrait } from '../components/arena/avatar/useAvatarAtlas';
import { AVATAR_POSES, CLOTH_RAMPS, fromAvatarConfig, HAIR_RAMPS, HAIR_STYLES, HAT_STYLES, readAvatar, saveAvatar, SKIN_RAMPS, toAvatarConfig } from '../components/arena/avatar/avatarModel';
import type { Avatar, Ramp } from '../components/arena/avatar/avatarModel';
import { AVATAR_ATLASES, danceFrames, RUN_FRAME_TIME, runFrames } from '../components/arena/avatar/fighters';
import type { AvatarAtlasSource } from '../components/arena/avatar/fighters';
import './ArenaAvatarPage.css';
import './UserDashboardPage.css';

const OUTFITS: { id: Avatar['outfit']; name: string; description: string }[] = [
  { id: 'baza', name: 'Klasyczna', description: 'Koszulka i proste spodnie.' },
  { id: 'bluza', name: 'Bluza', description: 'Bluza z opuszczonym kapturem, jeansy i trampki.' },
  { id: 'dres', name: 'Dres', description: 'Kurtka dresowa z paskami i spodnie z lampasem.' },
];
const row = (index: number, count = 8) => Array.from({ length: count }, (_, column) => index * 9 + column + 1);
const PREVIEWS: { id: string; label: string; frames: (source: AvatarAtlasSource) => number[]; loop: boolean; frameTime?: number }[] = [
  { id: 'front', label: 'Przód', frames: () => [0], loop: true },
  { id: 'idle', label: 'Postawa', frames: () => [0], loop: true },
  { id: 'attack', label: 'Atak', frames: () => row(1), loop: true },
  { id: 'hurt', label: 'Trafienie', frames: () => [...row(4, 4), 0, 0, 0], loop: true },
  { id: 'defeat', label: 'Upadek', frames: () => row(5), loop: false },
  { id: 'run', label: 'Bieg', frames: source => runFrames(source.run), loop: true, frameTime: RUN_FRAME_TIME },
  { id: 'groove', label: 'Taniec', frames: source => danceFrames(source.dances.groove), loop: true },
  { id: 'sixseven', label: 'Six-seven', frames: source => danceFrames(source.dances.sixseven), loop: true },
];
const COLOR_GROUPS: { key: keyof Avatar['colors']; legend: string; options: Record<string, Ramp> }[] = [
  { key: 'skin', legend: 'Skóra', options: SKIN_RAMPS },
  { key: 'hair', legend: 'Włosy', options: HAIR_RAMPS },
  { key: 'top', legend: 'Góra', options: CLOTH_RAMPS },
  { key: 'bottom', legend: 'Dół', options: CLOTH_RAMPS },
  { key: 'shoes', legend: 'Buty', options: CLOTH_RAMPS },
  { key: 'hat', legend: 'Kolor czapki', options: CLOTH_RAMPS },
];
const HAIR_NAMES: Record<Avatar['hair'], string> = { brak: 'Bez włosów', krotkie: 'Krótkie', irokez: 'Irokez', kucyk: 'Kucyk' };
const HAT_NAMES: Record<Avatar['hat'], string> = { brak: 'Bez czapki', czapka: 'Czapka zimowa', daszek: 'Daszek' };
const NAMES: Record<string, string> = {
  porcelanowa: 'Porcelanowa', jasna: 'Jasna', oliwkowa: 'Oliwkowa', brazowa: 'Brązowa', ciemna: 'Ciemna', heban: 'Hebanowa',
  czarne: 'Czarne', brazowe: 'Brązowe', rude: 'Rude', blond: 'Blond', siwe: 'Siwe', niebieskie: 'Niebieskie',
  granatowy: 'Granatowy', grafitowy: 'Grafitowy', bordowy: 'Bordowy', turkusowy: 'Turkusowy', piaskowy: 'Piaskowy', oliwkowy: 'Oliwkowy', czerwony: 'Czerwony', bialy: 'Biały',
};
const POSE_NAMES: Record<Avatar['pose'], string> = { przod: 'Przód', postawa: 'Postawa', profil: 'Profil' };

function PosePortrait({ avatar }: { avatar: Avatar }) {
  const portrait = useAvatarPortrait(toAvatarConfig(avatar));
  return portrait ? <img className="avatar-pose-image" src={portrait} alt="" /> : <span className="avatar-pose-image" aria-hidden="true" />;
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const subscribeReducedMotion = (onChange: () => void) => {
  if (typeof window.matchMedia !== 'function') return () => undefined;
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};
const systemReducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION_QUERY).matches;

export default function ArenaAvatarPage() {
  const { reducedMotion: appReducedMotion } = useTheme();
  const systemReduced = useSyncExternalStore(subscribeReducedMotion, systemReducedMotion, () => false);
  const reducedMotion = appReducedMotion || systemReduced;
  const [avatar, setAvatar] = useState<Avatar>(readAvatar);
  const [saved, setSaved] = useState(() => JSON.stringify(readAvatar()));
  const [preview, setPreview] = useState('front');
  const atlas = useAvatarAtlas(avatar);
  const fighter = AVATAR_ATLASES[avatar.outfit];
  const active = PREVIEWS.find(item => item.id === preview) ?? PREVIEWS[0];
  const dirty = saved !== JSON.stringify(avatar);
  const setColor = (key: keyof Avatar['colors'], value: string) => setAvatar(current => ({ ...current, colors: { ...current.colors, [key]: value } }));
  const { isAuthenticated, token } = useAuth();
  const sessionToken = isAuthenticated && token ? token : null;
  const [account, setAccount] = useState<{ token: string; status: 'ready' | 'error'; username: string | null } | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  useEffect(() => {
    if (!sessionToken) return;
    const controller = new AbortController();
    getCurrentUser({ Authorization: `Bearer ${sessionToken}` }, controller.signal)
      .then(response => { if (!response.ok) throw new Error('account'); return response.json(); })
      .then(user => {
        if (!user?.username) throw new Error('account');
        setAccount({ token: sessionToken, status: 'ready', username: user.username });
        const remote = fromAvatarConfig(user.avatar);
        if (remote) { setAvatar(remote); setSaved(JSON.stringify(remote)); } else setSaved('');
      })
      .catch(() => { if (!controller.signal.aborted) setAccount({ token: sessionToken, status: 'error', username: null }); });
    return () => controller.abort();
  }, [sessionToken]);
  const accountState = !sessionToken ? 'guest' : account?.token !== sessionToken ? 'loading' : account.status;
  const signedIn = accountState === 'ready';
  const blocked = accountState === 'loading' || accountState === 'error';
  const save = async () => {
    if (blocked) return;
    saveAvatar(avatar);
    if (signedIn) {
      setStatus('saving');
      try {
        const config = toAvatarConfig(avatar);
        const response = await saveAccountAvatar(config, { Authorization: `Bearer ${token}` });
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
      <div><Link to="/arena"><ArrowLeft size={16} aria-hidden="true" /> Wróć do Areny</Link><h1>Twój awatar</h1></div>
      <div className="avatar-actions">
        <button type="button" className="ud-btn ud-btn-solid" onClick={save} disabled={!dirty || blocked || status === 'saving'}>{status === 'saving' ? 'Zapisuję…' : dirty ? 'Zapisz awatar' : 'Zapisano'}</button>
      </div>
    </header>
    <div className="avatar-layout">
      <section className="avatar-preview" aria-label="Podgląd awatara">
        <div className="avatar-preview-heading"><h2>Podgląd</h2><span>{OUTFITS.find(outfit => outfit.id === avatar.outfit)?.name}</span></div>
        <div className="avatar-stage">
          {atlas && active.id === 'front' && atlas.front ? <img className="avatar-front" src={atlas.front} alt="Awatar, widok z przodu" data-reduced-motion={reducedMotion} />
            : atlas ? <AvatarSprite key={active.id} atlas={atlas.atlas} atlasHeight={fighter.atlasHeight} frames={active.frames(fighter)} loop={active.loop} frameTime={active.frameTime} reducedMotion={reducedMotion} label={`Awatar, animacja: ${active.label}`} />
            : <p role="status">Przygotowuję postać…</p>}
        </div>
        <div className="avatar-animations" role="group" aria-label="Animacja podglądu">
          {PREVIEWS.map(item => <button key={item.id} type="button" aria-pressed={item.id === active.id} onClick={() => setPreview(item.id)}>{item.label}</button>)}
        </div>
        <p className="avatar-note" role="status" aria-live="polite" data-state={status === 'error' || accountState === 'error' ? 'error' : status}>{note}</p>
      </section>
      <section className="avatar-controls" aria-label="Personalizacja awatara">
        <fieldset className="avatar-form" disabled={accountState === 'loading'} aria-busy={accountState === 'loading'}>
        <div className="avatar-section">
        <h2>Ubiór</h2>
        <fieldset><legend>Sylwetka</legend><div className="avatar-outfits">
          {OUTFITS.map(outfit => <label key={outfit.id} data-selected={avatar.outfit === outfit.id}>
            <input type="radio" name="avatar-outfit" value={outfit.id} checked={avatar.outfit === outfit.id} onChange={() => setAvatar(current => ({ ...current, outfit: outfit.id }))} />
            <span className="avatar-choice-mark" aria-hidden="true">{avatar.outfit === outfit.id && <Check size={14} />}</span>
            <strong>{outfit.name}</strong><small>{outfit.description}</small>
          </label>)}
        </div></fieldset>
        </div>
        <div className="avatar-section">
        <h2>Głowa</h2>
        <div className="avatar-head-options">
        {([['hair', 'Fryzura', HAIR_STYLES, HAIR_NAMES], ['hat', 'Czapka', HAT_STYLES, HAT_NAMES]] as const).map(([key, legend, options, names]) => <fieldset key={key}><legend>{legend}</legend><div className="avatar-styles">
          {options.map(option => <label key={option} data-selected={avatar[key] === option}>
            <input type="radio" name={`avatar-${key}-style`} value={option} checked={avatar[key] === option} onChange={() => setAvatar(current => ({ ...current, [key]: option }))} />{(names as Record<string, string>)[option]}
          </label>)}
        </div>
          {key === 'hair' && avatar.hat !== 'brak' && avatar.hair !== 'brak' && <p className="avatar-hint">Pod czapką fryzura jest schowana. Zdejmij czapkę, żeby ją zobaczyć.</p>}</fieldset>)}
        </div>
        </div>
        <div className="avatar-section">
        <h2>Kolory</h2>
        <div className="avatar-colors">
        {COLOR_GROUPS.map(group => <fieldset key={group.key}><legend><span>{group.legend}</span><span className="avatar-color-name">{NAMES[avatar.colors[group.key]]}</span></legend><div className="avatar-swatches">
          {Object.entries(group.options).map(([id, ramp]) => <label key={id} data-selected={avatar.colors[group.key] === id} title={NAMES[id]}>
            <input type="radio" name={`avatar-${group.key}`} value={id} checked={avatar.colors[group.key] === id} onChange={() => setColor(group.key, id)} aria-label={`${group.legend}: ${NAMES[id]}`} />
            <span style={{ backgroundColor: ramp[2] }} aria-hidden="true">{avatar.colors[group.key] === id && <Check size={14} style={{ color: ['bialy', 'blond', 'siwe', 'jasna', 'porcelanowa', 'piaskowy'].includes(id) ? '#111827' : '#ffffff' }} />}</span>
          </label>)}
        </div></fieldset>)}
        </div>
        </div>
        <div className="avatar-section">
        <h2>Ikona profilu</h2>
        <fieldset><legend>Poza na ikonie</legend><div className="avatar-poses">
          {AVATAR_POSES.map(pose => <label key={pose} data-selected={avatar.pose === pose}>
            <input type="radio" name="avatar-pose" value={pose} checked={avatar.pose === pose} onChange={() => setAvatar(current => ({ ...current, pose }))} />
            <PosePortrait avatar={{ ...avatar, pose }} />
            <span>{POSE_NAMES[pose]}</span>
          </label>)}
        </div>
        <p className="avatar-hint">Ikona pojawia się w profilu, nawigacji, rankingu, u znajomych i w Arenie. Animacje w podglądzie jej nie zmieniają.</p></fieldset>
        </div>
        </fieldset>
      </section>
    </div>
  </div>;
}
