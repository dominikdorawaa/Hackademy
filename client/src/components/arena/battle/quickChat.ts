import { turnedDance } from '../avatar/fighters';
import type { VictoryDance } from '../avatar/avatarModel';
import type { SpriteSheet } from '../../PixelSprite';
import type { ArenaReaction, GameSession, ShopState } from '../../../types/api';
import { isLocked } from '../../../lib/bytes';

export type ReactionKind = 'emote' | 'text' | 'animation';

export interface QuickReaction { id: string; kind: ReactionKind; text: string; name: string; meaning?: string; sprite?: SpriteSheet; frames?: number[] }

export const REACTION_GROUPS: { kind: ReactionKind; label: string }[] = [
  { kind: 'emote', label: 'Emotki' },
  { kind: 'text', label: 'Teksty' },
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
  { id: 'glhf', kind: 'text', text: 'GL HF', name: 'GL HF', meaning: 'Good luck, have fun. Na start walki.' },
  { id: 'wp', kind: 'text', text: 'WP', name: 'WP', meaning: 'Well played. Gdy rywal zagrał świetnie.' },
  { id: 'nt', kind: 'text', text: 'NT', name: 'NT', meaning: 'Nice try. Gdy było naprawdę blisko.' },
  { id: 'rip', kind: 'text', text: 'RIP', name: 'RIP', meaning: 'Gdy ktoś poległ z hukiem.' },
  { id: '67', kind: 'animation', text: '67', name: 'Six-seven', frames: turnedDance('sixseven') },
  { id: 'groove', kind: 'animation', text: 'Luz', name: 'Taniec Luz', frames: turnedDance('groove') },
  { id: 'scuba', kind: 'animation', text: 'Scuba', name: 'Scuba', frames: turnedDance('scuba') },
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
  if (!reaction || age < 0 || age >= Math.max(REACTION_MS, (reaction.frames?.length ?? 0) * REACTION_FRAME_MS + REACTION_SLACK_MS)) return null;
  return { key: latest.id, reaction, age };
}

export const DANCE_BY_REACTION: Record<string, VictoryDance> = { '67': 'sixseven', groove: 'groove', scuba: 'scuba' };
export const PODIUM_DANCES: { id: string; dance: VictoryDance; name: string }[] = [
  { id: 'groove', dance: 'groove', name: 'Luz' },
  { id: '67', dance: 'sixseven', name: 'Six-seven' },
  { id: 'scuba', dance: 'scuba', name: 'Scuba' },
];
export const PODIUM_EMOTES = QUICK_REACTIONS.filter(reaction => reaction.kind !== 'animation');

export function podiumDance(session: GameSession, playerId: number): VictoryDance | null {
  const since = session.finishedAt ?? Infinity;
  const latest = (session.reactions ?? []).reduce<ArenaReaction | null>((found, item) =>
    item.senderId === playerId && item.sentAt >= since && DANCE_BY_REACTION[item.reaction] && (!found || item.id > found.id) ? item : found, null);
  return latest ? DANCE_BY_REACTION[latest.reaction] : null;
}

export function podiumEmote(session: GameSession, playerId: number, serverNow: number): ShownReaction | null {
  const shown = shownReaction(session, playerId, serverNow);
  if (!shown || shown.reaction.kind === 'animation') return null;
  const sent = (session.reactions ?? []).find(item => item.id === shown.key);
  return sent && sent.sentAt >= (session.finishedAt ?? Infinity) ? shown : null;
}

export function reactionDance(shown: ShownReaction | null) {
  const frames = shown?.reaction.frames;
  if (!shown || !frames || shown.age >= frames.length * REACTION_FRAME_MS + REACTION_SLACK_MS) return null;
  return { key: shown.key, frames };
}

export function reactionLocked(shop: ShopState | null, id: string) {
  const reaction = findReaction(id);
  if (!reaction) return false;
  if (reaction.kind === 'text') return isLocked(shop, 'QUICK_CHAT', id);
  return reaction.kind === 'animation' && isLocked(shop, 'DANCE', DANCE_BY_REACTION[id]);
}

export function reactionRefusal(status: number, body: Record<string, unknown> | null) {
  const retryAfter = typeof body?.retryAfter === 'number' ? body.retryAfter : 1;
  if (status === 429) return `Za szybko. Kolejna reakcja za ${Math.max(1, retryAfter)} s.`;
  if (status === 404) return 'Ta walka nie jest już dostępna.';
  if (status === 403) return 'Tę reakcję kupisz w Sklepie.';
  return 'Nie udało się wysłać reakcji.';
}
