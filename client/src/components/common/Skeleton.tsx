import type { CSSProperties, ReactNode } from 'react';
import './Skeleton.css';

type Length = number | string;
export type SkeletonTone = 'surface' | 'raised' | 'wash';

export function Skeleton({ width, height, radius, tone = 'surface', className, style }: {
  width?: Length; height?: Length; radius?: Length; tone?: SkeletonTone; className?: string; style?: CSSProperties;
}) {
  return <span aria-hidden="true" data-skeleton="" data-tone={tone} className={className ? `hk-skeleton ${className}` : 'hk-skeleton'}
    style={{ width, height, borderRadius: radius, ...style }} />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return <span aria-hidden="true" className={className ? `hk-skeleton-text ${className}` : 'hk-skeleton-text'}>
    {Array.from({ length: lines }, (_, index) => <Skeleton key={index} width={index === lines - 1 && lines > 1 ? '60%' : '100%'} />)}
  </span>;
}

export function LoadingSkeleton({ label, as: Tag = 'div', className, children }: {
  label: string; as?: 'div' | 'span'; className?: string; children: ReactNode;
}) {
  return <Tag role="status" aria-label={label} className={className ? `hk-skeleton-group ${className}` : 'hk-skeleton-group'}>
    <span className="sr-only">{label}</span>
    {children}
  </Tag>;
}
