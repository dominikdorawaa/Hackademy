import { LoadingSkeleton, Skeleton } from './common/Skeleton';

/** Placeholder for the friends list on the dashboard and in the Arena, shaped like `.ud-friend` rows. */
export function FriendRowsSkeleton({ rows = 3 }: { rows?: number }) {
  return <LoadingSkeleton label="Wczytuję znajomych" className="ud-friend-list">
    {Array.from({ length: rows }, (_, index) => <span key={index} className="ud-friend" aria-hidden="true">
      <Skeleton width={40} height={40} radius="50%" />
      <span className="ud-friend-who"><Skeleton width="60%" height={16} /><Skeleton width="40%" height={12} style={{ marginTop: 6 }} /></span>
      <Skeleton width={72} height={32} />
    </span>)}
  </LoadingSkeleton>;
}
