export type SoundEvent = 'friendRequests' | 'challenges' | 'matchFound' | 'friendOnline';

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

export const soundVariants: Record<SoundEvent, SoundVariant[]> = {
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
};

const variantKey = (event: SoundEvent) => `sound-variant:${event}`;

export function selectedVariant(event: SoundEvent) {
  let stored: string | null = null;
  try { stored = localStorage.getItem(variantKey(event)); } catch { stored = null; }
  return soundVariants[event].find(variant => variant.id === stored) ?? soundVariants[event][0];
}

export function chooseVariant(event: SoundEvent, id: string) {
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

export function playSound(event: SoundEvent, variant = selectedVariant(event)) {
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

export function loudestEvent(events: SoundEvent[]): SoundEvent | null {
  return (['matchFound', 'challenges', 'friendRequests', 'friendOnline'] as const).find(event => events.includes(event)) ?? null;
}
