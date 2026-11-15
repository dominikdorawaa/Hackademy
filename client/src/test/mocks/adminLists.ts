import { http, HttpResponse } from 'msw';
import API_URL from '../../apiConfig';
import type { PathSummaryDto, RoomAdminSummaryDto } from '../../types/api';

const pageOf = <T>(items: T[], url: URL) => {
  const page = Number(url.searchParams.get('page') ?? 0);
  const size = Number(url.searchParams.get('size') ?? 50);
  return { items: items.slice(page * size, (page + 1) * size), page, size, hasNext: items.length > (page + 1) * size };
};

export function roomsPageHandler(rooms: RoomAdminSummaryDto[], requests: URL[] = []) {
  return http.get(`${API_URL}/api/admin/rooms`, ({ request }) => {
    const url = new URL(request.url);
    requests.push(url);
    const term = (url.searchParams.get('query') ?? '').toLowerCase();
    const type = url.searchParams.get('type');
    const matching = rooms.filter((room) => room.title.toLowerCase().includes(term) || room.paths.some((path) => path.title.toLowerCase().includes(term)));
    const counts = { PATH: matching.filter((room) => room.roomType === 'PATH').length, CTF: matching.filter((room) => room.roomType === 'CTF').length };
    return HttpResponse.json({ ...pageOf(matching.filter((room) => !type || room.roomType === type), url), counts });
  });
}

export function pathsPageHandler(paths: PathSummaryDto[], requests: URL[] = []) {
  return http.get(`${API_URL}/api/admin/paths`, ({ request }) => {
    const url = new URL(request.url);
    requests.push(url);
    const term = (url.searchParams.get('query') ?? '').toLowerCase();
    return HttpResponse.json(pageOf(paths.filter((path) => path.title.toLowerCase().includes(term)), url));
  });
}
