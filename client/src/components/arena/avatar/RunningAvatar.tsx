import { AvatarSprite } from './AvatarSprite';
import { AVATAR_ATLASES, RUN_FRAME_TIME, runFrames } from './fighters';
import { DEFAULT_AVATAR, fromAvatarConfig } from './avatarModel';
import { useAvatarAtlas } from './useAvatarAtlas';
import type { AvatarConfig } from '../../../types/api';

export function RunningAvatar({ avatar, reducedMotion = false, label = 'Biegnąca postać' }: { avatar?: AvatarConfig | null; reducedMotion?: boolean; label?: string }) {
  const look = fromAvatarConfig(avatar) ?? DEFAULT_AVATAR;
  const atlas = useAvatarAtlas(look);
  const source = AVATAR_ATLASES[look.outfit];
  return <AvatarSprite atlas={atlas?.atlas ?? source.atlas} atlasHeight={source.atlasHeight} frames={runFrames(source.run)}
    frameTime={RUN_FRAME_TIME} reducedMotion={reducedMotion} label={label} />;
}
