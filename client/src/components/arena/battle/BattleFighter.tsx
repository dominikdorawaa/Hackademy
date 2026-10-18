import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { AvatarSprite } from '../avatar/AvatarSprite';
import { AVATAR_ATLASES } from '../avatar/fighters';
import type { AvatarAtlas } from '../avatar/useAvatarAtlas';
import type { Avatar } from '../avatar/avatarModel';
import type { Finisher, Segment } from './battleView';

function useSegment(segments: Segment[], motionKey: string, reducedMotion: boolean) {
  const [progress, setProgress] = useState({ key: motionKey, index: 0 });
  const index = reducedMotion ? segments.length - 1 : progress.key === motionKey ? Math.min(progress.index, segments.length - 1) : 0;
  const plan = JSON.stringify(segments);
  useEffect(() => {
    if (reducedMotion) return;
    let elapsed = 0;
    const timers = (JSON.parse(plan) as Segment[]).flatMap((segment, nextIndex) => {
      if (segment.ms === undefined) return [];
      elapsed += segment.ms;
      return [setTimeout(() => setProgress({ key: motionKey, index: nextIndex + 1 }), elapsed)];
    });
    return () => timers.forEach(clearTimeout);
  }, [motionKey, plan, reducedMotion]);
  return { segment: segments[index], index };
}

export function BattleFighter({ look, atlas, segments, reducedMotion, label, side, motionKey, finishedBy = null }: {
  look: Avatar; atlas: AvatarAtlas; segments: Segment[]; reducedMotion: boolean; label: string; side: 'me' | 'rival'; motionKey: string; finishedBy?: Finisher | null;
}) {
  const { segment, index } = useSegment(segments, motionKey, reducedMotion);
  const idle = segment.loop && segment.frames.length === 1;
  return (
    <div className={`battle-fighter is-${side}`} data-idle={idle} data-frames={segment.frames.join(',')} data-finished-by={finishedBy?.move}
      style={finishedBy ? { '--finish-impact': `${finishedBy.impact}ms` } as CSSProperties : undefined}>
      <AvatarSprite key={`${motionKey}-${index}`} atlas={atlas.atlas} atlasHeight={AVATAR_ATLASES[look.outfit].atlasHeight}
          frames={segment.frames} loop={segment.loop} frameTime={segment.frameTime} reducedMotion={reducedMotion} label={label} />
    </div>
  );
}
