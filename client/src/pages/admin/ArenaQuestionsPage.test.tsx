import { setClerkSession } from '../../test/clerk';
import { Route } from 'react-router-dom';
import { configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import API_URL from '../../apiConfig';
import { server } from '../../test/mocks/server';
import { currentUserHandler } from '../../test/mocks/handlers';
import { createToken } from '../../test/fixtures/auth';
import { renderWithAuth } from '../../test/renderWithAuth';
import type { ArenaQuestionAdmin, Role } from '../../types/api';
import adminRoutes from './adminRoutes';
import { formFor, requestFrom, validateQuestion } from './arenaQuestionForm';

const URL_BASE = `${API_URL}/api/admin/arena/questions`;

afterAll(() => configure({ asyncUtilTimeout: 1000 }));

beforeAll(() => {
  configure({ asyncUtilTimeout: 3000 });
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.setPointerCapture = () => {};
  HTMLElement.prototype.releasePointerCapture = () => {};
  HTMLElement.prototype.scrollIntoView = () => {};
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

const question = (id: number, content: string, overrides: Partial<ArenaQuestionAdmin> = {}): ArenaQuestionAdmin => ({
  id,
  content,
  correctAnswer: '22',
  wrongAnswers: ['21', '23', '25'],
  category: 'SIECI',
  difficulty: 'EASY',
  version: 0,
  ...overrides,
});

function signIn(role: Role) {
  setClerkSession(createToken(role));
  server.use(currentUserHandler(role));
}

function mountAdmin(path: string) {
  return renderWithAuth(
    <>
      {adminRoutes}
      <Route path="/" element={<div>strona główna</div>} />
    </>,
    path,
  );
}

function bank(initial: ArenaQuestionAdmin[]) {
  const requests: { method: string; url: URL; body?: unknown }[] = [];
  let items = [...initial];
  server.use(
    http.get(URL_BASE, ({ request }) => {
      const url = new URL(request.url);
      requests.push({ method: 'GET', url });
      const query = (url.searchParams.get('query') ?? '').toLowerCase();
      const category = url.searchParams.get('category');
      return HttpResponse.json({
        items: items.filter((item) => item.content.toLowerCase().includes(query) && (!category || item.category === category)),
        page: Number(url.searchParams.get('page')),
        size: 50,
        hasNext: false,
      });
    }),
    http.post(URL_BASE, async ({ request }) => {
      const body = await request.json() as ArenaQuestionAdmin;
      requests.push({ method: 'POST', url: new URL(request.url), body });
      const created = { ...body, id: 99, version: 0 };
      items = [created, ...items];
      return HttpResponse.json(created, { status: 201 });
    }),
    http.put(`${URL_BASE}/:id`, async ({ request, params }) => {
      const body = await request.json() as ArenaQuestionAdmin;
      requests.push({ method: 'PUT', url: new URL(request.url), body });
      const current = items.find((item) => item.id === Number(params.id));
      if (!current || current.version !== body.version) {
        return HttpResponse.json({ message: 'Ktoś zmienił to pytanie w międzyczasie. Odśwież listę i spróbuj ponownie.' }, { status: 409 });
      }
      const updated = { ...body, id: current.id, version: current.version + 1 };
      items = items.map((item) => item.id === current.id ? updated : item);
      return HttpResponse.json(updated);
    }),
    http.delete(`${URL_BASE}/:id`, ({ request, params }) => {
      requests.push({ method: 'DELETE', url: new URL(request.url) });
      items = items.filter((item) => item.id !== Number(params.id));
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return { requests, setVersion: (id: number, version: number) => { items = items.map((item) => item.id === id ? { ...item, version } : item); } };
}

describe('arena question form rules', () => {
  it('requires content, one correct and three different wrong answers, category and difficulty', () => {
    expect(validateQuestion(formFor())).toEqual({
      content: 'Treść pytania jest wymagana.',
      correctAnswer: 'Poprawna odpowiedź jest wymagana.',
      'wrong-0': 'Ta odpowiedź jest wymagana.',
      'wrong-1': 'Ta odpowiedź jest wymagana.',
      'wrong-2': 'Ta odpowiedź jest wymagana.',
      category: 'Wybierz kategorię.',
      difficulty: 'Wybierz trudność.',
    });
    const form = { content: 'x'.repeat(501), correctAnswer: 'A', wrongAnswers: [' a ', 'C', 'x'.repeat(201)], category: 'WEB' as const, difficulty: 'HARD' as const };
    expect(validateQuestion(form)).toEqual({
      content: 'Treść pytania może mieć najwyżej 500 znaków.',
      'wrong-2': 'Odpowiedź może mieć najwyżej 200 znaków.',
      answers: 'Odpowiedzi muszą się od siebie różnić.',
    });
    expect(validateQuestion({ ...form, content: 'Pytanie', correctAnswer: 'x'.repeat(201), wrongAnswers: ['B', ' b', 'D'] })).toEqual({
      correctAnswer: 'Odpowiedź może mieć najwyżej 200 znaków.',
      answers: 'Odpowiedzi muszą się od siebie różnić.',
    });
    expect(requestFrom({ ...form, content: ' Pytanie ', correctAnswer: ' A ', wrongAnswers: ['B ', 'C', 'D'] }, 4)).toEqual({
      content: 'Pytanie', correctAnswer: 'A', wrongAnswers: ['B', 'C', 'D'], category: 'WEB', difficulty: 'HARD', version: 4,
    });
  });
});

describe('arena questions page', () => {
  it('lists, searches and filters the bank for an administrator', async () => {
    signIn('ADMIN');
    const { requests } = bank([question(1, 'Na którym porcie działa SSH?'), question(2, 'Co to XSS?', { category: 'WEB', difficulty: 'VERY_EASY', correctAnswer: 'Atak', wrongAnswers: ['Port', 'Plik', 'Szyfr'] })]);
    const user = userEvent.setup();
    mountAdmin('/admin/arena/questions');

    expect(await screen.findByRole('heading', { name: 'Pytania areny', level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Pokoje CTF nie są źródłem tych pytań/)).toBeInTheDocument();
    expect(within(screen.getByLabelText('Nawigacja panelu')).getByRole('link', { name: 'Pytania areny' })).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByText('Na którym porcie działa SSH?')).toBeInTheDocument();
    expect(screen.getAllByText('Poprawna: 22')).toHaveLength(1);
    expect(screen.queryByText(/Poprawna: [A-D] ·/)).not.toBeInTheDocument();

    const xssRow = screen.getByText('Co to XSS?').closest('tr')!;
    expect(within(xssRow).getAllByText('Bardzo łatwy')[0]).toHaveClass('text-sky-600');
    await user.click(screen.getByRole('combobox', { name: 'Filtruj według trudności' }));
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual(['Każda trudność', 'Bardzo łatwy', 'Łatwy', 'Średni', 'Trudny', 'Bardzo trudny']);
    await user.click(screen.getByRole('option', { name: 'Bardzo łatwy' }));
    await waitFor(() => expect(requests.at(-1)?.url.searchParams.get('difficulty')).toBe('VERY_EASY'));
    await user.click(screen.getByRole('combobox', { name: 'Filtruj według trudności' }));
    await user.click(await screen.findByRole('option', { name: 'Każda trudność' }));
    await waitFor(() => expect(requests.at(-1)?.url.searchParams.get('difficulty')).toBe(''));
    await user.type(screen.getByLabelText('Szukaj pytania'), 'xss');
    await waitFor(() => expect(screen.queryByText('Na którym porcie działa SSH?')).not.toBeInTheDocument());
    expect(screen.getByText('Co to XSS?')).toBeInTheDocument();
    expect(requests.at(-1)?.url.searchParams.get('query')).toBe('xss');

    await user.click(screen.getByRole('combobox', { name: 'Filtruj według kategorii' }));
    await user.click(await screen.findByRole('option', { name: 'Sieci' }));
    expect(await screen.findByText('Nie znaleziono pytań')).toBeInTheDocument();
    expect(requests.at(-1)?.url.searchParams.get('category')).toBe('SIECI');
  });

  it('blocks an incomplete question and creates a valid one', async () => {
    signIn('ADMIN');
    const { requests } = bank([]);
    const user = userEvent.setup();
    mountAdmin('/admin/arena/questions');
    expect(await screen.findByText('Bank pytań jest pusty')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dodaj pytanie' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByRole('button', { name: 'Dodaj pytanie' }));
    expect(dialog.getByText('Treść pytania jest wymagana.')).toBeInTheDocument();
    expect(dialog.getByText('Poprawna odpowiedź jest wymagana.')).toBeInTheDocument();
    expect(dialog.getByText(/Arena losuje ich kolejność w każdym pojedynku/)).toBeInTheDocument();
    expect(dialog.queryByRole('radio')).not.toBeInTheDocument();
    expect(dialog.getByLabelText('Treść pytania *')).toHaveFocus();
    expect(requests.filter((entry) => entry.method === 'POST')).toHaveLength(0);

    await user.type(dialog.getByLabelText('Treść pytania *'), 'Które narzędzie skanuje porty?');
    await user.type(dialog.getByLabelText('Poprawna'), 'nmap');
    for (const [index, answer] of [[1, 'grep'], [2, 'tar'], [3, 'NMAP ']] as const) {
      await user.type(dialog.getByLabelText(`Błędna ${index}`), answer);
    }
    await user.click(dialog.getByRole('combobox', { name: 'Kategoria *' }));
    await user.click(await screen.findByRole('option', { name: 'Sieci' }));
    await user.click(dialog.getByRole('combobox', { name: 'Trudność *' }));
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual(['Bardzo łatwy', 'Łatwy', 'Średni', 'Trudny', 'Bardzo trudny']);
    await user.click(screen.getByRole('option', { name: 'Bardzo trudny' }));
    await user.click(dialog.getByRole('button', { name: 'Dodaj pytanie' }));
    expect(dialog.getByText('Odpowiedzi muszą się od siebie różnić.')).toBeInTheDocument();

    expect(dialog.getByLabelText('Poprawna')).toHaveFocus();
    await user.clear(dialog.getByLabelText('Błędna 3'));
    await user.type(dialog.getByLabelText('Błędna 3'), 'ls');
    await user.click(dialog.getByRole('button', { name: 'Dodaj pytanie' }));
    expect(await screen.findByText('Dodano pytanie do banku areny.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(requests.find((entry) => entry.method === 'POST')?.body).toEqual({
      content: 'Które narzędzie skanuje porty?', correctAnswer: 'nmap', wrongAnswers: ['grep', 'tar', 'ls'], category: 'SIECI', difficulty: 'VERY_HARD',
    });
    expect(await screen.findByText('Które narzędzie skanuje porty?')).toBeInTheDocument();
  });

  it('saves edits with the loaded version and keeps the form on a conflict', async () => {
    signIn('ADMIN');
    const { requests, setVersion } = bank([question(4, 'Na którym porcie działa SSH?', { version: 2 })]);
    const user = userEvent.setup();
    mountAdmin('/admin/arena/questions');

    await user.click(await screen.findByRole('button', { name: /Edytuj pytanie: Na którym porcie/ }));
    let dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByLabelText('Poprawna')).toHaveValue('22');
    expect(dialog.getByLabelText('Błędna 1')).toHaveValue('21');
    expect(dialog.getByLabelText('Błędna 3')).toHaveValue('25');
    await user.type(dialog.getByLabelText('Treść pytania *'), ' (domyślnie)');
    setVersion(4, 3);
    await user.click(dialog.getByRole('button', { name: 'Zapisz zmiany' }));
    expect(await dialog.findByText(/Ktoś zmienił to pytanie w międzyczasie/)).toBeInTheDocument();
    expect(dialog.getByLabelText('Treść pytania *')).toHaveValue('Na którym porcie działa SSH? (domyślnie)');
    expect(requests.find((entry) => entry.method === 'PUT')?.body).toMatchObject({ version: 2 });

    await user.click(dialog.getByRole('button', { name: 'Anuluj' }));
    await user.click(screen.getByRole('button', { name: /Edytuj pytanie: Na którym porcie/ }));
    dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByLabelText('Treść pytania *')).toHaveValue('Na którym porcie działa SSH?');
    await user.clear(dialog.getByLabelText('Poprawna'));
    await user.type(dialog.getByLabelText('Poprawna'), '2222');
    await user.click(dialog.getByRole('button', { name: 'Zapisz zmiany' }));
    expect(await screen.findByText('Zapisano zmiany w pytaniu.')).toBeInTheDocument();
    expect(requests.filter((entry) => entry.method === 'PUT').at(-1)?.body).toMatchObject({ correctAnswer: '2222', wrongAnswers: ['21', '23', '25'], version: 3 });
    expect(await screen.findByText('Poprawna: 2222')).toBeInTheDocument();
  });

  it('deletes a question after confirmation and reports server refusals', async () => {
    signIn('ADMIN');
    const { requests } = bank([question(5, 'Pytanie do usunięcia'), question(6, 'Ostatnie pytanie')]);
    const user = userEvent.setup();
    mountAdmin('/admin/arena/questions');

    await user.click(await screen.findByRole('button', { name: 'Usuń pytanie: Pytanie do usunięcia' }));
    await user.click(await screen.findByRole('button', { name: 'Usuń pytanie' }));
    expect(await screen.findByText(/Usunięto pytanie/)).toBeInTheDocument();
    expect(requests.find((entry) => entry.method === 'DELETE')?.url.pathname).toBe('/api/admin/arena/questions/5');
    await waitFor(() => expect(screen.queryByText('Pytanie do usunięcia')).not.toBeInTheDocument());

    server.use(http.delete(`${URL_BASE}/6`, () => HttpResponse.json({ message: 'Arena potrzebuje co najmniej jednego pytania.' }, { status: 409 })));
    await user.click(screen.getByRole('button', { name: 'Usuń pytanie: Ostatnie pytanie' }));
    await user.click(await screen.findByRole('button', { name: 'Usuń pytanie' }));
    expect(await screen.findByText('Arena potrzebuje co najmniej jednego pytania.')).toBeInTheDocument();
    expect(screen.getByText('Ostatnie pytanie')).toBeInTheDocument();
  });

  it('shows a loading failure and keeps experts out', async () => {
    signIn('ADMIN');
    server.use(http.get(URL_BASE, () => HttpResponse.json({ message: 'Serwer niedostępny' }, { status: 500 })));
    const view = mountAdmin('/admin/arena/questions');
    expect(await screen.findByText('Serwer niedostępny')).toBeInTheDocument();
    view.unmount();

    signIn('EXPERT');
    server.use(http.get(`${API_URL}/api/admin/paths`, () => HttpResponse.json([])));
    mountAdmin('/admin/arena/questions');
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/admin/paths:REPLACE'));
  });
});
