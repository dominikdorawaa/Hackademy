import type { FinisherMove, VictoryDance } from './avatarModel';
import { victoryDance } from './fighters';
import { FINISHERS } from '../battle/battleView';

const REST = [0, 0, 0, 0, 0, 0];

export const finisherPreview = (move: FinisherMove, still = false) => still ? [finisherFrame(move)] : [...FINISHERS[move].frames, ...REST];
export const finisherFrame = (move: FinisherMove) => FINISHERS[move].frames[FINISHERS[move].impact];

export function dancePreview(dance: VictoryDance, still = false) {
  if (still) return [danceFrame(dance)];
  const { turn, loop } = victoryDance(dance);
  return [...turn, ...loop, ...loop, ...[...turn].reverse(), ...REST];
}
export const danceFrame = (dance: VictoryDance) => victoryDance(dance).loop[3];
