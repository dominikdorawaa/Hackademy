import { setClerkSession } from '../../test/clerk';
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
import type { AvatarConfig } from '../../types/api';
import { DEFAULT_AVATAR, toAvatarConfig } from '../arena/avatar/avatarModel';

const endpoint = `${API_URL}/api/user/me/profile`;
const original: ProfilePersonalization = { bio: 'Original bio', tagline: '', interests: [], featuredBadgeIds: [] };
let writes: ProfilePersonalization[];

beforeEach(() => {
  writes = [];
  setClerkSession(createToken());
  server.use(http.patch(endpoint, async ({ request }) => {
    const profile = await request.json() as ProfilePersonalization;
    writes.push(profile);
    return HttpResponse.json(profile);
  }));
});

async function mountEditor(initial = original, avatar: AvatarConfig | null = null) {
  const closed = vi.fn();
  const saved = vi.fn();
  const unauthorized = vi.fn();
  const renamed = vi.fn();
  const avatarSaved = vi.fn();
  const studio = vi.fn();
  function Host() {
    const [open, setOpen] = useState(false);
    return <>
      <button onClick={() => setOpen(true)}>Edytuj profil</button>
      {open && <ProfileEditor username="tester" initial={initial} badges={profileBadges} avatar={avatar}
        onSaved={saved} onRenamed={renamed} onUnauthorized={unauthorized} onClose={() => { closed(); setOpen(false); }}
        onAvatarSaved={avatarSaved} onOpenAvatarStudio={() => { studio(); setOpen(false); }} />}
    </>;
  }
  const view = render(<AuthProvider><Host /></AuthProvider>);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Edytuj profil' }));
  const editor = screen.getByRole('dialog', { name: 'Edytuj profil' });
  return { ...view, user, editor, closed, saved, unauthorized, renamed, avatarSaved, studio };
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

  it.each(['interests', 'badges', 'badge order'])('detects changes to %s without changing bio', async field => {
    const { user, editor } = await mountEditor({ ...original, featuredBadgeIds: field === 'badge order' ? [7, 6] : [] });
    const controls = within(editor);
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
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Edytuj profil' })).toHaveFocus();
    });
    expect(saved).toHaveBeenCalledWith(expect.objectContaining({ bio: 'Original bio updated' }), 'tester');
    expect(closed).toHaveBeenCalledOnce();
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

describe('profile editor username', () => {
  const usernameEndpoint = `${API_URL}/api/user/me/username`;

  it('renames without touching the profile when only the name changed', async () => {
    const renames: unknown[] = [];
    server.use(http.patch(usernameEndpoint, async ({ request }) => {
      renames.push(await request.json());
      return HttpResponse.json({ username: 'newname' });
    }));
    const { user, editor, saved, closed } = await mountEditor();
    const field = within(editor).getByRole('textbox', { name: 'Nazwa użytkownika' });
    await user.clear(field);
    await user.type(field, ' newname ');
    await user.click(within(editor).getByRole('button', { name: 'Zapisz profil' }));
    await waitFor(() => expect(closed).toHaveBeenCalledOnce());
    expect(renames).toEqual([{ newUsername: 'newname' }]);
    expect(writes).toHaveLength(0);
    expect(saved).toHaveBeenCalledWith(original, 'newname');
  });

  it('keeps the editor open with the error under the field when the name is taken', async () => {
    server.use(http.patch(usernameEndpoint, () => HttpResponse.json({ message: 'Username already taken' }, { status: 409 })));
    const { user, editor, saved } = await mountEditor();
    const field = within(editor).getByRole('textbox', { name: 'Nazwa użytkownika' });
    await user.clear(field);
    await user.type(field, 'taken');
    await user.type(within(editor).getByRole('textbox', { name: 'O mnie' }), ' updated');
    await user.click(within(editor).getByRole('button', { name: 'Zapisz profil' }));
    expect(await within(editor).findByRole('alert')).toHaveTextContent('Ta nazwa jest już zajęta. Wybierz inną.');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(writes).toHaveLength(0);
    expect(saved).not.toHaveBeenCalled();
    await user.type(field, 'x');
    expect(field).toHaveAttribute('aria-invalid', 'false');
  });

  it('does not rename twice when the profile save fails after a successful rename', async () => {
    let renames = 0;
    server.use(
      http.patch(usernameEndpoint, () => { renames += 1; return HttpResponse.json({ username: 'newname' }); }),
      http.patch(endpoint, () => new HttpResponse(null, { status: 500 })),
    );
    const { user, editor, saved, renamed } = await mountEditor();
    const field = within(editor).getByRole('textbox', { name: 'Nazwa użytkownika' });
    await user.clear(field);
    await user.type(field, 'newname');
    await user.type(within(editor).getByRole('textbox', { name: 'O mnie' }), ' updated');
    await user.click(within(editor).getByRole('button', { name: 'Zapisz profil' }));
    await within(editor).findByRole('alert');
    expect(renamed).toHaveBeenCalledWith('newname');
    expect(saved).not.toHaveBeenCalled();
    server.use(http.patch(endpoint, async ({ request }) => HttpResponse.json(await request.json())));
    await user.click(within(editor).getByRole('button', { name: 'Zapisz profil' }));
    await waitFor(() => expect(saved).toHaveBeenCalledWith(expect.objectContaining({ bio: 'Original bio updated' }), 'newname'));
    expect(renames).toBe(1);
  });

  it('blocks saving a name outside 3 to 20 characters', async () => {
    const { user, editor } = await mountEditor();
    const field = within(editor).getByRole('textbox', { name: 'Nazwa użytkownika' });
    await user.clear(field);
    await user.type(field, 'ab');
    expect(within(editor).getByRole('button', { name: 'Zapisz profil' })).toBeDisabled();
  });
});

describe('profile editor avatar', () => {
  const avatarEndpoint = `${API_URL}/api/user/me/avatar`;
  const custom = toAvatarConfig({ ...DEFAULT_AVATAR, outfit: 'bluza' });
  let avatarWrites: AvatarConfig[];
  beforeEach(() => {
    avatarWrites = [];
    server.use(http.put(avatarEndpoint, async ({ request }) => {
      const avatar = await request.json() as AvatarConfig;
      avatarWrites.push(avatar);
      return HttpResponse.json(avatar);
    }));
  });

  it('saves only the new pose of the current look when nothing else changed', async () => {
    const { user, editor, avatarSaved, saved, closed } = await mountEditor(original, custom);
    const poses = within(editor).getByRole('radiogroup', { name: 'Awatar' });
    expect(within(poses).getAllByRole('radio').map(radio => radio.getAttribute('value'))).toEqual(['przod', 'postawa', 'profil']);
    expect(within(poses).getByRole('radio', { name: 'Przód' })).toBeChecked();
    await user.click(within(poses).getByRole('radio', { name: 'Profil' }));
    await user.click(within(editor).getByRole('button', { name: 'Zapisz profil' }));
    await waitFor(() => expect(closed).toHaveBeenCalledOnce());
    expect(avatarWrites).toEqual([{ ...custom, pose: 'profil' }]);
    expect(avatarSaved).toHaveBeenCalledWith({ ...custom, pose: 'profil' });
    expect(saved).toHaveBeenCalledWith(original, 'tester');
    expect(writes).toEqual([]);
  });

  it('keeps the form open after a failed pose save and does not resend a saved pose', async () => {
    server.use(http.put(avatarEndpoint, () => new HttpResponse(null, { status: 500 })));
    const { user, editor, closed } = await mountEditor();
    await user.click(within(editor).getByRole('radio', { name: 'Postawa' }));
    await user.type(within(editor).getByRole('textbox', { name: 'O mnie' }), ' updated');
    await user.click(within(editor).getByRole('button', { name: 'Zapisz profil' }));
    expect(await within(editor).findByRole('alert')).toHaveTextContent('pozy awatara');
    expect(writes).toEqual([]);
    expect(closed).not.toHaveBeenCalled();
    server.use(http.put(avatarEndpoint, async ({ request }) => {
      avatarWrites.push(await request.json() as AvatarConfig);
      return HttpResponse.json({});
    }));
    server.use(http.patch(endpoint, () => new HttpResponse(null, { status: 500 })));
    await user.click(within(editor).getByRole('button', { name: 'Zapisz profil' }));
    expect(await within(editor).findByRole('alert')).toHaveTextContent('Nie udało się zapisać profilu');
    expect(avatarWrites).toHaveLength(1);
    expect(avatarWrites[0].pose).toBe('postawa');
    expect(within(editor).getByRole('radio', { name: 'Postawa' })).toBeChecked();
  });

  it('opens the avatar studio at once or after confirming that changes are dropped', async () => {
    const first = await mountEditor();
    await first.user.click(within(first.editor).getByRole('button', { name: 'Zmień wygląd szczegółowo' }));
    expect(first.studio).toHaveBeenCalledOnce();
    first.unmount();
    const { user, editor, studio, closed } = await mountEditor();
    await user.click(within(editor).getByRole('radio', { name: 'Profil' }));
    await user.click(within(editor).getByRole('button', { name: 'Zmień wygląd szczegółowo' }));
    const confirmation = screen.getByRole('alertdialog', { name: 'Niezapisane zmiany' });
    expect(confirmation).toHaveTextContent('Jeśli przejdziesz do kreatora awatara');
    await user.click(within(confirmation).getByRole('button', { name: 'Odrzuć zmiany' }));
    expect(studio).toHaveBeenCalledOnce();
    expect(closed).not.toHaveBeenCalled();
    expect(avatarWrites).toEqual([]);
  });
});
