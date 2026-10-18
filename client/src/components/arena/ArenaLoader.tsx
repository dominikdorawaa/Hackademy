import { useState } from 'react';
import { RunningAvatar } from './avatar/RunningAvatar';
import { fromAvatarConfig, readAvatar, toAvatarConfig } from './avatar/avatarModel';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type { AvatarConfig } from '../../types/api';
import './ArenaLoader.css';

export function ArenaRunner({ avatar, className }: { avatar?: AvatarConfig | null; className?: string }) {
  const reducedMotion = useReducedMotion();
  const [saved] = useState(() => toAvatarConfig(readAvatar()));
  const look = fromAvatarConfig(avatar) ? avatar : saved;
  return <span className={className ? `arena-runner ${className}` : 'arena-runner'} aria-hidden="true"
    data-still={reducedMotion}>
    <RunningAvatar avatar={look} reducedMotion={reducedMotion} />
    <span className="arena-runner-ground" />
  </span>;
}

export function ArenaLoader({ label, avatar, className }: { label: string; avatar?: AvatarConfig | null; className?: string }) {
  return <div role="status" aria-label={label} className={className ? `arena-loader ${className}` : 'arena-loader'}>
    <ArenaRunner avatar={avatar} />
    <span className="sr-only">{label}</span>
  </div>;
}
