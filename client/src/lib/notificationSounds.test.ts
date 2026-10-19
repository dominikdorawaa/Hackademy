import { afterEach, describe, expect, it, vi } from 'vitest';

class FakeParam {
  setValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
}
class FakeNode {
  frequency = new FakeParam();
  gain = new FakeParam();
  type = 'sine';
  onended: (() => void) | null = null;
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}
const oscillators: FakeNode[] = [];
class FakeAudioContext {
  state = 'suspended';
  currentTime = 0;
  destination = {};
  async resume() { this.state = 'running'; }
  createOscillator() { const node = new FakeNode(); oscillators.push(node); return node; }
  createGain() { return new FakeNode(); }
}

async function load() {
  vi.resetModules();
  return import('./notificationSounds');
}

afterEach(() => { vi.unstubAllGlobals(); oscillators.length = 0; localStorage.clear(); });

describe('notification sounds', () => {
  it('stays silent until the audio is unlocked by a user gesture', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const sounds = await load();
    expect(sounds.playSound('friendRequests')).toBe(false);
    expect(await sounds.unlockAudio()).toBe(true);
    expect(sounds.playSound('matchFound')).toBe(true);
    expect(oscillators).toHaveLength(sounds.selectedVariant('matchFound').tones.length);
    expect(oscillators.every(oscillator => oscillator.start.mock.calls.length === 1)).toBe(true);
  });

  it('reports missing audio support instead of throwing', async () => {
    vi.stubGlobal('AudioContext', undefined);
    const sounds = await load();
    expect(await sounds.unlockAudio()).toBe(false);
    expect(sounds.playSound('challenges')).toBe(false);
  });

  it('gives every event its own signal and remembers the chosen variant', async () => {
    const sounds = await load();
    const firsts = (['friendRequests', 'challenges', 'matchFound'] as const).map(event => sounds.selectedVariant(event).tones);
    expect(new Set(firsts.map(tones => JSON.stringify(tones))).size).toBe(3);
    sounds.chooseVariant('challenges', 'rise');
    expect(sounds.selectedVariant('challenges').id).toBe('rise');
    sounds.chooseVariant('challenges', 'missing');
    expect(sounds.selectedVariant('challenges').id).toBe(sounds.soundVariants.challenges[0].id);
  });

  it('picks the most urgent event of a batch', async () => {
    const { loudestEvent } = await load();
    expect(loudestEvent(['friendRequests', 'matchFound', 'challenges'])).toBe('matchFound');
    expect(loudestEvent(['friendRequests', 'challenges'])).toBe('challenges');
    expect(loudestEvent([])).toBeNull();
  });
});
