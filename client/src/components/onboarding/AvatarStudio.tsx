import { useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Check } from 'lucide-react';
import { AvatarSprite } from '../arena/avatar/AvatarSprite';
import { useAvatarAtlas, useAvatarPortrait } from '../arena/avatar/useAvatarAtlas';
import { AVATAR_POSES, HAIR_STYLES, HAT_STYLES, toAvatarConfig } from '../arena/avatar/avatarModel';
import type { Avatar } from '../arena/avatar/avatarModel';
import { AVATAR_ATLASES } from '../arena/avatar/fighters';
import { COLOR_GROUPS, COLOR_NAMES, HAIR_NAMES, HAT_NAMES, LIGHT_COLORS, OUTFITS, POSE_NAMES } from '../arena/avatar/avatarOptions';
import { ArenaLoader } from '../arena/ArenaLoader';

export type StudioTab = 'outfit' | 'head' | 'colors' | 'icon';
const TABS: { id: StudioTab; label: string }[] = [
  { id: 'outfit', label: 'Strój' },
  { id: 'head', label: 'Fryzura i czapka' },
  { id: 'colors', label: 'Kolory' },
  { id: 'icon', label: 'Ikona profilu' },
];
type View = 'front' | 'fight' | 'icon';
const VIEWS: { id: View; label: string }[] = [
  { id: 'front', label: 'Przód' },
  { id: 'fight', label: 'W walce' },
  { id: 'icon', label: 'Ikona' },
];
const ATTACK = Array.from({ length: 8 }, (_, column) => 9 + column + 1);

function Portrait({ avatar, className }: { avatar: Avatar; className: string }) {
  const portrait = useAvatarPortrait(toAvatarConfig(avatar));
  return portrait ? <img className={className} src={portrait} alt="" /> : <span className={className} aria-hidden="true" />;
}

export function AvatarStudio({ avatar, onChange, reducedMotion, tab, onTab, disabled = false, aside }: {
  avatar: Avatar; onChange: (avatar: Avatar) => void; reducedMotion: boolean; tab: StudioTab; onTab: (tab: StudioTab) => void; disabled?: boolean; aside?: ReactNode;
}) {
  const [view, setView] = useState<View>('front');
  const atlas = useAvatarAtlas(avatar);
  const id = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const set = (patch: Partial<Avatar>) => onChange({ ...avatar, ...patch });
  const setColor = (key: keyof Avatar['colors'], value: string) => onChange({ ...avatar, colors: { ...avatar.colors, [key]: value } });
  const moveTab = (event: KeyboardEvent, index: number) => {
    const next = event.key === 'ArrowRight' ? index + 1 : event.key === 'ArrowLeft' ? index - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    const target = (next + TABS.length) % TABS.length;
    onTab(TABS[target].id);
    tabs.current[target]?.focus();
  };

  return <div className="studio">
    <div className="studio-side">
    <section className="studio-stage-card" aria-label="Podgląd awatara">
      <div className="studio-views" role="group" aria-label="Widok podglądu">
        {VIEWS.map(item => <button key={item.id} type="button" aria-pressed={view === item.id} onClick={() => setView(item.id)}>{item.label}</button>)}
      </div>
      <div className="studio-stage" data-view={view}>
        {!atlas ? <ArenaLoader label="Przygotowuję postać" avatar={toAvatarConfig(avatar)} className="studio-loader" />
          : view === 'front' && atlas.front ? <img className="studio-front" src={atlas.front} alt="Twój awatar, widok z przodu" />
          : view === 'icon' ? <span className="studio-icon-frame"><Portrait avatar={avatar} className="studio-icon" /><span className="sr-only">Ikona profilu, poza: {POSE_NAMES[avatar.pose]}</span></span>
          : <AvatarSprite key={avatar.outfit} atlas={atlas.atlas} atlasHeight={AVATAR_ATLASES[avatar.outfit].atlasHeight}
            frames={[0, 0, 0, 0, 0, 0, ...ATTACK]} frameTime={110} reducedMotion={reducedMotion} label="Twój awatar w walce" />}
      </div>
      <p className="studio-caption">{OUTFITS.find(outfit => outfit.id === avatar.outfit)?.name} · {HAIR_NAMES[avatar.hair]}{avatar.hat !== 'brak' ? ` · ${HAT_NAMES[avatar.hat]}` : ''}</p>
    </section>
    {aside}
    </div>

    <section className="studio-panel" aria-label="Wybór wyglądu">
      <div className="studio-tabs" role="tablist" aria-label="Kategorie">
        {TABS.map((item, index) => <button key={item.id} ref={element => { tabs.current[index] = element; }} type="button" role="tab" id={`${id}-tab-${item.id}`}
          aria-selected={tab === item.id} aria-controls={`${id}-panel`} tabIndex={tab === item.id ? 0 : -1}
          onClick={() => onTab(item.id)} onKeyDown={event => moveTab(event, index)}>{item.label}</button>)}
      </div>
      <fieldset className="studio-options" id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${tab}`} disabled={disabled}>
        {tab === 'outfit' && <div className="studio-cards" role="radiogroup" aria-label="Strój">
          {OUTFITS.map(outfit => <label key={outfit.id} className="studio-card" data-selected={avatar.outfit === outfit.id}>
            <input type="radio" name={`${id}-outfit`} checked={avatar.outfit === outfit.id} onChange={() => set({ outfit: outfit.id })} />
            <Portrait avatar={{ ...avatar, outfit: outfit.id, pose: 'przod' }} className="studio-card-portrait" />
            <span className="studio-card-text"><strong>{outfit.name}</strong><small>{outfit.description}</small></span>
            {avatar.outfit === outfit.id && <Check className="studio-card-check" size={18} aria-hidden="true" />}
          </label>)}
        </div>}

        {tab === 'head' && <div className="studio-head">
          {([['hair', 'Fryzura', HAIR_STYLES, HAIR_NAMES], ['hat', 'Czapka', HAT_STYLES, HAT_NAMES]] as const).map(([key, legend, options, names]) => <div key={key} className="studio-group">
            <h3 id={`${id}-${key}`}>{legend}</h3>
            <div className="studio-cards is-compact" role="radiogroup" aria-labelledby={`${id}-${key}`}>
              {options.map(option => <label key={option} className="studio-card" data-selected={avatar[key] === option}>
                <input type="radio" name={`${id}-${key}`} checked={avatar[key] === option} onChange={() => set({ [key]: option } as Partial<Avatar>)} />
                <Portrait avatar={{ ...avatar, [key]: option, ...(key === 'hair' ? { hat: 'brak' } : {}), pose: 'przod' } as Avatar} className="studio-card-portrait" />
                <span className="studio-card-text"><strong>{(names as Record<string, string>)[option]}</strong></span>
              </label>)}
            </div>
          </div>)}
          {avatar.hat !== 'brak' && avatar.hair !== 'brak' && <p className="studio-hint">Pod czapką fryzura jest schowana. Zdejmij czapkę, żeby ją zobaczyć.</p>}
        </div>}

        {tab === 'colors' && <div className="studio-colors">
          {COLOR_GROUPS.filter(group => group.key !== 'hat' || avatar.hat !== 'brak').map(group => <div key={group.key} className="studio-group">
            <h3 id={`${id}-color-${group.key}`}>{group.legend} <span>{COLOR_NAMES[avatar.colors[group.key]]}</span></h3>
            <div className="studio-swatches" role="radiogroup" aria-labelledby={`${id}-color-${group.key}`}>
              {Object.entries(group.options).map(([color, ramp]) => <label key={color} className="studio-swatch" data-selected={avatar.colors[group.key] === color} title={COLOR_NAMES[color]}>
                <input type="radio" name={`${id}-${group.key}`} checked={avatar.colors[group.key] === color} onChange={() => setColor(group.key, color)} aria-label={`${group.legend}: ${COLOR_NAMES[color]}`} />
                <span style={{ background: `linear-gradient(135deg, ${ramp[3]} 0 45%, ${ramp[1]} 45% 100%)` }} aria-hidden="true">
                  {avatar.colors[group.key] === color && <Check size={16} style={{ color: LIGHT_COLORS.includes(color) ? '#111827' : '#ffffff' }} />}
                </span>
              </label>)}
            </div>
          </div>)}
        </div>}

        {tab === 'icon' && <div className="studio-group">
          <h3 id={`${id}-pose`}>Poza na ikonie profilu</h3>
          <div className="studio-poses" role="radiogroup" aria-labelledby={`${id}-pose`}>
            {AVATAR_POSES.map(pose => <label key={pose} className="studio-pose" data-selected={avatar.pose === pose}>
              <input type="radio" name={`${id}-pose`} checked={avatar.pose === pose} onChange={() => set({ pose })} />
              <Portrait avatar={{ ...avatar, pose }} className="studio-pose-portrait" />
              <span>{POSE_NAMES[pose]}</span>
            </label>)}
          </div>
          <p className="studio-hint">Tę ikonę zobaczą inni w rankingu, u znajomych, w powiadomieniach i w Arenie.</p>
        </div>}
      </fieldset>
    </section>
  </div>;
}
