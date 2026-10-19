import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { AvatarStudio } from './AvatarStudio';
import type { StudioTab } from './AvatarStudio';
import { DEFAULT_AVATAR } from '../arena/avatar/avatarModel';
import type { Avatar } from '../arena/avatar/avatarModel';

const atlas = vi.hoisted(() => ({ ready: true }));
vi.mock('../arena/avatar/useAvatarAtlas', () => ({
  useAvatarAtlas: () => atlas.ready ? { atlas: 'blob:atlas', front: 'blob:front' } : null,
  useAvatarPortrait: () => 'blob:portrait',
}));

function Harness({ onChange = () => undefined, reducedMotion = false }: { onChange?: (avatar: Avatar) => void; reducedMotion?: boolean }) {
  const [avatar, setAvatar] = useState<Avatar>({ ...DEFAULT_AVATAR, colors: { ...DEFAULT_AVATAR.colors } });
  const [tab, setTab] = useState<StudioTab>('outfit');
  return <AvatarStudio avatar={avatar} onChange={next => { setAvatar(next); onChange(next); }} reducedMotion={reducedMotion} tab={tab} onTab={setTab}
    aside={<p>Dymek</p>} />;
}

it('moves between categories with the keyboard', () => {
  render(<Harness />);
  const outfit = screen.getByRole('tab', { name: 'Strój' });
  expect(outfit).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', outfit.id);
  fireEvent.keyDown(outfit, { key: 'ArrowRight' });
  expect(screen.getByRole('tab', { name: 'Fryzura i czapka' })).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, { key: 'End' });
  expect(screen.getByRole('tab', { name: 'Ikona profilu' })).toHaveAttribute('aria-selected', 'true');
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
  expect(screen.getByRole('tab', { name: 'Strój' })).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
  expect(screen.getByRole('tab', { name: 'Ikona profilu' })).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, { key: 'Home' });
  expect(screen.getByRole('tab', { name: 'Strój' })).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
  expect(screen.getByRole('tab', { name: 'Strój' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByText('Dymek')).toBeInTheDocument();
});

it('switches the large preview between front, fight and icon views', () => {
  render(<Harness reducedMotion />);
  expect(screen.getByRole('img', { name: 'Twój awatar, widok z przodu' })).toHaveAttribute('src', 'blob:front');
  fireEvent.click(screen.getByRole('button', { name: 'W walce' }));
  expect(screen.getByRole('img', { name: 'Twój awatar w walce' })).toHaveAttribute('data-frame', '0');
  fireEvent.click(screen.getByRole('button', { name: 'Ikona' }));
  expect(screen.getByText('Ikona profilu, poza: Przód')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Ikona' })).toHaveAttribute('aria-pressed', 'true');
});

it('changes the outfit, head, colours and icon pose', () => {
  const onChange = vi.fn();
  render(<Harness onChange={onChange} />);
  fireEvent.click(screen.getByRole('radio', { name: /Bluza/ }));
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ outfit: 'bluza' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Kolory' }));
  expect(screen.queryByRole('radiogroup', { name: /Kolor czapki/ })).toBeNull();
  fireEvent.click(screen.getByRole('tab', { name: 'Fryzura i czapka' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Irokez' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Daszek' }));
  expect(screen.getByText(/Pod czapką fryzura jest schowana/)).toBeInTheDocument();
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ hair: 'irokez', hat: 'daszek' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Kolory' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Kolor czapki: Turkusowy' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Skóra: Hebanowa' }));
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ colors: expect.objectContaining({ hat: 'turkusowy', skin: 'heban' }) }));
  fireEvent.click(screen.getByRole('tab', { name: 'Ikona profilu' }));
  fireEvent.click(screen.getByRole('radio', { name: /Postawa/ }));
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ pose: 'postawa' }));
});

it('shows a loader until the avatar is drawn', () => {
  atlas.ready = false;
  render(<Harness />);
  expect(screen.getByRole('status')).toBeInTheDocument();
  atlas.ready = true;
});
