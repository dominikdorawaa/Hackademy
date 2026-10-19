import { useMemo } from 'react';
import type { ImgHTMLAttributes } from 'react';
import { useAvatarPortrait } from './arena/avatar/useAvatarAtlas';
import { avatarFromUsername, fromAvatarConfig, toAvatarConfig } from './arena/avatar/avatarModel';
import type { AvatarConfig } from '../types/api';

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { username: string; avatar?: AvatarConfig | null };

const placeholder = (username: string) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" rx="12" fill="#283d59"/><text x="40" y="48" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#e6eef9">${username.slice(0, 2).toUpperCase().replace(/[<>&"']/g, '')}</text></svg>`)}`;

export default function UserAvatar({ username, avatar, alt, style, ...props }: Props) {
  const custom = fromAvatarConfig(avatar) !== null;
  const config = useMemo(() => custom ? avatar! : toAvatarConfig(avatarFromUsername(username)), [custom, avatar, username]);
  const portrait = useAvatarPortrait(config);
  return <img {...props} style={{ ...style, imageRendering: 'pixelated' }} src={portrait ?? placeholder(username)} alt={alt ?? `Avatar ${username}`}
    data-avatar={portrait ? (custom ? 'custom' : 'generated') : 'loading'} />;
}
