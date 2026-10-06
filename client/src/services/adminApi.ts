import API_URL from '../apiConfig';
import type { ApiId, Role, RoomWriteRequest, RoomAdminDto, RoomAdminSummaryDto, UserAdminView } from '../types/api';

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

    if (!response.ok) {

        const errorData: { message?: unknown } = await response.json().catch(() => ({ message: response.statusText }));
        const errorMessage = errorData.message || JSON.stringify(errorData);
        throw new Error(errorMessage === undefined ? undefined : String(errorMessage));
    }

    if (response.status === 204) {
        return;
    }

    return response.json() as Promise<T>;
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
