import { useState } from 'react';
import type { ImgHTMLAttributes } from 'react';

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { username: string; seed?: string | null };

export default function UserAvatar({ username, seed, alt, ...props }: Props) {
  const src = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(seed || username)}`;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const initials = username.slice(0, 2).toUpperCase();
  const fallback = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" rx="12" fill="#283d59"/><text x="40" y="48" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#e6eef9">${initials.replace(/[<>&"']/g, '')}</text></svg>`)}`;
  return <img {...props} src={failedSrc === src ? fallback : src} alt={alt ?? `Avatar ${username}`}
    onError={() => setFailedSrc(src)} />;
}
