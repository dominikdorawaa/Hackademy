import { AvatarSprite } from '../avatar/AvatarSprite';
import { AVATAR_ATLASES } from '../avatar/fighters';
import { useAvatarAtlas } from '../avatar/useAvatarAtlas';
import type { Avatar } from '../avatar/avatarModel';

export function BattleFighter({ look, frames, loop, reducedMotion, label, side, motionKey }: {
  look: Avatar; frames: number[]; loop: boolean; reducedMotion: boolean; label: string; side: 'me' | 'rival'; motionKey: string;
}) {
  const atlas = useAvatarAtlas(look);
  return (
    <div className={`battle-fighter is-${side}`} data-frames={frames.join(',')}>
      {atlas ? (
        <AvatarSprite key={motionKey} atlas={atlas.atlas} atlasHeight={AVATAR_ATLASES[look.outfit].atlasHeight}
          frames={frames} loop={loop} frameTime={90} reducedMotion={reducedMotion} label={label} />
      ) : <span className="battle-fighter-loading" role="img" aria-label={label} />}
    </div>
  );
}
