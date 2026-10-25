import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { AvatarSprite } from '../avatar/AvatarSprite';
import { AVATAR_ATLASES } from '../avatar/fighters';
import type { AvatarAtlas } from '../avatar/useAvatarAtlas';
import type { Avatar } from '../avatar/avatarModel';
import { KNOCKBACK_MS } from './battleView';
import type { Finisher, Segment } from './battleView';
import { REACTION_FRAME_MS } from './quickChat';

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

export function BattleFighter({ look, atlas, segments, reducedMotion, label, side, motionKey, finishedBy = null, reaction = null }: {
  look: Avatar; atlas: AvatarAtlas; segments: Segment[]; reducedMotion: boolean; label: string; side: 'me' | 'rival'; motionKey: string; finishedBy?: Finisher | null;
  reaction?: { key: number; frames: number[] } | null;
}) {
  const { segment, index } = useSegment(segments, motionKey, reducedMotion);
  const idle = segment.loop && segment.frames.length === 1;
  const dance = reaction && idle && index === segments.length - 1 && !reducedMotion ? reaction : null;
  return (
    <div className={`battle-fighter is-${side}`} data-idle={idle && !dance} data-frames={(dance?.frames ?? segment.frames).join(',')} data-finished-by={finishedBy?.move}
      style={finishedBy ? { '--finish-impact': `${finishedBy.impact}ms`, '--knockback': `${KNOCKBACK_MS}ms` } as CSSProperties : undefined}>
      {dance ? <AvatarSprite key={`reaction-${dance.key}`} atlas={atlas.atlas} atlasHeight={AVATAR_ATLASES[look.outfit].atlasHeight}
          frames={dance.frames} loop={false} frameTime={REACTION_FRAME_MS} label={label} />
        : <AvatarSprite key={`${motionKey}-${index}`} atlas={atlas.atlas} atlasHeight={AVATAR_ATLASES[look.outfit].atlasHeight}
          frames={segment.frames} loop={segment.loop} frameTime={segment.frameTime} reducedMotion={reducedMotion} label={label} />}
    </div>
  );
}
