import { beforeEach, describe, expect, it, vi } from 'vitest';
import API_URL from '../apiConfig';
import type { RoomWriteRequest } from '../types/api';
import { registerSession, request } from './http';
import * as user from './userApi';
import * as path from './pathApi';
import * as room from './roomApi';
import * as arena from './arenaApi';
import * as admin from './adminRequests';
import * as legacyAdmin from './adminApi';

const fetchMock = vi.fn<typeof fetch>();
const headers = { sessionKey: 'sessionKey' };
const jsonHeaders = { ...headers, 'Content-Type': 'application/json' };
const roomData: RoomWriteRequest = {
  title: 'Room', description: 'Description', difficulty: 'EASY', category: 'Web',
  points: 50, flag: 'flag', requiresVpn: false, roomType: 'CTF', hints: ['hint'],
};

beforeEach(() => {
  registerSession({ sessionKey: 'sessionKey', getToken: async () => 'session-token', expired: vi.fn() });
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetchMock);
});

describe('HTTP compatibility', () => {
  it.each([401, 403, 500])('leaves text HTTP %s available to the caller', async status => {
    fetchMock.mockResolvedValue(new Response('original error', { status }));
    const response = await request('/api/user/me', { method: 'GET' });
    expect(response.ok).toBe(false);
    expect(response.status).toBe(status);
    expect(await response.text()).toBe('original error');
  });

  it('keeps a reaction mute error as JSON, including its timestamp', async () => {
    const error = { message: 'Masz wyciszone reakcje.', mutedUntil: '2026-10-06T18:00:00Z' };
    fetchMock.mockResolvedValue(Response.json(error, { status: 403 }));
    const response = await arena.sendReaction('abc', 'ez', jsonHeaders);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual(error);
  });

  it('preserves native JSON parse failures and clone behavior for registration fallback', async () => {
    fetchMock.mockResolvedValue(new Response('not JSON'));
    const response = await request('/api/user/me', { method: 'GET' });
    const clone = response.clone();
    await expect(response.json()).rejects.toThrow();
    expect(await clone.text()).toBe('not JSON');
  });

  it('passes network failures through unchanged', async () => {
    const error = new TypeError('Failed to fetch');
    fetchMock.mockRejectedValue(error);
    await expect(user.getCurrentUser(headers)).rejects.toBe(error);
  });

  it('does not parse an empty arena status', async () => {
    const response = await arena.getStatus(headers);
    expect(response.status).toBe(204);
    expect(response.bodyUsed).toBe(false);
  });

  it('keeps query strings, path ids and limit=0 without normalization', async () => {
    await user.searchUsers('a+b', headers);
    await path.getRoomsMini('7', 0, headers);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `${API_URL}/api/user/search?query=a+b`, `${API_URL}/api/paths/7/rooms-mini?limit=0`,
    ]);
    expect(fetchMock.mock.calls.every(([, options]) => new Headers(options?.headers).get('Authorization') === 'Bearer session-token')).toBe(true);
  });

  it('sends only the rival in challenge requests and no body when joining the queue', async () => {
    await arena.createChallenge({ targetUsername: 'alice' }, jsonHeaders);
    await arena.joinQueue(jsonHeaders);
    expect(fetchMock.mock.calls.map(([, options]) => options?.body)).toEqual(['{"targetUsername":"alice"}', undefined]);
  });

  it('sends a battle answer and a room flag to separate endpoints', async () => {
    await arena.answerQuestion('game-id', 3, 2, jsonHeaders);
    await room.solveRoom(7, { flag: 'flag' }, jsonHeaders);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `${API_URL}/api/arena/game/game-id/answer`, `${API_URL}/api/rooms/7/solve`,
    ]);
    expect(fetchMock.mock.calls.map(([, options]) => options?.body)).toEqual(['{"round":3,"answer":2}', '{"flag":"flag"}']);
  });
});

describe('multipart contracts', () => {
  function readBlob(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsText(blob);
    });
  }

  it.each([false, true])('preserves room parts and leaves the boundary to the browser (editing=%s)', async editing => {
    const file = new File(['attachment'], 'task.txt');
    if (editing) await admin.updateRoom(7, roomData, file, headers);
    else await admin.createRoom(roomData, file, headers);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/api/admin/rooms${editing ? '/7' : ''}`);
    expect(options?.method).toBe(editing ? 'PUT' : 'POST');
    expect(new Headers(options?.headers).get('Authorization')).toBe('Bearer session-token');
    expect(new Headers(options?.headers).has('Content-Type')).toBe(false);
    const form = options?.body;
    if (!(form instanceof FormData)) throw new Error('Missing multipart body');
    expect(form.get('file')).toBe(file);
    const json = form.get('room');
    if (!(json instanceof Blob)) throw new Error('Missing JSON part');
    expect(json.type).toBe('application/json');
    expect(JSON.parse(await readBlob(json))).toEqual(roomData);
  });

  it('omits an absent room file and preserves the banner field name', async () => {
    await admin.createRoom(roomData, null, headers);
    const roomForm = fetchMock.mock.calls[0][1]?.body;
    expect(roomForm instanceof FormData && roomForm.has('file')).toBe(false);
    const file = new File(['image'], 'banner.png');
    await admin.uploadBanner(7, file, headers);
    const [url, options] = fetchMock.mock.calls[1];
    expect(url).toBe(`${API_URL}/api/admin/paths/7/banner`);
    expect(options?.method).toBe('PUT');
    expect(new Headers(options?.headers).get('Authorization')).toBe('Bearer session-token');
    expect(new Headers(options?.headers).has('Content-Type')).toBe(false);
    expect(options?.body instanceof FormData && options.body.get('file')).toBe(file);
  });
});

describe('existing adminApi compatibility', () => {
  it.each([null, 'sessionKey'])('keeps conditional authorization (%s) and JSON results', async sessionKey => {
    fetchMock.mockResolvedValue(Response.json([{ id: 7, username: 'alice' }]));
    expect(await legacyAdmin.getUsers(sessionKey)).toEqual([{ id: 7, username: 'alice' }]);
    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/api/admin/users`, {
      method: 'GET', headers: new Headers({ 'Content-Type': 'application/json', ...(sessionKey ? { Authorization: 'Bearer session-token' } : {}) }), credentials: 'omit', redirect: 'error',
    });
  });

  it('returns undefined for 204', async () => {
    await expect(legacyAdmin.deleteUser(7, 'sessionKey')).resolves.toBeUndefined();
  });

  it.each([
    [JSON.stringify({ message: 'denied' }), 'denied'],
    [JSON.stringify({ reason: 'denied' }), '{"reason":"denied"}'],
    ['not JSON', 'Forbidden'],
  ])('preserves admin error fallback for %s', async (body, expected) => {
    fetchMock.mockResolvedValue(new Response(body, { status: 403, statusText: 'Forbidden' }));
    await expect(legacyAdmin.getUsers('sessionKey')).rejects.toThrow(expected);
  });

  it('shows when an admin may try again after the server limits requests', async () => {
    fetchMock.mockResolvedValue(new Response('busy', { status: 429, headers: { 'Retry-After': '12' } }));
    await expect(legacyAdmin.deleteUser(7, 'sessionKey')).rejects.toThrow('Zbyt wiele żądań. Spróbuj ponownie za 12 s.');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('joins field messages from a validation error', async () => {
    fetchMock.mockResolvedValue(Response.json({ message: 'Validation failed', title: 'Tytuł jest wymagany', points: 'Za mało punktów' }, { status: 400 }));
    await expect(legacyAdmin.getUsers('sessionKey')).rejects.toThrow('Tytuł jest wymagany Za mało punktów');
  });

  it('accepts an empty successful response', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 200 }));
    await expect(legacyAdmin.updatePathChapters(5, 0, [], 'sessionKey')).resolves.toBeUndefined();
  });

  it('sends the whole chapter structure', async () => {
    fetchMock.mockResolvedValue(Response.json({ id: 5, chapters: [] }));
    const chapters = [{ id: null, title: 'Wstęp', roomIds: [1, 2] }];
    await expect(legacyAdmin.updatePathChapters(5, 0, chapters, 'sessionKey')).resolves.toEqual({ id: 5, chapters: [] });
    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/api/admin/paths/5/chapters`, {
      method: 'PUT', body: JSON.stringify({ revision: 0, chapters }),
      headers: new Headers({ 'Content-Type': 'application/json', Authorization: 'Bearer session-token' }), credentials: 'omit', redirect: 'error',
    });
  });

  it('keeps the existing JSON room API alongside multipart submission', async () => {
    await legacyAdmin.createRoom(roomData, 'sessionKey');
    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/api/admin/rooms`, {
      method: 'POST', body: JSON.stringify(roomData),
      headers: new Headers({ 'Content-Type': 'application/json', Authorization: 'Bearer session-token' }), credentials: 'omit', redirect: 'error',
    });
  });
});
