import type { CSSProperties, ReactNode } from 'react';
import './Skeleton.css';

type Length = number | string;

/** One decorative placeholder block. Spans keep it valid inside inline parents. */
export function Skeleton({ width, height, radius, className, style }: {
  width?: Length; height?: Length; radius?: Length; className?: string; style?: CSSProperties;
}) {
  return <span aria-hidden="true" data-skeleton="" className={className ? `hk-skeleton ${className}` : 'hk-skeleton'}
    style={{ width, height, borderRadius: radius, ...style }} />;
}

/** A few lines of placeholder text, the last one shorter like a real paragraph end. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return <span aria-hidden="true" className={className ? `hk-skeleton-text ${className}` : 'hk-skeleton-text'}>
    {Array.from({ length: lines }, (_, index) => <Skeleton key={index} width={index === lines - 1 && lines > 1 ? '60%' : '100%'} />)}
  </span>;
}

/**
 * Announces a loading region to screen readers and holds the placeholder shapes.
 * The shapes are hidden from assistive technology; only the label is read.
 */
export function LoadingSkeleton({ label, as: Tag = 'div', className, children }: {
  label: string; as?: 'div' | 'span'; className?: string; children: ReactNode;
}) {
  return <Tag role="status" aria-busy="true" aria-label={label} className={className ? `hk-skeleton-group ${className}` : 'hk-skeleton-group'}>
    <span className="sr-only">{label}</span>
    {children}
  </Tag>;
}
