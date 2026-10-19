import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ColorChoices } from './ColorChoices';
import { hexToHsv, hsvToHex, isLight } from './colorMath';
import { CLOTH_RAMPS, fromAvatarConfig, hexToHsl, hslToHex, isColorChoice, rampFor, rampFromHex, readAvatar, AVATAR_KEY } from './avatarModel';
import { colorName } from './avatarOptions';

const PRESETS = ['bialy', 'grafitowy', 'granatowy', 'czerwony', 'bordowy', 'oliwkowy', 'piaskowy'];

function Harness({ initial = 'granatowy', onChange = () => undefined }: { initial?: string; onChange?: (value: string) => void }) {
  const [value, setValue] = useState(initial);
  return <div>
    <ColorChoices legend="Góra" value={value} options={CLOTH_RAMPS} presets={PRESETS} name="top" onChange={next => { setValue(next); onChange(next); }} />
    <button type="button">Poza</button>
  </div>;
}

describe('colour choices', () => {
  it('offers seven presets and a colourful square that opens the colour wheel', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    expect(screen.getAllByRole('radio')).toHaveLength(7);
    expect(screen.getByRole('radio', { name: 'Góra: Granatowy' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Góra: Czerwony' }));
    expect(onChange).toHaveBeenLastCalledWith('czerwony');
    const custom = screen.getByRole('button', { name: 'Góra: wybierz własny kolor' });
    expect(custom).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(custom);
    expect(screen.getByRole('dialog', { name: 'Góra: wybierz dowolny kolor' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Koło kolorów' })).toHaveFocus();
  });

  it('picks any colour with the keyboard, the brightness slider and the hex field', () => {
    const onChange = vi.fn();
    render(<Harness initial="#ff0000" onChange={onChange} />);
    expect(screen.getByRole('heading', { name: 'Góra Własny #FF0000' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Góra: Własny #FF0000, zmień' }));
    const wheel = screen.getByRole('slider', { name: 'Koło kolorów' });
    fireEvent.keyDown(wheel, { key: 'ArrowRight', shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith(hsvToHex({ h: 15, s: 1, v: 1 }));
    fireEvent.keyDown(wheel, { key: 'ArrowLeft' });
    fireEvent.keyDown(wheel, { key: 'ArrowDown' });
    fireEvent.keyDown(wheel, { key: 'ArrowUp' });
    fireEvent.keyDown(wheel, { key: 'Enter' });
    expect(wheel).toHaveAttribute('aria-valuenow', '10');
    fireEvent.change(screen.getByRole('slider', { name: 'Jasność' }), { target: { value: '50' } });
    expect(onChange).toHaveBeenLastCalledWith(hsvToHex({ h: 10, s: 1, v: 0.5 }));
    const hex = screen.getByRole('textbox', { name: 'Kod koloru' });
    fireEvent.change(hex, { target: { value: '12ab' } });
    expect(hex).toHaveAttribute('aria-invalid', 'true');
    fireEvent.change(hex, { target: { value: '#12AB34' } });
    expect(onChange).toHaveBeenLastCalledWith('#12ab34');
    fireEvent.click(screen.getByRole('button', { name: 'Gotowe' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Góra: Własny #12AB34, zmień' })).toHaveFocus();
  });

  it('picks a colour on the wheel with the pointer and closes on Escape or outside taps', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Góra: wybierz własny kolor' }));
    const wheel = screen.getByRole('slider', { name: 'Koło kolorów' });
    wheel.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.pointerDown(wheel, { clientX: 200, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(wheel, { clientX: 100, clientY: 200, pointerId: 1 });
    fireEvent.pointerUp(wheel, { clientX: 100, clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(wheel, { clientX: 100, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(wheel, { clientX: 100, clientY: 0, pointerId: 1 });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(hexToHsv(onChange.mock.calls[0][0]).h).toBeCloseTo(180, 0);
    fireEvent.keyDown(wheel, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Góra: Własny/ }));
    fireEvent.pointerDown(screen.getByRole('dialog'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Poza' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows a saved named colour that is not a preset as the custom choice', () => {
    render(<Harness initial="turkusowy" />);
    expect(screen.getByRole('button', { name: 'Góra: Turkusowy, zmień' })).toHaveAttribute('data-selected', 'true');
    expect(screen.getAllByRole('radio').every(radio => !(radio as HTMLInputElement).checked)).toBe(true);
  });
});

describe('custom colour model', () => {
  it('builds a four step ramp around any colour and converts between colour spaces', () => {
    const ramp = rampFromHex('#3366cc');
    expect(ramp[2]).toBe('#3366cc');
    const light = ramp.map(color => hexToHsl(color)[2]);
    expect(light[0]).toBeLessThan(light[1]);
    expect(light[1]).toBeLessThan(light[2]);
    expect(light[2]).toBeLessThan(light[3]);
    expect(hslToHex(...hexToHsl('#3366cc'))).toBe('#3366cc');
    expect(hexToHsl('#808080')).toEqual([0, 0, 128 / 255]);
    expect(hsvToHex(hexToHsv('#12ab34'))).toBe('#12ab34');
    expect(hexToHsv('#000000')).toEqual({ h: 0, s: 0, v: 0 });
    expect(isLight('#ffffff')).toBe(true);
    expect(isLight('#101010')).toBe(false);
  });

  it('accepts named and hex colours everywhere and falls back for anything else', () => {
    expect(rampFor(CLOTH_RAMPS, 'bialy')).toBe(CLOTH_RAMPS.bialy);
    expect(rampFor(CLOTH_RAMPS, '#00ff88')[2]).toBe('#00ff88');
    expect(rampFor(CLOTH_RAMPS, 'nieznany')).toBe(Object.values(CLOTH_RAMPS)[0]);
    expect(isColorChoice(CLOTH_RAMPS, '#00ff88')).toBe(true);
    expect(isColorChoice(CLOTH_RAMPS, '#00FF88')).toBe(false);
    expect(isColorChoice(CLOTH_RAMPS, 42)).toBe(false);
    expect(colorName('#00ff88')).toBe('Własny #00FF88');
    const config = { outfit: 'dres', hair: 'kucyk', hat: 'czapka', skin: '#c58c6d', hairColor: '#123456', topColor: '#00ff88', bottomColor: 'bialy', shoesColor: 'granatowy', hatColor: '#abcdef' };
    expect(fromAvatarConfig(config)?.colors).toMatchObject({ skin: '#c58c6d', hair: '#123456', top: '#00ff88', hat: '#abcdef' });
    expect(fromAvatarConfig({ ...config, topColor: 'rgb(0,0,0)' })).toBeNull();
    localStorage.setItem(AVATAR_KEY, JSON.stringify({ outfit: 'dres', colors: { skin: '#c58c6d', top: 'zly' } }));
    expect(readAvatar().colors).toMatchObject({ skin: '#c58c6d', top: 'granatowy' });
    localStorage.removeItem(AVATAR_KEY);
  });
});
