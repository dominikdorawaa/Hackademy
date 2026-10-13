import { afterEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import API_URL from '../apiConfig';
import { server } from '../test/mocks/server';
import { ContentError, contentRequest, savePath, saveRoom } from './contentApi';

const path = { revision: 1, chaptersRevision: 2, title: 'Draft', description: '', bannerUrl: null, published: false, chapters: [], unlockMode: 'CHAPTER' as const };
const room = { revision: 1, tasksRevision: 2, title: 'Draft', description: '', shortDescription: '', category: 'Web', difficulty: 'EASY' as const, points: 50,
  flag: '', requiresVpn: false, roomType: 'CTF' as const, published: false, hints: [], tasks: [] };

afterEach(() => vi.restoreAllMocks());
function readJson(blob: Blob): Promise<unknown> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(JSON.parse(String(reader.result))); reader.onerror = reject; reader.readAsText(blob); });
}

describe('content API contracts', () => {
  it('sends multipart path creation and updates with status, structure, revision and upload intact', async () => {
    const transport = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => HttpResponse.json({ id: 3 }));
    const file = new File(['image'], 'banner.png', { type: 'image/png' });
    await savePath(null, path, file, 'test-token'); await savePath(3, { ...path, published: true }, null, 'test-token');
    expect(transport.mock.calls.map(c => [c[0], c[1]?.method])).toEqual([[`${API_URL}/api/admin/content/paths`, 'POST'], [`${API_URL}/api/admin/content/paths/3`, 'PUT']]);
    const first = transport.mock.calls[0][1]?.body as FormData, second = transport.mock.calls[1][1]?.body as FormData;
    expect(await readJson(first.get('content') as Blob)).toEqual(path); expect(first.get('file')).toBe(file);
    expect(await readJson(second.get('content') as Blob)).toEqual({ ...path, published: true }); expect(second.has('file')).toBe(false);
    expect(transport.mock.calls[0][1]?.headers).toEqual({ Authorization: 'Bearer test-token' });
  });
  it('sends room creation context and edited tasks together and preserves field errors on failure', async () => {
    const transport = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(HttpResponse.json({ room: { id: 5 }, tasks: { revision: 1, tasks: [] } }))
      .mockResolvedValueOnce(HttpResponse.json({ message: 'Conflict', fields: { title: 'Duplicate' } }, { status: 409 }));
    const request = { ...room, roomType: 'PATH' as const, pathId: 3, chapterId: 4, pathRevision: 2, tasks: [{ id: 7, title: 'Task', content: '', question: null, answer: null }] };
    await saveRoom(null, request, null, 'test-token');
    expect(await readJson((transport.mock.calls[0][1]?.body as FormData).get('content') as Blob)).toEqual(request);
    await expect(saveRoom(5, room, null, 'test-token')).rejects.toMatchObject({ message: 'Conflict', fields: { title: 'Duplicate' } });
  });
  it('reports a useful failure when the API returns only detail or no message', async () => {
    server.use(http.get(`${API_URL}/api/admin/content/detail`, () => HttpResponse.json({ detail: 'Failed detail' }, { status: 400 })),
      http.get(`${API_URL}/api/admin/content/empty`, () => HttpResponse.json({}, { status: 500 })));
    await expect(contentRequest('/detail', null)).rejects.toMatchObject({ message: 'Failed detail', fields: {} });
    await expect(contentRequest('/empty', null)).rejects.toBeInstanceOf(ContentError);
  });
});
