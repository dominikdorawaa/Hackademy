import { request as apiRequest } from './http';
import type {
    AdminStatsDto,
    ApiId,
    ChapterRequest,
    ChatMessage,
    CreatePathRequest,
    PathAdminDetailDto,
    PathMetaRequest,
    PathSummaryDto,
    Role,
    RoomAdminDto,
    RoomAdminSummaryDto,
    RoomTasksAdminDto,
    RoomTaskRequest,
    RoomWriteRequest,
    StatsRange,
    UserAdminView,
} from '../types/api';

interface AdminRequestOptions extends Omit<RequestInit, 'headers'> {
    sessionKey: string | null;
    headers?: Record<string, string>;
}
const API_BASE_URL = '/api/admin';
export interface PageResult<T> { items: T[]; page: number; size: number; hasNext: boolean }
const normalizePage = <T>(data: PageResult<T> | T[] | undefined, page: number): PageResult<T> =>
    Array.isArray(data) ? { items: data, page, size: data.length, hasNext: false } : data ?? { items: [], page, size: 50, hasNext: false };

export async function getUsersPage(sessionKey: string | null, page = 0, query = '') {
    return normalizePage(await request<PageResult<UserAdminView>>('/users?page=' + page + '&size=50&query=' + encodeURIComponent(query), { method: 'GET', sessionKey }), page);
}

export async function getReportsPage(sessionKey: string | null, page = 0) {
    return normalizePage(await request<PageResult<ChatMessage>>('/reports?page=' + page + '&size=50', { method: 'GET', sessionKey }), page);
}

const request = async <T>(endpoint: string, options: AdminRequestOptions): Promise<T | undefined> => {
    const { sessionKey, ...restOptions } = options;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    const response = await apiRequest(`${API_BASE_URL}${endpoint}`, {
        ...restOptions,
        auth: { sessionKey },
        headers,
    });

    return readResponse<T>(response);
};

const errorMessageFrom = (errorData: Record<string, unknown>) => {
    if (errorData.message === 'Validation failed') {
        const details = Object.entries(errorData)
            .filter(([key, value]) => key !== 'message' && typeof value === 'string')
            .map(([, value]) => value as string);
        if (details.length > 0) return details.join(' ');
    }
    return errorData.message || JSON.stringify(errorData);
};

export const readResponse = async <T>(response: Response): Promise<T | undefined> => {
    if (!response.ok) {
        const errorData: Record<string, unknown> = await response.json().catch(() => ({ message: response.statusText }));
        const errorMessage = errorMessageFrom(errorData);
        throw new Error(errorMessage === undefined ? undefined : String(errorMessage));
    }

    if (response.status === 204) {
        return;
    }

    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T | undefined;
};

export const getUsers = (sessionKey: string | null) => {
    return request<PageResult<UserAdminView> | UserAdminView[]>('/users', { method: 'GET', sessionKey }).then(data => normalizePage(data, 0).items);
};

export const deleteUser = (id: ApiId, sessionKey: string | null) => {
    return request<void>(`/users/${id}`, { method: 'DELETE', sessionKey });
};

export const updateUserRole = (id: ApiId, role: Role, sessionKey: string | null) => {
    return request<UserAdminView>(`/users/${id}/role`, {
        method: 'PUT',
        sessionKey,
        body: JSON.stringify({ role }),
    });
};

export const createRoom = (roomData: RoomWriteRequest, sessionKey: string | null) => {
    return request<RoomAdminDto>('/rooms', {
        method: 'POST',
        sessionKey,
        body: JSON.stringify(roomData),
    });
};

export const getRooms = (sessionKey: string | null) => {
    return request<RoomAdminSummaryDto[]>('/rooms', { method: 'GET', sessionKey });
};

export const getAllRoomsAdmin = (sessionKey: string | null) => {

     return request<RoomAdminSummaryDto[]>('/rooms', { method: 'GET', sessionKey });
};

export const getRoomAdmin = (id: ApiId, sessionKey: string | null) => {
    return request<RoomAdminDto>(`/rooms/${id}`, { method: 'GET', sessionKey });
};

export const updateRoom = (id: ApiId, roomData: RoomWriteRequest, sessionKey: string | null) => {
    return request<RoomAdminDto>(`/rooms/${id}`, {
        method: 'PUT',
        sessionKey,
        body: JSON.stringify(roomData),
    });
};

export const deleteRoom = (id: ApiId, sessionKey: string | null) => {
    return request<void>(`/rooms/${id}`, {
        method: 'DELETE',
        sessionKey,
    });
};

export const getStats = (range: StatsRange, sessionKey: string | null) => {
    return request<AdminStatsDto>(`/stats?range=${range}`, { method: 'GET', sessionKey });
};

export const getPaths = (sessionKey: string | null) => {
    return request<PathSummaryDto[]>('/paths', { method: 'GET', sessionKey });
};

export const getPath = (id: ApiId, sessionKey: string | null) => {
    return request<PathAdminDetailDto>(`/paths/${id}`, { method: 'GET', sessionKey });
};

export const createPath = (data: CreatePathRequest, sessionKey: string | null) => {
    return request<PathSummaryDto>('/paths', {
        method: 'POST',
        sessionKey,
        body: JSON.stringify(data),
    });
};

export const updatePath = (id: ApiId, data: PathMetaRequest, sessionKey: string | null) => {
    return request<void>(`/paths/${id}`, {
        method: 'PUT',
        sessionKey,
        body: JSON.stringify(data),
    });
};

export const updatePathChapters = (id: ApiId, revision: number, chapters: ChapterRequest[], sessionKey: string | null) => {
    return request<PathAdminDetailDto>(`/paths/${id}/chapters`, {
        method: 'PUT',
        sessionKey,
        body: JSON.stringify({ revision, chapters }),
    });
};

export const deletePath = (id: ApiId, sessionKey: string | null) => {
    return request<void>(`/paths/${id}`, { method: 'DELETE', sessionKey });
};

export const getRoomTasks = (id: ApiId, sessionKey: string | null) => {
    return request<RoomTasksAdminDto>(`/rooms/${id}/tasks`, { method: 'GET', sessionKey });
};

export const updateRoomTasks = (id: ApiId, revision: number, tasks: RoomTaskRequest[], sessionKey: string | null) => {
    return request<RoomTasksAdminDto>(`/rooms/${id}/tasks`, {
        method: 'PUT',
        sessionKey,
        body: JSON.stringify({ revision, tasks }),
    });
};

export const getReports = (sessionKey: string | null) => {
    return request<PageResult<ChatMessage> | ChatMessage[]>('/reports', { method: 'GET', sessionKey }).then(data => normalizePage(data, 0).items);
};

export const deleteReport = (id: ApiId, sessionKey: string | null) => {
    return request<void>(`/reports/${id}`, { method: 'DELETE', sessionKey });
};

export const dismissReport = (id: ApiId, sessionKey: string | null) => {
    return request<void>(`/reports/${id}/dismiss`, { method: 'POST', sessionKey });
};

export const muteUser = (id: ApiId, duration: number, sessionKey: string | null) => {
    return request<void>(`/users/${id}/mute`, {
        method: 'POST',
        sessionKey,
        body: JSON.stringify({ duration }),
    });
};
