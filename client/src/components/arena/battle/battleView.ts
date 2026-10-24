import { DEFAULT_AVATAR, fromAvatarConfig } from '../avatar/avatarModel';
import type { Avatar } from '../avatar/avatarModel';
import { danceFrames } from '../avatar/fighters';
import type { FinisherMove } from '../avatar/fighters';
import type { ArenaAbsence, GameSession, RoundResult } from '../../../types/api';

export interface Fighter {
  id: number
  username: string
  elo: number
  hp: number
  seed?: string
  look: Avatar
  avatar: GameSession['player1Avatar']
}

export type Outcome = 'win' | 'loss' | 'draw' | 'cancelled';

const row = (index: number, count = 8) => Array.from({ length: count }, (_, column) => index * 9 + column + 1);
const ATTACK = row(1);
const HURT = row(4, 4);
const DEFEAT = row(5);
const VICTORY = danceFrames(6);

export const MAX_HP = 100;

function fighter(session: GameSession, slot: 1 | 2): Fighter {
  const id = slot === 1 ? session.player1Id : session.player2Id;
  const avatar = slot === 1 ? session.player1Avatar : session.player2Avatar;
  return {
    id,
    username: slot === 1 ? session.player1Username : session.player2Username,
    elo: (slot === 1 ? session.player1Elo : session.player2Elo) ?? 500,
    hp: session.hp?.[id] ?? MAX_HP,
    look: fromAvatarConfig(avatar) ?? DEFAULT_AVATAR,
    avatar,
  };
}

export function perspective(session: GameSession, meId: number) {
  const mine = session.player2Id === meId ? 2 : 1;
  return { me: fighter(session, mine), rival: fighter(session, mine === 1 ? 2 : 1) };
}

export function outcome(session: GameSession, meId: number): Outcome {
  if (session.finishReason === 'CANCELLED' || session.finishReason === 'ABANDONED') return 'cancelled';
  if (session.winnerId == null) return 'draw';
  return session.winnerId === meId ? 'win' : 'loss';
}

export function outcomeTitle(result: Outcome) {
  if (result === 'cancelled') return 'Mecz anulowany';
  return result === 'win' ? 'Zwycięstwo' : result === 'loss' ? 'Porażka' : 'Remis';
}

export function finishText(session: GameSession, meId: number) {
  const won = session.winnerId === meId;
  switch (session.finishReason) {
    case 'KNOCKOUT': {
      const finish = finisher(session);
      if (finish) return won ? `Rywal padł po Twoim ciosie kończącym: ${FINISHERS[finish.move].name}.` : `Twój awatar padł po ciosie kończącym: ${FINISHERS[finish.move].name}.`;
      return won ? 'Rywal padł po Twoim ciosie.' : 'Twój awatar został znokautowany.';
    }
    case 'SURRENDER': return won ? 'Rywal się poddał.' : 'Poddałeś walkę.';
    case 'CANCELLED': return 'Serwer został zrestartowany w trakcie walki, więc mecz anulowano. Elo się nie zmienia.';
    case 'DISCONNECT': return won ? 'Rywal był nieobecny przez 30 sekund.' : 'Byłeś nieobecny przez 30 sekund.';
    case 'ABANDONED': return 'Oboje byliście nieobecni przez 30 sekund, więc mecz anulowano. Elo się nie zmienia.';
    default: return session.winnerId == null ? 'Po 10 rundach macie tyle samo HP. Elo się nie zmienia.' : won ? 'Po 10 rundach masz więcej HP.' : 'Po 10 rundach rywal ma więcej HP.';
  }
}

export function eloChange(session: GameSession, meId: number) {
  return (session.player2Id === meId ? session.player2EloChange : session.player1EloChange) ?? 0;
}

export function roundSummary(result: RoundResult, meId: number, rivalId: number) {
  const iHit = (result.damage[rivalId] ?? 0) > 0;
  const rivalHit = (result.damage[meId] ?? 0) > 0;
  if (iHit && rivalHit) return `Oboje trafiliście. Tracisz ${result.damage[meId]} HP, rywal traci ${result.damage[rivalId]} HP.`;
  if (iHit) return `Trafiasz! Rywal traci ${result.damage[rivalId]} HP.`;
  if (rivalHit) return `Rywal trafia. Tracisz ${result.damage[meId]} HP.`;
  return 'Nikt nie trafił w tej rundzie.';
}

export const ABSENCE_MS = 30_000;

export interface PauseNotice { reason: string; secondsLeft: number; uses: string }

function absenceText(absence: ArenaAbsence | undefined, mine: boolean) {
  if (!absence) return mine ? 'Wróciłeś do walki.' : 'Rywal wrócił do walki.';
  if (absence.reason === 'LEFT') return mine ? 'Opuściłeś widok walki.' : 'Rywal opuścił widok walki.';
  return mine ? 'Straciłeś połączenie.' : 'Rywal stracił połączenie.';
}

export function pauseNotice(session: GameSession, meId: number, serverNow: number): PauseNotice | null {
  const pause = session.pause;
  if (!pause || session.status !== 'ACTIVE') return null;
  const rivalId = session.player1Id === meId ? session.player2Id : session.player1Id;
  const absences = session.absences ?? {};
  const reason = [rivalId, meId].filter(id => pause.players.includes(id))
    .map(id => absenceText(absences[id], id === meId)).join(' ');
  const used = (id: number) => session.pausesUsed?.includes(id) ? 'wykorzystana' : 'dostępna';
  return {
    reason,
    secondsLeft: Math.max(0, Math.ceil((pause.endsAt - serverNow) / 1000)),
    uses: `Każdy gracz ma jedną pauzę na mecz. Twoja: ${used(meId)}. Rywala: ${used(rivalId)}.`,
  };
}

export function absenceNotice(session: GameSession, meId: number, serverNow: number) {
  if (session.pause || session.status !== 'ACTIVE') return null;
  const rivalId = session.player1Id === meId ? session.player2Id : session.player1Id;
  const absence = session.absences?.[rivalId];
  if (!absence) return null;
  const left = Math.max(0, Math.ceil((absence.since + ABSENCE_MS - serverNow) / 1000));
  return `${absenceText(absence, false)} Pauza rywala jest już wykorzystana. Jeśli nie wróci w ciągu ${left} s, przegra walkę.`;
}

export function frozenSecondsLeft(session: GameSession, deadline: number) {
  return session.pause ? Math.max(0, Math.ceil((deadline - session.pause.startedAt) / 1000)) : null;
}

export interface Segment { frames: number[]; loop: boolean; frameTime: number; ms?: number }

export const ATTACK_FRAME_MS = 90;
export const HURT_FRAME_MS = 110;
export const CAST_MS = ATTACK.length * ATTACK_FRAME_MS;
export const HURT_MS = HURT.length * HURT_FRAME_MS;
export const LAUNCH_MS = 380;
export const IMPACT_MS = 900;

const IDLE: Segment = { frames: [0], loop: true, frameTime: 110 };

export interface FinisherSpec { name: string; frames: number[]; impact: number; hits: number[] }
export interface Finisher { move: FinisherMove; winnerId: number; loserId: number; start: number; impact: number; end: number }

const hold = (frames: number[], index: number, times: number) => [...frames.slice(0, index + 1), ...Array<number>(times).fill(frames[index]), ...frames.slice(index + 1)];
export const FINISHER_FRAME_MS = 100;
export const FINISHER_MOVES: FinisherMove[] = ['beam', 'combo'];
export const FINISHERS: Record<FinisherMove, FinisherSpec> = {
  beam: { name: 'Przeciążenie', frames: hold(danceFrames(2), 11, 5), impact: 9, hits: [] },
  combo: { name: 'Ctrl+Alt+Del', frames: hold(danceFrames(11), 10, 3), impact: 10, hits: [2, 6] },
};

export function finisher(session: GameSession): Finisher | null {
  const round = session.lastRound;
  if (session.status !== 'FINISHED' || session.finishReason !== 'KNOCKOUT' || session.winnerId == null || !round) return null;
  const winnerId = session.winnerId;
  const loserId = winnerId === session.player1Id ? session.player2Id : session.player1Id;
  if (!((round.damage[loserId] ?? 0) > 0)) return null;
  const move = FINISHER_MOVES[[...String(session.id)].reduce((sum, char) => sum + char.charCodeAt(0), 0) % FINISHER_MOVES.length];
  const spec = FINISHERS[move];
  const start = (round.damage[winnerId] ?? 0) > 0 ? IMPACT_MS + HURT_MS : 0;
  return { move, winnerId, loserId, start, impact: start + spec.impact * FINISHER_FRAME_MS, end: start + spec.frames.length * FINISHER_FRAME_MS };
}

export function impactAt(session: GameSession, fighterId: number) {
  const finish = finisher(session);
  return finish?.loserId === fighterId ? finish.impact : IMPACT_MS;
}

function finishing(finish: Finisher, round: RoundResult, fighterId: number, rest: Segment): Segment[] {
  const segments: Segment[] = [];
  if (fighterId === finish.winnerId) {
    if (finish.start > 0) segments.push({ ...IDLE, ms: IMPACT_MS }, { frames: HURT, loop: false, frameTime: HURT_FRAME_MS, ms: HURT_MS });
    const frames = FINISHERS[finish.move].frames;
    segments.push({ frames, loop: false, frameTime: FINISHER_FRAME_MS, ms: frames.length * FINISHER_FRAME_MS });
  } else {
    const attacked = (round.damage[finish.winnerId] ?? 0) > 0;
    if (attacked) segments.push({ frames: ATTACK, loop: false, frameTime: ATTACK_FRAME_MS, ms: CAST_MS });
    segments.push({ ...IDLE, ms: finish.impact - (attacked ? CAST_MS : 0) }, { frames: HURT, loop: false, frameTime: HURT_FRAME_MS, ms: HURT_MS });
  }
  segments.push(rest);
  return segments;
}

export function animatedRound(session: GameSession): RoundResult | null {
  if (!session.lastRound) return null;
  if (session.status === 'ACTIVE') return session.phase === 'REVEAL' ? session.lastRound : null;
  return session.finishReason === 'KNOCKOUT' || session.finishReason === 'ROUNDS' ? session.lastRound : null;
}

export function choreography(session: GameSession, fighterId: number, opponentId: number): Segment[] {
  const rest: Segment = session.status !== 'FINISHED' ? IDLE
    : session.winnerId === fighterId ? { frames: VICTORY, loop: true, frameTime: 110 }
    : session.winnerId === opponentId ? { frames: DEFEAT, loop: false, frameTime: 120 }
    : IDLE;
  const round = animatedRound(session);
  if (!round) return [rest];
  const finish = finisher(session);
  if (finish) return finishing(finish, round, fighterId, rest);
  const attacks = (round.damage[opponentId] ?? 0) > 0;
  const hurt = (round.damage[fighterId] ?? 0) > 0;
  const segments: Segment[] = [];
  if (attacks) segments.push({ frames: ATTACK, loop: false, frameTime: ATTACK_FRAME_MS, ms: CAST_MS });
  if (hurt) {
    const wait = IMPACT_MS - (attacks ? CAST_MS : 0);
    if (wait > 0) segments.push({ ...IDLE, ms: wait });
    segments.push({ frames: HURT, loop: false, frameTime: HURT_FRAME_MS, ms: HURT_MS });
  } else if (attacks && session.status === 'FINISHED') {
    segments.push({ ...IDLE, ms: IMPACT_MS + HURT_MS - CAST_MS });
  }
  segments.push(rest);
  return segments;
}

export function secondsLeft(deadline: number, serverTime: number, receivedAt: number, now: number) {
  const serverNow = now + (serverTime - receivedAt);
  return Math.max(0, Math.ceil((deadline - serverNow) / 1000));
}
