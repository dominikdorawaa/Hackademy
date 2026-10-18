import { danceFrames } from '../avatar/fighters';
import type { ArenaReaction, GameSession } from '../../../types/api';

export type ReactionKind = 'phrase' | 'emoji' | 'animation';

export interface QuickReaction { id: string; kind: ReactionKind; text: string; name: string; frames?: number[] }

export const REACTION_GROUPS: { kind: ReactionKind; label: string }[] = [
  { kind: 'phrase', label: 'Frazy' },
  { kind: 'emoji', label: 'Emotki' },
  { kind: 'animation', label: 'Animacje' },
];

export const QUICK_REACTIONS: QuickReaction[] = [
  { id: 'ez', kind: 'phrase', text: 'EZ', name: 'EZ' },
  { id: 'gg', kind: 'phrase', text: 'GG', name: 'GG' },
  { id: 'nice', kind: 'phrase', text: 'Nice!', name: 'Nice!' },
  { id: 'oops', kind: 'phrase', text: 'Ups', name: 'Ups' },
  { id: 'close', kind: 'phrase', text: 'Było blisko', name: 'Było blisko' },
  { id: 'fire', kind: 'emoji', text: '🔥', name: 'Ogień' },
  { id: 'laugh', kind: 'emoji', text: '😂', name: 'Śmiech' },
  { id: 'shock', kind: 'emoji', text: '😱', name: 'Szok' },
  { id: 'clap', kind: 'emoji', text: '👏', name: 'Brawa' },
  { id: 'cool', kind: 'emoji', text: '😎', name: 'Luzik' },
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
