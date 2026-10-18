import { danceFrames } from '../avatar/fighters';
import type { SpriteSheet } from '../../PixelSprite';
import type { ArenaReaction, GameSession } from '../../../types/api';

export type ReactionKind = 'emote' | 'animation';

export interface QuickReaction { id: string; kind: ReactionKind; text: string; name: string; sprite?: SpriteSheet; frames?: number[] }

export const REACTION_GROUPS: { kind: ReactionKind; label: string }[] = [
  { kind: 'emote', label: 'Emotki' },
  { kind: 'animation', label: 'Tańce' },
];

const EMOTES = '/assets/arena/emotes/';
export const EMOTE_SPRITES = {
  ez: { src: `${EMOTES}ez.png`, frames: 8, width: 38, height: 29 },
  gg: { src: `${EMOTES}gg.png`, frames: 8, width: 36, height: 26 },
  laugh: { src: `${EMOTES}laugh.png`, frames: 8, width: 44, height: 44 },
  shock: { src: `${EMOTES}shock.png`, frames: 7, width: 42, height: 44 },
} satisfies Record<string, SpriteSheet>;

export const QUICK_REACTIONS: QuickReaction[] = [
  { id: 'ez', kind: 'emote', text: 'EZ', name: 'EZ', sprite: EMOTE_SPRITES.ez },
  { id: 'gg', kind: 'emote', text: 'GG', name: 'GG', sprite: EMOTE_SPRITES.gg },
  { id: 'laugh', kind: 'emote', text: 'Śmiech', name: 'Śmiech', sprite: EMOTE_SPRITES.laugh },
  { id: 'shock', kind: 'emote', text: 'Szok', name: 'Szok', sprite: EMOTE_SPRITES.shock },
  { id: '67', kind: 'animation', text: '67', name: 'Six-seven', frames: danceFrames(8) },
  { id: 'groove', kind: 'animation', text: 'Luz', name: 'Taniec Luz', frames: danceFrames(6) },
];

export const REACTION_MS = 3000;
export const REACTION_FRAME_MS = 110;
export const REACTION_SLACK_MS = 500;

export interface ShownReaction { key: number; reaction: QuickReaction; age: number }

export function findReaction(id: string) {
  return QUICK_REACTIONS.find(reaction => reaction.id === id) ?? null;
}

export function shownReaction(session: GameSession, senderId: number, serverNow: number): ShownReaction | null {
  const latest = (session.reactions ?? []).reduce<ArenaReaction | null>((found, item) => item.senderId === senderId && (!found || item.id > found.id) ? item : found, null);
  if (!latest) return null;
  const reaction = findReaction(latest.reaction);
  const age = serverNow - latest.sentAt;
  if (!reaction || age < 0 || age >= REACTION_MS) return null;
  return { key: latest.id, reaction, age };
}

export function reactionDance(shown: ShownReaction | null) {
  const frames = shown?.reaction.frames;
  if (!shown || !frames || shown.age >= frames.length * REACTION_FRAME_MS + REACTION_SLACK_MS) return null;
  return { key: shown.key, frames };
}

const PERMANENT_MUTE_MS = 50 * 365 * 24 * 60 * 60 * 1000;
export function reactionRefusal(status: number, body: { mutedUntil?: string; retryAfter?: number } | null, now = Date.now()) {
  if (status === 403 && body?.mutedUntil) {
    const until = new Date(body.mutedUntil);
    if (Number.isNaN(until.getTime())) return 'Masz wyciszone reakcje.';
    if (until.getTime() - now > PERMANENT_MUTE_MS) return 'Masz wyciszone reakcje na stałe.';
    return `Masz wyciszone reakcje do ${until.toLocaleString('pl-PL', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}.`;
  }
  if (status === 429) return `Za szybko. Kolejna reakcja za ${Math.max(1, body?.retryAfter ?? 1)} s.`;
  if (status === 404) return 'Ta walka nie jest już dostępna.';
  return 'Nie udało się wysłać reakcji.';
}
