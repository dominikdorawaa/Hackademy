import type { ArenaMatchDetail, ArenaMatchResult, ArenaMatchRound } from '../../../types/api';
import { leagueFor, type League } from '../leagues';
import { formatElo } from '../../../lib/units';

export const RECENT_BATTLES = 5;
export const HISTORY_PAGE = 20;
export const HISTORY_EMPTY = 'Twoje bitwy pojawią się tutaj po pierwszym pojedynku.';
export const HISTORY_FAILED = 'Nie udało się wczytać bitew. Odśwież stronę, żeby spróbować ponownie.';

const RESULTS: Record<ArenaMatchResult, { label: string; tone: 'win' | 'loss' | 'draw' }> = {
  WIN: { label: 'Wygrana', tone: 'win' },
  LOSS: { label: 'Przegrana', tone: 'loss' },
  DRAW: { label: 'Remis', tone: 'draw' },
};

export function resultLabel(result: ArenaMatchResult) {
  return RESULTS[result].label;
}

export function resultTone(result: ArenaMatchResult) {
  return RESULTS[result].tone;
}

const MONTHS = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];

function dayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function formatBattleDate(iso: string, now = new Date()) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const time = `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  const days = Math.round((dayStart(now) - dayStart(date)) / 86_400_000);
  if (days === 0) return `dziś, ${time}`;
  if (days === 1) return `wczoraj, ${time}`;
  const year = date.getFullYear() === now.getFullYear() ? '' : ` ${date.getFullYear()}`;
  return `${date.getDate()} ${MONTHS[date.getMonth()]}${year}, ${time}`;
}

export function formatAnswerTime(millis: number) {
  return `${(Math.round(millis / 100) / 10).toFixed(1).replace('.', ',')} s`;
}

export function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return `${rest} s`;
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`;
}

export function finishLine(detail: ArenaMatchDetail) {
  const won = detail.summary.result === 'WIN';
  const rounds = detail.rounds.length;
  switch (detail.finishReason) {
    case 'KNOCKOUT': return rounds > 0 ? `nokaut w ${rounds}. rundzie` : 'nokaut';
    case 'SURRENDER': return won ? 'rywal się poddał' : 'poddanie walki';
    case 'DISCONNECT': return won ? 'rywal był nieobecny przez 30 sekund' : 'nieobecność przez 30 sekund';
    case 'ROUNDS': {
      const end = rounds > 0 ? `koniec po ${rounds} rundach` : 'koniec rund';
      return detail.summary.result === 'DRAW' ? `${end}, tyle samo HP` : won ? `${end}, masz więcej HP` : `${end}, rywal ma więcej HP`;
    }
    default: return null;
  }
}

export function correctCount(rounds: ArenaMatchRound[], side: 'me' | 'opponent') {
  return rounds.filter(round => (side === 'me' ? round.choice : round.opponentChoice) === round.correctAnswer).length;
}

export type LeagueNote = { kind: 'up' | 'down' | 'gap' | 'top'; league: League; text: string };

export function leagueNote(eloBefore: number, eloChange: number): LeagueNote {
  const after = eloBefore + eloChange;
  const was = leagueFor(eloBefore).league;
  const { league, next } = leagueFor(after);
  if (league.min > was.min) return { kind: 'up', league, text: `Awans do ligi ${league.name}.` };
  if (league.min < was.min) return { kind: 'down', league, text: `Spadek do ligi ${league.name}.` };
  if (!next) return { kind: 'top', league, text: `Zostajesz w najwyższej lidze, ${league.name}.` };
  const missing = next.min - after;
  const before = next.min - eloBefore;
  const change = before === missing ? '' : ` Przed bitwą brakowało ${formatElo(before)}.`;
  return { kind: 'gap', league: next, text: `Do ligi ${next.name} brakuje Ci teraz ${formatElo(missing)}.${change}` };
}
