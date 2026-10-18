import { useState } from 'react';
import { RunningAvatar } from './avatar/RunningAvatar';
import { fromAvatarConfig, readAvatar, toAvatarConfig } from './avatar/avatarModel';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type { AvatarConfig } from '../../types/api';
import './ArenaLoader.css';

/**
 * Arena loading state: the player's own avatar running in place.
 * It never waits for the request it stands in for. Without a usable account avatar it uses
 * the one saved by the avatar creator in this browser, and without that the default character.
 */
export function ArenaLoader({ label, avatar, className }: { label: string; avatar?: AvatarConfig | null; className?: string }) {
  const reducedMotion = useReducedMotion();
  const [saved] = useState(() => toAvatarConfig(readAvatar()));
  const look = fromAvatarConfig(avatar) ? avatar : saved;
  return <div role="status" aria-busy="true" aria-label={label} className={className ? `arena-loader ${className}` : 'arena-loader'}
    data-still={reducedMotion}>
    <span className="arena-loader-runner" aria-hidden="true">
      <RunningAvatar avatar={look} reducedMotion={reducedMotion} />
      <span className="arena-loader-ground" />
    </span>
    <span className="sr-only">{label}</span>
  </div>;
}
