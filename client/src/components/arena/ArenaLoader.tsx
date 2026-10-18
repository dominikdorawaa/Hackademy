import { useState } from 'react';
import { RunningAvatar } from './avatar/RunningAvatar';
import { fromAvatarConfig, readAvatar, toAvatarConfig } from './avatar/avatarModel';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type { AvatarConfig } from '../../types/api';
import './ArenaLoader.css';

export function ArenaLoader({ label, avatar, className }: { label: string; avatar?: AvatarConfig | null; className?: string }) {
  const reducedMotion = useReducedMotion();
  const [saved] = useState(() => toAvatarConfig(readAvatar()));
  const look = fromAvatarConfig(avatar) ? avatar : saved;
  return <div role="status" aria-label={label} className={className ? `arena-loader ${className}` : 'arena-loader'}
    data-still={reducedMotion}>
    <span className="arena-loader-runner" aria-hidden="true">
      <RunningAvatar avatar={look} reducedMotion={reducedMotion} />
      <span className="arena-loader-ground" />
    </span>
    <span className="sr-only">{label}</span>
  </div>;
}
