import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { QuickChatMenu } from './QuickChatMenu';
import { QUICK_REACTIONS } from './quickChat';

const mount = (onPick = vi.fn(), notice: string | null = null) => {
  render(<div><QuickChatMenu onPick={onPick} notice={notice}><img alt="" /></QuickChatMenu><button type="button">Poza menu</button></div>);
  return onPick;
};
const trigger = () => screen.getByRole('button', { name: 'Szybkie reakcje' });

it('opens from the portrait with a tap and sends the picked reaction', () => {
  const onPick = mount();
  expect(trigger()).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(trigger());
  expect(trigger()).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('menu', { name: 'Szybkie reakcje' })).toBeInTheDocument();
  expect(screen.getAllByRole('menuitem')).toHaveLength(QUICK_REACTIONS.length);
  for (const group of ['Frazy', 'Emotki', 'Animacje']) expect(screen.getByRole('group', { name: group })).toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: 'EZ' })).toHaveFocus();
  fireEvent.click(screen.getByRole('menuitem', { name: 'Six-seven' }));
  expect(onPick).toHaveBeenCalledWith('67');
  expect(screen.queryByRole('menu')).toBeNull();
  expect(trigger()).toHaveFocus();
});

it('works with the keyboard', () => {
  const onPick = mount();
  fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
  const menu = screen.getByRole('menu');
  expect(screen.getByRole('menuitem', { name: 'EZ' })).toHaveFocus();
  fireEvent.keyDown(menu, { key: 'ArrowRight' });
  expect(screen.getByRole('menuitem', { name: 'GG' })).toHaveFocus();
  fireEvent.keyDown(menu, { key: 'ArrowUp' });
  fireEvent.keyDown(menu, { key: 'ArrowLeft' });
  expect(screen.getByRole('menuitem', { name: 'Taniec Luz' })).toHaveFocus();
  fireEvent.keyDown(menu, { key: 'Home' });
  expect(screen.getByRole('menuitem', { name: 'EZ' })).toHaveFocus();
  fireEvent.keyDown(menu, { key: 'End' });
  expect(screen.getByRole('menuitem', { name: 'Taniec Luz' })).toHaveFocus();
  fireEvent.keyDown(menu, { key: 'ArrowDown' });
  expect(screen.getByRole('menuitem', { name: 'EZ' })).toHaveFocus();
  fireEvent.keyDown(menu, { key: 'Escape' });
  expect(screen.queryByRole('menu')).toBeNull();
  expect(trigger()).toHaveFocus();
  fireEvent.keyDown(trigger(), { key: 'Enter' });
  expect(screen.queryByRole('menu')).toBeNull();
  expect(onPick).not.toHaveBeenCalled();
});

it('closes when focus or a tap leaves the menu', () => {
  mount();
  fireEvent.click(trigger());
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'Tab' });
  expect(screen.queryByRole('menu')).toBeNull();
  fireEvent.click(trigger());
  fireEvent.pointerDown(screen.getByRole('menuitem', { name: 'GG' }));
  expect(screen.getByRole('menu')).toBeInTheDocument();
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Poza menu' }));
  expect(screen.queryByRole('menu')).toBeNull();
  fireEvent.click(trigger());
  fireEvent.click(trigger());
  expect(screen.queryByRole('menu')).toBeNull();
});

it('shows why a reaction was refused', () => {
  mount(vi.fn(), 'Masz wyciszone reakcje na stałe.');
  expect(screen.getByRole('alert')).toHaveTextContent('Masz wyciszone reakcje na stałe.');
});
