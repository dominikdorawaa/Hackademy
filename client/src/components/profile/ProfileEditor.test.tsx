import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import API_URL from '../../apiConfig';
import { AuthProvider } from '../../context/AuthContext';
import type { ProfilePersonalization } from '../../lib/profile';
import { createToken } from '../../test/fixtures/auth';
import { profileBadges } from '../../test/fixtures/profile';
import { server } from '../../test/mocks/server';
import ProfileEditor from './ProfileEditor';

const endpoint = `${API_URL}/api/user/me/profile`;
const original: ProfilePersonalization = { bio: 'Original bio', tagline: '', avatarSeed: 'original-avatar', interests: [], featuredBadgeIds: [] };
let writes: ProfilePersonalization[];

beforeEach(() => {
  writes = [];
  localStorage.setItem('token', createToken());
  server.use(http.patch(endpoint, async ({ request }) => {
    const profile = await request.json() as ProfilePersonalization;
    writes.push(profile);
    return HttpResponse.json(profile);
  }));
});

async function mountEditor(initial = original) {
  const closed = vi.fn();
  const saved = vi.fn();
  const unauthorized = vi.fn();
  function Host() {
    const [open, setOpen] = useState(false);
    return <>
      <button onClick={() => setOpen(true)}>Edytuj profil</button>
      {open && <ProfileEditor username="tester" initial={initial} badges={profileBadges}
        onSaved={saved} onUnauthorized={unauthorized} onClose={() => { closed(); setOpen(false); }} />}
    </>;
  }
  const view = render(<AuthProvider><Host /></AuthProvider>);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Edytuj profil' }));
  const editor = screen.getByRole('dialog', { name: 'Edytuj profil' });
  return { ...view, user, editor, closed, saved, unauthorized };
}

async function requestClose(action: string, user: ReturnType<typeof userEvent.setup>, editor: HTMLElement) {
  if (action === 'Escape') fireEvent(editor, new Event('cancel', { bubbles: true, cancelable: true }));
  else await user.click(within(editor).getByRole('button', { name: action }));
}

describe('profile editor dismissal', () => {
  it.each([false, true])('ignores outside clicks and text-selection releases, dirty: %s', async dirty => {
    const { user, editor, closed } = await mountEditor();
    const bio = within(editor).getByRole('textbox', { name: 'O mnie' });
    if (dirty) await user.type(bio, ' updated');
    fireEvent.pointerDown(bio);
    fireEvent.pointerUp(editor);
    fireEvent.click(editor);
    expect(editor).toHaveAttribute('open');
    expect(bio).toHaveValue(dirty ? 'Original bio updated' : 'Original bio');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(closed).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
  });

  it.each(['Zamknij edycję profilu', 'Anuluj', 'Escape'])('closes an unchanged form immediately with %s', async action => {
    const { user, editor, closed } = await mountEditor();
    await requestClose(action, user, editor);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(closed).toHaveBeenCalledOnce();
    expect(writes).toEqual([]);
    expect(screen.getByRole('button', { name: 'Edytuj profil' })).toHaveFocus();
  });

  it.each(['Zamknij edycję profilu', 'Anuluj', 'Escape'])('protects a changed form, continues and explicitly discards with %s', async action => {
    const { user, editor, closed, saved } = await mountEditor();
    const bio = within(editor).getByRole('textbox', { name: 'O mnie' });
    await user.type(bio, ' updated');
    await requestClose(action, user, editor);
    const confirmation = screen.getByRole('alertdialog', { name: 'Niezapisane zmiany' });
    expect(within(confirmation).getByRole('button', { name: 'Kontynuuj edycję' })).toHaveFocus();
    await user.tab();
    expect(within(confirmation).getByRole('button', { name: 'Odrzuć zmiany' })).toHaveFocus();
    await user.tab();
    expect(within(confirmation).getByRole('button', { name: 'Kontynuuj edycję' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(within(confirmation).getByRole('button', { name: 'Odrzuć zmiany' })).toHaveFocus();
    fireEvent.click(confirmation);
    fireEvent.click(within(editor).getByRole('button', { name: 'Zamknij edycję profilu' }));
    fireEvent.submit(editor.querySelector('form')!);
    expect(closed).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
    await user.click(within(confirmation).getByRole('button', { name: 'Kontynuuj edycję' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(bio).toHaveValue('Original bio updated');
    if (action === 'Escape') expect(bio).toHaveFocus();
    else expect(within(editor).getByRole('button', { name: action })).toHaveFocus();
    await requestClose(action, user, editor);
    await user.click(screen.getByRole('button', { name: 'Odrzuć zmiany' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(closed).toHaveBeenCalledOnce();
    expect(saved).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
    expect(screen.getByRole('button', { name: 'Edytuj profil' })).toHaveFocus();
  });

  it.each(['avatar', 'interests', 'badges', 'badge order'])('detects changes to %s without changing bio', async field => {
    const { user, editor } = await mountEditor({ ...original, featuredBadgeIds: field === 'badge order' ? [7, 6] : [] });
    const controls = within(editor);
    if (field === 'avatar') await user.click(controls.getByRole('radio', { name: 'Avatar 2' }));
    if (field === 'interests') await user.click(controls.getByRole('checkbox', { name: 'Linux' }));
    if (field === 'badges' || field === 'badge order') await user.click(controls.getByText('Odznaka 7'));
    if (field === 'badge order') await user.click(controls.getByText('Odznaka 7'));
    await requestClose('Anuluj', user, editor);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(controls.getByRole('textbox', { name: 'O mnie' })).toHaveValue('Original bio');
    expect(writes).toEqual([]);
  });

  it('does not treat restored original values as unsaved changes', async () => {
    const { user, editor } = await mountEditor();
    const controls = within(editor);
    const bio = controls.getByRole('textbox', { name: 'O mnie' });
    await user.type(bio, ' updated');
    await user.clear(bio);
    await user.type(bio, original.bio);
    await user.click(controls.getByRole('radio', { name: 'Avatar 2' }));
    await user.click(controls.getByRole('radio', { name: 'Avatar 1' }));
    await user.click(controls.getByRole('checkbox', { name: 'Linux' }));
    await user.click(controls.getByRole('checkbox', { name: 'Linux' }));
    await user.click(controls.getByText('Odznaka 7'));
    await user.click(controls.getByText('Odznaka 7'));
    await requestClose('Anuluj', user, editor);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('uses Escape in the confirmation to continue editing without losing text', async () => {
    const { user, editor, closed } = await mountEditor();
    const bio = within(editor).getByRole('textbox', { name: 'O mnie' });
    await user.type(bio, ' updated');
    await requestClose('Escape', user, editor);
    fireEvent(screen.getByRole('alertdialog'), new Event('cancel', { bubbles: true, cancelable: true }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(bio).toHaveValue('Original bio updated');
    expect(bio).toHaveFocus();
    expect(closed).not.toHaveBeenCalled();
  });

  it('blocks dismissal and duplicate submits while saving, then closes on success', async () => {
    let finish!: () => void;
    const gate = new Promise<void>(resolve => { finish = resolve; });
    const started = vi.fn();
    server.use(http.patch(endpoint, async ({ request }) => {
      const profile = await request.json() as ProfilePersonalization;
      writes.push(profile);
      started();
      await gate;
      return HttpResponse.json(profile);
    }));
    const { user, editor, closed, saved } = await mountEditor();
    const controls = within(editor);
    await user.type(controls.getByRole('textbox', { name: 'O mnie' }), ' updated');
    await user.click(controls.getByRole('button', { name: 'Zapisz profil' }));
    await waitFor(() => expect(started).toHaveBeenCalledOnce());
    expect(controls.getByRole('button', { name: 'Anuluj' })).toBeDisabled();
    expect(controls.getByRole('button', { name: 'Zamknij edycję profilu' })).toBeDisabled();
    await requestClose('Escape', user, editor);
    fireEvent.click(editor);
    fireEvent.submit(editor.querySelector('form')!);
    expect(closed).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(writes).toHaveLength(1);
    finish();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(saved).toHaveBeenCalledWith(expect.objectContaining({ bio: 'Original bio updated' }));
    expect(closed).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Edytuj profil' })).toHaveFocus();
  });

  it.each(['validation', 'server', 'network'])('retains the draft and closing protection after a %s error', async failure => {
    server.use(http.patch(endpoint, () => failure === 'network' ? HttpResponse.error()
      : new HttpResponse(null, { status: failure === 'validation' ? 400 : 500 })));
    const { user, editor, closed, saved } = await mountEditor();
    const controls = within(editor);
    await user.type(controls.getByRole('textbox', { name: 'O mnie' }), ' updated');
    await user.click(controls.getByRole('button', { name: 'Zapisz profil' }));
    await screen.findByRole('alert');
    expect(controls.getByRole('textbox', { name: 'O mnie' })).toHaveValue('Original bio updated');
    expect(controls.getByRole('button', { name: 'Anuluj' })).toBeEnabled();
    await requestClose('Anuluj', user, editor);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(closed).not.toHaveBeenCalled();
    expect(saved).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Kontynuuj edycję' }));
    server.use(http.patch(endpoint, async ({ request }) => HttpResponse.json(await request.json())));
    await user.click(controls.getByRole('button', { name: 'Zapisz profil' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(saved).toHaveBeenCalledOnce();
  });
});
