import { beforeEach, describe, expect, it, vi } from 'vitest';
import API_URL from '../apiConfig';
import type { RoomWriteRequest } from '../types/api';
import * as auth from './authApi';
import * as user from './userApi';
import * as path from './pathApi';
import * as room from './roomApi';
import * as arena from './arenaApi';
import * as chat from './chatApi';
import * as vpn from './vpnApi';
import * as admin from './adminRequests';
import * as legacyAdmin from './adminApi';

const fetchMock = vi.fn<typeof fetch>();
const headers = { Authorization: 'Bearer test-token' };
const jsonHeaders = { ...headers, 'Content-Type': 'application/json' };
const roomData: RoomWriteRequest = {
  title: 'Room', description: 'Description', difficulty: 'EASY', category: 'Web',
  points: 50, flag: 'flag', requiresVpn: false, roomType: 'CTF', hints: ['hint'],
};

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetchMock);
});

describe('HTTP compatibility', () => {
  it.each([401, 403, 500])('leaves text HTTP %s available to the caller', async status => {
    fetchMock.mockResolvedValue(new Response('original error', { status }));
    const response = await auth.login({ email: 'a', password: 'b' }, jsonHeaders);
    expect(response.ok).toBe(false);
    expect(response.status).toBe(status);
    expect(await response.text()).toBe('original error');
  });

  it('keeps a chat mute error as JSON, including its timestamp', async () => {
    const error = { message: 'User is muted', mutedUntil: '2026-10-06T18:00:00Z' };
    fetchMock.mockResolvedValue(Response.json(error, { status: 403 }));
    const response = await chat.sendMessage('abc', { content: 'hello' }, jsonHeaders);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual(error);
  });

  it('preserves native JSON parse failures and clone behavior for registration fallback', async () => {
    fetchMock.mockResolvedValue(new Response('not JSON'));
    const response = await auth.register({ username: 'alice', email: 'a', password: 'b' }, jsonHeaders);
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

  it('keeps native JSON success responses unread and adds no default headers', async () => {
    const native = Response.json({ token: 'test-token' });
    fetchMock.mockResolvedValue(native);
    const response = await auth.login({ email: 'a', password: 'b' }, { 'Content-Type': 'application/json' });
    expect(response).toBe(native);
    expect(response.bodyUsed).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"email":"a","password":"b"}',
    });
    expect(await response.json()).toEqual({ token: 'test-token' });
  });

  it('keeps query strings, path ids and limit=0 without normalization', async () => {
    await user.searchUsers('a+b', headers);
    await path.getRoomsMini('7', 0, headers);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `${API_URL}/api/user/search?query=a+b`, `${API_URL}/api/paths/7/rooms-mini?limit=0`,
    ]);
    expect(fetchMock.mock.calls.every(([, options]) => options?.headers === headers)).toBe(true);
  });

  it('preserves omission versus false in challenge requests', async () => {
    await arena.createChallenge({ targetUsername: 'alice' }, jsonHeaders);
    await arena.createChallenge({ targetUsername: 'alice', vpnEnabled: false }, jsonHeaders);
    expect(fetchMock.mock.calls.map(([, options]) => options?.body)).toEqual([
      '{"targetUsername":"alice"}', '{"targetUsername":"alice","vpnEnabled":false}',
    ]);
  });

  it('uses distinct arena and training solve endpoints', async () => {
    await arena.solveGame('game-id', { flag: 'flag' }, jsonHeaders);
    await room.solveRoom(7, { flag: 'flag' }, jsonHeaders);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `${API_URL}/api/arena/game/game-id/solve`, `${API_URL}/api/rooms/7/solve`,
    ]);
    expect(fetchMock.mock.calls.every(([, options]) => options?.body === '{"flag":"flag"}')).toBe(true);
  });

  it('keeps file bytes and download headers', async () => {
    fetchMock.mockResolvedValue(new Response('vpn-config', { headers: { 'Content-Disposition': 'attachment; filename="test.ovpn"' } }));
    const response = await vpn.downloadConfig(headers);
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="test.ovpn"');
    expect(await (await response.blob()).text()).toBe('vpn-config');
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
    expect(options?.headers).toEqual(headers);
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
    expect(options?.headers).toEqual(headers);
    expect(options?.body instanceof FormData && options.body.get('file')).toBe(file);
  });
});

describe('existing adminApi compatibility', () => {
  it.each([null, 'token'])('keeps conditional authorization (%s) and JSON results', async token => {
    fetchMock.mockResolvedValue(Response.json([{ id: 7, username: 'alice' }]));
    expect(await legacyAdmin.getUsers(token)).toEqual([{ id: 7, username: 'alice' }]);
    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/api/admin/users`, {
      method: 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  });

  it('returns undefined for 204', async () => {
    await expect(legacyAdmin.deleteUser(7, 'token')).resolves.toBeUndefined();
  });

  it.each([
    [JSON.stringify({ message: 'denied' }), 'denied'],
    [JSON.stringify({ reason: 'denied' }), '{"reason":"denied"}'],
    ['not JSON', 'Forbidden'],
  ])('preserves admin error fallback for %s', async (body, expected) => {
    fetchMock.mockResolvedValue(new Response(body, { status: 403, statusText: 'Forbidden' }));
    await expect(legacyAdmin.getUsers('token')).rejects.toThrow(expected);
  });

  it('joins field messages from a validation error', async () => {
    fetchMock.mockResolvedValue(Response.json({ message: 'Validation failed', title: 'Tytuł jest wymagany', points: 'Za mało punktów' }, { status: 400 }));
    await expect(legacyAdmin.getUsers('token')).rejects.toThrow('Tytuł jest wymagany Za mało punktów');
  });

  it('accepts an empty successful response', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 200 }));
    await expect(legacyAdmin.updatePathChapters(5, 0, [], 'token')).resolves.toBeUndefined();
  });

  it('sends the whole chapter structure', async () => {
    fetchMock.mockResolvedValue(Response.json({ id: 5, chapters: [] }));
    const chapters = [{ id: null, title: 'Wstęp', roomIds: [1, 2] }];
    await expect(legacyAdmin.updatePathChapters(5, 0, chapters, 'token')).resolves.toEqual({ id: 5, chapters: [] });
    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/api/admin/paths/5/chapters`, {
      method: 'PUT', body: JSON.stringify({ revision: 0, chapters }),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
    });
  });

  it('keeps the existing JSON room API alongside multipart submission', async () => {
    await legacyAdmin.createRoom(roomData, 'token');
    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/api/admin/rooms`, {
      method: 'POST', body: JSON.stringify(roomData),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
    });
  });
});
