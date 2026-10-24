import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import API_URL from '../../apiConfig';
import { AuthProvider } from '../../context/AuthContext';
import { onRateLimit } from '../../services/rateLimit';
import { setClerkSession } from '../../test/clerk';
import { createToken } from '../../test/fixtures/auth';
import { server } from '../../test/mocks/server';
import type { BugReportRequest } from '../../types/api';
import { BugReportButton, reportLength, waitText } from './BugReportButton';

const URL = `${API_URL}/api/bug-reports`;

function mount(context: Omit<BugReportRequest, 'description' | 'pagePath'> = { source: 'ROOM', roomId: 4, taskId: 9 }) {
  return render(
    <MemoryRouter initialEntries={['/rooms/4?tab=tasks']}>
      <AuthProvider><BugReportButton className="trigger" context={context} /></AuthProvider>
    </MemoryRouter>,
  );
}

async function open() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Zgłoś błąd' }));
  return { user, dialog: within(await screen.findByRole('dialog', { name: 'Zgłoś błąd' })) };
}

beforeEach(() => {
  setClerkSession(createToken());
});

describe('bug report button', () => {
  it('sends the trimmed description with the place and page, then thanks the player', async () => {
    let body: unknown = null;
    server.use(http.post(URL, async ({ request }) => {
      body = await request.json();
      return HttpResponse.json({ message: 'ok' }, { status: 201 });
    }));
    mount();
    expect(screen.getByRole('button', { name: 'Zgłoś błąd' })).toHaveClass('bug-report-trigger', 'trigger');
    const { user, dialog } = await open();
    await user.type(dialog.getByLabelText('Opis problemu'), '  Flaga nie przechodzi  ');
    await user.click(dialog.getByRole('button', { name: 'Wyślij zgłoszenie' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(body).toEqual({ source: 'ROOM', roomId: 4, taskId: 9, pagePath: '/rooms/4', description: 'Flaga nie przechodzi' });
    expect(screen.getByText('Dziękujemy! Zgłoszenie trafiło do zespołu.')).toBeInTheDocument();
    const again = await open();
    expect(again.dialog.getByLabelText('Opis problemu')).toHaveValue('');
  });

  it('counts characters and only allows a description of 10 to 2000 characters', async () => {
    mount({ source: 'ARENA', gameId: 'game' });
    const { user, dialog } = await open();
    const field = dialog.getByLabelText('Opis problemu');
    const submit = dialog.getByRole('button', { name: 'Wyślij zgłoszenie' });
    expect(submit).toBeDisabled();
    expect(dialog.getByText('Jeszcze co najmniej 10 zn. · 0 / 2000')).toBeInTheDocument();
    await user.type(field, '🐛🐛🐛🐛🐛');
    expect(dialog.getByText('Jeszcze co najmniej 5 zn. · 5 / 2000')).toBeInTheDocument();
    expect(submit).toBeDisabled();
    await user.type(field, '12345');
    expect(dialog.getByText('10 / 2000')).toBeInTheDocument();
    expect(submit).toBeEnabled();
    await user.clear(field);
    await user.click(field);
    await user.paste('a'.repeat(2001));
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(dialog.getByText('2001 / 2000')).toHaveClass('text-destructive');
    expect(submit).toBeDisabled();
  });

  it('waits out the limit with a countdown, keeps the text and skips the global notice', async () => {
    const notices = vi.fn();
    const stop = onRateLimit(notices);
    let calls = 0;
    server.use(http.post(URL, () => {
      calls += 1;
      return calls === 1
        ? HttpResponse.json({ message: 'limit', retryAfter: 1 }, { status: 429, headers: { 'Retry-After': '1' } })
        : HttpResponse.json({ message: 'ok' }, { status: 201 });
    }));
    mount();
    const { user, dialog } = await open();
    await user.type(dialog.getByLabelText('Opis problemu'), 'Problem z flagą');
    await user.click(dialog.getByRole('button', { name: 'Wyślij zgłoszenie' }));

    expect(await dialog.findByText('Kolejne zgłoszenie możesz wysłać za 1 s.')).toBeInTheDocument();
    expect(dialog.getByLabelText('Opis problemu')).toHaveValue('Problem z flagą');
    expect(dialog.getByRole('button', { name: 'Wyślij zgłoszenie' })).toBeDisabled();
    await waitFor(() => expect(dialog.getByRole('button', { name: 'Wyślij zgłoszenie' })).toBeEnabled(), { timeout: 3000 });
    expect(dialog.queryByText(/Kolejne zgłoszenie/)).toBeNull();
    await user.click(dialog.getByRole('button', { name: 'Wyślij zgłoszenie' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls).toBe(2);
    expect(notices).not.toHaveBeenCalled();
    stop();
  });

  it('shows why the server refused the report and keeps the text', async () => {
    const replies = [
      HttpResponse.json({ message: 'To zgłoszenie już do nas trafiło. Nie musisz wysyłać go ponownie.' }, { status: 409 }),
      new HttpResponse('awaria', { status: 500 }),
      HttpResponse.error(),
    ];
    server.use(http.post(URL, () => replies.shift()!));
    mount();
    const { user, dialog } = await open();
    await user.type(dialog.getByLabelText('Opis problemu'), 'Problem z flagą');
    const submit = dialog.getByRole('button', { name: 'Wyślij zgłoszenie' });

    await user.click(submit);
    expect(await dialog.findByText('To zgłoszenie już do nas trafiło. Nie musisz wysyłać go ponownie.')).toBeInTheDocument();
    await user.click(submit);
    expect(await dialog.findByText('Nie udało się wysłać zgłoszenia. Spróbuj ponownie.')).toBeInTheDocument();
    await user.click(submit);
    expect(await dialog.findByText('Błąd sieci. Spróbuj jeszcze raz.')).toBeInTheDocument();
    expect(dialog.getByLabelText('Opis problemu')).toHaveValue('Problem z flagą');
  });

  it('keeps the draft after closing the window', async () => {
    mount();
    const { user, dialog } = await open();
    await user.type(dialog.getByLabelText('Opis problemu'), 'Szkic zgłoszenia');
    await user.click(dialog.getByRole('button', { name: 'Anuluj' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const again = await open();
    expect(again.dialog.getByLabelText('Opis problemu')).toHaveValue('Szkic zgłoszenia');
  });

  it('words the wait and counts characters by what the player sees', () => {
    expect(waitText(59)).toBe('59 s');
    expect(waitText(60)).toBe('1 min');
    expect(waitText(61)).toBe('2 min');
    expect(reportLength('  🐛ab  ')).toBe(3);
  });
});
