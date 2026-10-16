import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getCurrentUser, saveAvatar as saveAccountAvatar } from '../services/userApi';
import { PROFILE_UPDATED } from '../lib/profile';
import { Button } from '../components/ui/button';
import { AvatarSprite } from '../components/arena/avatar/AvatarSprite';
import { useAvatarAtlas } from '../components/arena/avatar/useAvatarAtlas';
import { CLOTH_RAMPS, fromAvatarConfig, HAIR_RAMPS, HAIR_STYLES, HAT_STYLES, readAvatar, saveAvatar, SKIN_RAMPS, toAvatarConfig } from '../components/arena/avatar/avatarModel';
import type { Avatar, Ramp } from '../components/arena/avatar/avatarModel';
import { AVATAR_ATLASES, danceFrames } from '../components/arena/avatar/fighters';
import type { AvatarAtlasSource } from '../components/arena/avatar/fighters';
import './ArenaAvatarPage.css';

const OUTFITS: { id: Avatar['outfit']; name: string; description: string }[] = [
  { id: 'baza', name: 'Klasyczna', description: 'Koszulka i proste spodnie.' },
  { id: 'bluza', name: 'Bluza', description: 'Bluza z opuszczonym kapturem, jeansy i trampki.' },
  { id: 'dres', name: 'Dres', description: 'Kurtka dresowa z paskami i spodnie z lampasem.' },
];
const row = (index: number, count = 8) => Array.from({ length: count }, (_, column) => index * 9 + column + 1);
const PREVIEWS: { id: string; label: string; frames: (dances: AvatarAtlasSource['dances']) => number[]; loop: boolean }[] = [
  { id: 'front', label: 'Przód', frames: () => [0], loop: true },
  { id: 'idle', label: 'Postawa', frames: () => [0], loop: true },
  { id: 'attack', label: 'Atak', frames: () => [...row(1), ...row(2), ...row(3)], loop: true },
  { id: 'hurt', label: 'Trafienie', frames: () => [...row(4, 4), 0, 0, 0], loop: true },
  { id: 'defeat', label: 'Upadek', frames: () => row(5), loop: false },
  { id: 'groove', label: 'Taniec', frames: dances => danceFrames(dances.groove), loop: true },
  { id: 'sixseven', label: 'Six-seven', frames: dances => danceFrames(dances.sixseven), loop: true },
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

export default function ArenaAvatarPage() {
  const { reducedMotion } = useTheme();
  const [avatar, setAvatar] = useState<Avatar>(readAvatar);
  const [saved, setSaved] = useState(() => JSON.stringify(readAvatar()));
  const [preview, setPreview] = useState('front');
  const atlas = useAvatarAtlas(avatar);
  const fighter = AVATAR_ATLASES[avatar.outfit];
  const active = PREVIEWS.find(item => item.id === preview) ?? PREVIEWS[0];
  const dirty = saved !== JSON.stringify(avatar);
  const setColor = (key: keyof Avatar['colors'], value: string) => setAvatar(current => ({ ...current, colors: { ...current.colors, [key]: value } }));
  const { isAuthenticated, token } = useAuth();
  const [account, setAccount] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  useEffect(() => {
    if (!isAuthenticated || !token) return;
    const controller = new AbortController();
    getCurrentUser({ Authorization: `Bearer ${token}` }, controller.signal)
      .then(response => response.ok ? response.json() : null)
      .then(user => {
        if (!user?.username) return;
        setAccount(user.username);
        const remote = fromAvatarConfig(user.avatar);
        if (remote) { setAvatar(remote); setSaved(JSON.stringify(remote)); }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [isAuthenticated, token]);
  const signedIn = Boolean(isAuthenticated && token && account);
  const save = async () => {
    saveAvatar(avatar);
    if (signedIn) {
      setStatus('saving');
      try {
        const config = toAvatarConfig(avatar);
        const response = await saveAccountAvatar(config, { Authorization: `Bearer ${token}` });
        if (!response.ok) throw new Error('save failed');
        window.dispatchEvent(new CustomEvent(PROFILE_UPDATED, { detail: { username: account, avatar: config } }));
      } catch {
        setStatus('error');
        return;
      }
    }
    setSaved(JSON.stringify(avatar));
    setStatus('idle');
  };
  const note = status === 'error' ? 'Nie udało się zapisać awatara na koncie. Spróbuj ponownie.'
    : dirty ? 'Masz niezapisane zmiany.'
    : signedIn ? 'Awatar jest zapisany na Twoim koncie i widoczny w profilu, rankingu i u znajomych.'
    : 'Awatar jest zapisany w tej przeglądarce. Zaloguj się, żeby zapisać go na koncie.';
  return <div className="avatar-page">
    <header className="avatar-heading"><div><Link to="/arena">Arena</Link><h1>Twój awatar</h1></div></header>
    <div className="avatar-layout">
      <section className="avatar-preview" aria-label="Podgląd awatara">
        <div className="avatar-stage">
          {atlas && active.id === 'front' && atlas.front ? <img className="avatar-front" src={atlas.front} alt="Awatar, widok z przodu" data-reduced-motion={reducedMotion} />
            : atlas ? <AvatarSprite key={active.id} atlas={atlas.atlas} atlasHeight={fighter.atlasHeight} frames={active.frames(fighter.dances)} loop={active.loop} reducedMotion={reducedMotion} label={`Awatar, animacja: ${active.label}`} />
            : <p role="status">Przygotowuję postać…</p>}
        </div>
        <div className="avatar-animations" role="group" aria-label="Animacja podglądu">
          {PREVIEWS.map(item => <button key={item.id} type="button" aria-pressed={item.id === active.id} onClick={() => setPreview(item.id)}>{item.label}</button>)}
        </div>
      </section>
      <div className="avatar-controls">
        <fieldset><legend>Sylwetka</legend><div className="avatar-outfits">
          {OUTFITS.map(outfit => <label key={outfit.id} data-selected={avatar.outfit === outfit.id}>
            <input type="radio" name="avatar-outfit" value={outfit.id} checked={avatar.outfit === outfit.id} onChange={() => setAvatar(current => ({ ...current, outfit: outfit.id }))} />
            <strong>{outfit.name}</strong><small>{outfit.description}</small>
          </label>)}
        </div></fieldset>
        {([['hair', 'Fryzura', HAIR_STYLES, HAIR_NAMES], ['hat', 'Czapka', HAT_STYLES, HAT_NAMES]] as const).map(([key, legend, options, names]) => <fieldset key={key}><legend>{legend}</legend><div className="avatar-styles">
          {options.map(option => <label key={option} data-selected={avatar[key] === option}>
            <input type="radio" name={`avatar-${key}-style`} value={option} checked={avatar[key] === option} onChange={() => setAvatar(current => ({ ...current, [key]: option }))} />{(names as Record<string, string>)[option]}
          </label>)}
        </div>
          {key === 'hair' && avatar.hat !== 'brak' && avatar.hair !== 'brak' && <p className="avatar-hint">Pod czapką fryzura jest schowana. Zdejmij czapkę, żeby ją zobaczyć.</p>}</fieldset>)}
        {COLOR_GROUPS.map(group => <fieldset key={group.key}><legend>{group.legend}</legend><div className="avatar-swatches">
          {Object.entries(group.options).map(([id, ramp]) => <label key={id} data-selected={avatar.colors[group.key] === id} title={NAMES[id]}>
            <input type="radio" name={`avatar-${group.key}`} value={id} checked={avatar.colors[group.key] === id} onChange={() => setColor(group.key, id)} aria-label={`${group.legend}: ${NAMES[id]}`} />
            <span style={{ background: `linear-gradient(135deg, ${ramp[3]} 0 50%, ${ramp[1]} 50%)` }} aria-hidden="true" />
          </label>)}
        </div></fieldset>)}
        <div className="avatar-actions">
          <Button onClick={save} disabled={!dirty || status === 'saving'}>{status === 'saving' ? 'Zapisuję…' : dirty ? 'Zapisz awatar' : 'Zapisano'}</Button>
        </div>
        <p className="avatar-note" role="status" aria-live="polite" data-state={status}>{note}</p>
      </div>
    </div>
  </div>;
}
