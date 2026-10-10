import API_URL from '../apiConfig';
import type {
    ApiId,
    ChapterRequest,
    PathAdminDetailDto,
    Role,
    RoomAdminDto,
    RoomAdminSummaryDto,
    RoomWriteRequest,
    UserAdminView,
} from '../types/api';

interface AdminRequestOptions extends Omit<RequestInit, 'headers'> {
    token: string | null;
    headers?: Record<string, string>;
}
const API_BASE_URL = API_URL + '/api/admin';

const request = async <T>(endpoint: string, options: AdminRequestOptions): Promise<T | undefined> => {
    const { token, ...restOptions } = options;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...restOptions,
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

export const getUsers = (token: string | null) => {
    return request<UserAdminView[]>('/users', { method: 'GET', token });
};

export const deleteUser = (id: ApiId, token: string | null) => {
    return request<void>(`/users/${id}`, { method: 'DELETE', token });
};

export const updateUserRole = (id: ApiId, role: Role, token: string | null) => {
    return request<UserAdminView>(`/users/${id}/role`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ role }),
    });
};

export const createRoom = (roomData: RoomWriteRequest, token: string | null) => {
    return request<RoomAdminDto>('/rooms', {
        method: 'POST',
        token,
        body: JSON.stringify(roomData),
    });
};

export const getRooms = (token: string | null) => {
    return request<RoomAdminSummaryDto[]>('/rooms', { method: 'GET', token });
};

export const getAllRoomsAdmin = (token: string | null) => {

     return request<RoomAdminSummaryDto[]>('/rooms', { method: 'GET', token });
};

export const getRoomAdmin = (id: ApiId, token: string | null) => {
    return request<RoomAdminDto>(`/rooms/${id}`, { method: 'GET', token });
};

export const updateRoom = (id: ApiId, roomData: RoomWriteRequest, token: string | null) => {
    return request<RoomAdminDto>(`/rooms/${id}`, {
        method: 'PUT',
        token,
        body: JSON.stringify(roomData),
    });
};

export const deleteRoom = (id: ApiId, token: string | null) => {
    return request<void>(`/rooms/${id}`, {
        method: 'DELETE',
        token,
    });
};

export const getPath = (id: ApiId, token: string | null) => {
    return request<PathAdminDetailDto>(`/paths/${id}`, { method: 'GET', token });
};

export const updatePathChapters = (id: ApiId, revision: number, chapters: ChapterRequest[], token: string | null) => {
    return request<PathAdminDetailDto>(`/paths/${id}/chapters`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ revision, chapters }),
    });
};
