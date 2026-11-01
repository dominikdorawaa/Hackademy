export type SoundEvent = 'friendRequests' | 'challenges' | 'matchFound' | 'friendOnline';
export type GameSoundEvent = 'arenaCorrect' | 'arenaWrong' | 'arenaWin' | 'arenaLoss' | 'arenaDraw' | 'arenaTick'
  | 'taskSolved' | 'roomCompleted' | 'learningError';
export type AnySoundEvent = SoundEvent | GameSoundEvent;

interface Tone {
  at: number;
  length: number;
  frequency: number;
  to?: number;
  wave?: OscillatorType;
  volume?: number;
}

export interface SoundVariant {
  id: string;
  name: string;
  tones: Tone[];
}

const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, G4 = 392, A4 = 440, D5 = 587.33, A5 = 880;
const C4 = 261.63, E4 = 329.63, F4 = 349.23, B5 = 987.77, E6 = 1318.5, G6 = 1568;

export const soundVariants: Record<AnySoundEvent, SoundVariant[]> = {
  friendRequests: [
    { id: 'chime', name: 'Dwutonowy dzwonek', tones: [
      { at: 0, length: 0.25, frequency: E5 }, { at: 0.12, length: 0.35, frequency: A5 }] },
    { id: 'pop', name: 'Miękkie pyknięcie', tones: [{ at: 0, length: 0.14, frequency: 520, to: 780, wave: 'triangle', volume: 0.1 }] },
    { id: 'arpeggio', name: 'Wesołe arpeggio', tones: [
      { at: 0, length: 0.2, frequency: C5 }, { at: 0.08, length: 0.2, frequency: E5 }, { at: 0.16, length: 0.3, frequency: G5 }] },
    { id: 'drop', name: 'Kropla', tones: [{ at: 0, length: 0.2, frequency: 1400, to: 500 }] },
  ],
  challenges: [
    { id: 'fanfare', name: 'Krótka fanfara', tones: [
      { at: 0, length: 0.12, frequency: G4, wave: 'triangle' }, { at: 0.12, length: 0.12, frequency: C5, wave: 'triangle' },
      { at: 0.24, length: 0.35, frequency: E5, wave: 'triangle' }] },
    { id: 'clash', name: 'Szczęk mieczy', tones: [
      { at: 0, length: 0.09, frequency: 1200, to: 900, wave: 'square', volume: 0.025 },
      { at: 0.11, length: 0.14, frequency: 1500, to: 1100, wave: 'square', volume: 0.025 }] },
    { id: 'rise', name: 'Narastający sygnał', tones: [{ at: 0, length: 0.38, frequency: 300, to: 900, wave: 'sawtooth', volume: 0.03 }] },
    { id: 'double', name: 'Podwójne uderzenie', tones: [
      { at: 0, length: 0.12, frequency: A4, wave: 'triangle', volume: 0.1 }, { at: 0.15, length: 0.22, frequency: D5, wave: 'triangle', volume: 0.1 }] },
  ],
  matchFound: [
    { id: 'gong', name: 'Gong', tones: [
      { at: 0, length: 1, frequency: G4, volume: 0.1 }, { at: 0, length: 0.9, frequency: C5, volume: 0.05 },
      { at: 0, length: 0.6, frequency: G5, volume: 0.03 }] },
    { id: 'ascend', name: 'Cztery tony w górę', tones: [
      { at: 0, length: 0.22, frequency: C5 }, { at: 0.1, length: 0.22, frequency: E5 }, { at: 0.2, length: 0.22, frequency: G5 },
      { at: 0.3, length: 0.5, frequency: C6 }] },
    { id: 'alarm', name: 'Alarm', tones: [
      { at: 0, length: 0.12, frequency: A5, wave: 'square', volume: 0.03 }, { at: 0.15, length: 0.12, frequency: E5, wave: 'square', volume: 0.03 },
      { at: 0.3, length: 0.12, frequency: A5, wave: 'square', volume: 0.03 }, { at: 0.45, length: 0.12, frequency: E5, wave: 'square', volume: 0.03 }] },
    { id: 'start', name: 'Start pojedynku', tones: [
      { at: 0, length: 0.15, frequency: C5, wave: 'triangle' }, { at: 0.25, length: 0.15, frequency: C5, wave: 'triangle' },
      { at: 0.5, length: 0.45, frequency: C6, wave: 'triangle' }] },
  ],
  friendOnline: [
    { id: 'blip', name: 'Krótki sygnał', tones: [{ at: 0, length: 0.18, frequency: 660, volume: 0.06 }] },
    { id: 'knock', name: 'Pukanie', tones: [
      { at: 0, length: 0.08, frequency: 300, wave: 'triangle', volume: 0.1 }, { at: 0.12, length: 0.08, frequency: 300, wave: 'triangle', volume: 0.1 }] },
    { id: 'hello', name: 'Powitanie', tones: [
      { at: 0, length: 0.15, frequency: G5, volume: 0.06 }, { at: 0.1, length: 0.25, frequency: C6, volume: 0.06 }] },
    { id: 'bubble', name: 'Bańka', tones: [{ at: 0, length: 0.16, frequency: 400, to: 900, volume: 0.06 }] },
  ],
  arenaCorrect: [
    { id: 'ding', name: 'Dzwoneczek', tones: [{ at: 0, length: 0.12, frequency: E5 }, { at: 0.07, length: 0.25, frequency: B5 }] },
    { id: 'coin', name: 'Moneta', tones: [
      { at: 0, length: 0.08, frequency: B5, wave: 'square', volume: 0.025 }, { at: 0.08, length: 0.22, frequency: E6, wave: 'square', volume: 0.025 }] },
    { id: 'sparkle', name: 'Iskierki', tones: [
      { at: 0, length: 0.1, frequency: C6, volume: 0.05 }, { at: 0.06, length: 0.1, frequency: E6, volume: 0.05 }, { at: 0.12, length: 0.2, frequency: G6, volume: 0.05 }] },
  ],
  arenaWrong: [
    { id: 'buzz', name: 'Brzęczyk', tones: [{ at: 0, length: 0.28, frequency: 160, wave: 'sawtooth', volume: 0.03 }] },
    { id: 'slide', name: 'Zjazd w dół', tones: [{ at: 0, length: 0.3, frequency: 420, to: 200, wave: 'triangle', volume: 0.1 }] },
    { id: 'thud', name: 'Głuche uderzenie', tones: [
      { at: 0, length: 0.12, frequency: 150, wave: 'triangle', volume: 0.12 }, { at: 0.14, length: 0.16, frequency: 120, wave: 'triangle', volume: 0.12 }] },
  ],
  arenaWin: [
    { id: 'fanfare', name: 'Fanfara zwycięstwa', tones: [
      { at: 0, length: 0.14, frequency: C5, wave: 'triangle' }, { at: 0.14, length: 0.14, frequency: E5, wave: 'triangle' },
      { at: 0.28, length: 0.14, frequency: G5, wave: 'triangle' }, { at: 0.42, length: 0.55, frequency: C6, wave: 'triangle' }] },
    { id: 'chord', name: 'Akord', tones: [
      { at: 0, length: 0.8, frequency: C5, volume: 0.05 }, { at: 0, length: 0.8, frequency: E5, volume: 0.05 }, { at: 0, length: 0.8, frequency: G5, volume: 0.05 },
      { at: 0.2, length: 0.6, frequency: C6, volume: 0.05 }] },
    { id: 'level', name: 'Poziom w górę', tones: [
      { at: 0, length: 0.5, frequency: 400, to: 1200, wave: 'square', volume: 0.025 }, { at: 0.5, length: 0.3, frequency: 1200, wave: 'square', volume: 0.025 }] },
  ],
  arenaLoss: [
    { id: 'descend', name: 'Trzy tony w dół', tones: [
      { at: 0, length: 0.2, frequency: G4, wave: 'triangle' }, { at: 0.2, length: 0.2, frequency: E4, wave: 'triangle' },
      { at: 0.4, length: 0.5, frequency: C4, wave: 'triangle' }] },
    { id: 'deflate', name: 'Uchodzące powietrze', tones: [{ at: 0, length: 0.7, frequency: 500, to: 120, wave: 'sawtooth', volume: 0.025 }] },
    { id: 'toll', name: 'Niski dzwon', tones: [{ at: 0, length: 1, frequency: C4, volume: 0.1 }, { at: 0, length: 0.8, frequency: F4, volume: 0.04 }] },
  ],
  arenaDraw: [
    { id: 'even', name: 'Dwa równe tony', tones: [
      { at: 0, length: 0.2, frequency: A4, wave: 'triangle' }, { at: 0.25, length: 0.3, frequency: A4, wave: 'triangle' }] },
    { id: 'balance', name: 'Waga', tones: [
      { at: 0, length: 0.2, frequency: G4 }, { at: 0.2, length: 0.2, frequency: D5 }, { at: 0.4, length: 0.3, frequency: G4 }] },
    { id: 'hum', name: 'Pomruk', tones: [{ at: 0, length: 0.5, frequency: 300, volume: 0.06 }] },
  ],
  arenaTick: [
    { id: 'tick', name: 'Tyknięcie', tones: [{ at: 0, length: 0.05, frequency: 1000, volume: 0.05 }] },
    { id: 'wood', name: 'Drewienko', tones: [{ at: 0, length: 0.06, frequency: 800, wave: 'triangle', volume: 0.1 }] },
    { id: 'beep', name: 'Pisk', tones: [{ at: 0, length: 0.07, frequency: A5, wave: 'square', volume: 0.02 }] },
  ],
  taskSolved: [
    { id: 'check', name: 'Odhaczone', tones: [{ at: 0, length: 0.1, frequency: G5, volume: 0.06 }, { at: 0.08, length: 0.2, frequency: C6, volume: 0.06 }] },
    { id: 'pling', name: 'Pling', tones: [{ at: 0, length: 0.25, frequency: 1200, to: 1600, volume: 0.05 }] },
    { id: 'step', name: 'Krok naprzód', tones: [
      { at: 0, length: 0.09, frequency: C5, wave: 'triangle' }, { at: 0.09, length: 0.18, frequency: G5, wave: 'triangle' }] },
  ],
  roomCompleted: [
    { id: 'arpeggio', name: 'Pełne arpeggio', tones: [
      { at: 0, length: 0.15, frequency: C5 }, { at: 0.08, length: 0.15, frequency: E5 }, { at: 0.16, length: 0.15, frequency: G5 },
      { at: 0.24, length: 0.15, frequency: C6 }, { at: 0.32, length: 0.45, frequency: E6, volume: 0.05 }] },
    { id: 'bells', name: 'Dzwony', tones: [
      { at: 0, length: 0.6, frequency: E5, volume: 0.06 }, { at: 0.15, length: 0.6, frequency: G5, volume: 0.06 }, { at: 0.3, length: 0.8, frequency: C6, volume: 0.06 }] },
    { id: 'quest', name: 'Misja wykonana', tones: [
      { at: 0, length: 0.12, frequency: G4, wave: 'square', volume: 0.025 }, { at: 0.12, length: 0.12, frequency: C5, wave: 'square', volume: 0.025 },
      { at: 0.24, length: 0.12, frequency: E5, wave: 'square', volume: 0.025 }, { at: 0.36, length: 0.4, frequency: G5, wave: 'square', volume: 0.025 }] },
  ],
  learningError: [
    { id: 'nope', name: 'Nie tym razem', tones: [
      { at: 0, length: 0.12, frequency: 330, wave: 'triangle', volume: 0.1 }, { at: 0.13, length: 0.18, frequency: 247, wave: 'triangle', volume: 0.1 }] },
    { id: 'low', name: 'Niski sygnał', tones: [{ at: 0, length: 0.22, frequency: 200, volume: 0.08 }] },
    { id: 'soft-buzz', name: 'Cichy brzęczyk', tones: [{ at: 0, length: 0.2, frequency: 140, wave: 'square', volume: 0.02 }] },
  ],
};

const variantKey = (event: AnySoundEvent) => `sound-variant:${event}`;

export function selectedVariant(event: AnySoundEvent) {
  let stored: string | null = null;
  try { stored = localStorage.getItem(variantKey(event)); } catch { stored = null; }
  return soundVariants[event].find(variant => variant.id === stored) ?? soundVariants[event][0];
}

export function chooseVariant(event: AnySoundEvent, id: string) {
  try { localStorage.setItem(variantKey(event), id); } catch { return; }
}

let context: AudioContext | null = null;

export async function unlockAudio() {
  if (typeof AudioContext === 'undefined') return false;
  try {
    context ??= new AudioContext();
    await context.resume();
  } catch { return false; }
  return context.state === 'running';
}

export function playSound(event: AnySoundEvent, variant = selectedVariant(event)) {
  const audio = context;
  if (!audio || audio.state !== 'running') return false;
  const start = audio.currentTime + 0.02;
  variant.tones.forEach(tone => {
    const begin = start + tone.at;
    const end = begin + tone.length;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = tone.wave ?? 'sine';
    oscillator.frequency.setValueAtTime(tone.frequency, begin);
    if (tone.to) oscillator.frequency.exponentialRampToValueAtTime(tone.to, end);
    gain.gain.setValueAtTime(0.0001, begin);
    gain.gain.exponentialRampToValueAtTime(tone.volume ?? 0.08, begin + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(begin);
    oscillator.stop(end + 0.02);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  });
  return true;
}

const playingUntil = new Map<GameSoundEvent, number>();

export function playGameSound(event: GameSoundEvent) {
  if (document.visibilityState === 'hidden') return false;
  const now = Date.now();
  if (now < (playingUntil.get(event) ?? 0)) return false;
  const variant = selectedVariant(event);
  if (!playSound(event, variant)) return false;
  playingUntil.set(event, now + Math.max(...variant.tones.map(tone => tone.at + tone.length)) * 1000);
  return true;
}

export function loudestEvent(events: SoundEvent[]): SoundEvent | null {
  return (['matchFound', 'challenges', 'friendRequests', 'friendOnline'] as const).find(event => events.includes(event)) ?? null;
}
