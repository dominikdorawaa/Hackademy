import API_URL from '../apiConfig';
const API_BASE_URL = API_URL + '/api/admin';

const request = async (endpoint, options) => {
    const { token, ...restOptions } = options;
    const headers = {
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
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        const errorMessage = errorData.message || JSON.stringify(errorData);
        throw new Error(errorMessage);
    }

    if (response.status === 204) { // No Content
        return;
    }

    return response.json();
};

export const getUsers = (token) => {
    return request('/users', { method: 'GET', token });
};

export const deleteUser = (id, token) => {
    return request(`/users/${id}`, { method: 'DELETE', token });
};

export const updateUserRole = (id, role, token) => {
    return request(`/users/${id}/role`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ role }),
    });
};

export const createRoom = (roomData, token) => {
    return request('/rooms', {
        method: 'POST',
        token,
        body: JSON.stringify(roomData),
    });
};

export const getRooms = (token) => {
    return request('/../rooms', { method: 'GET', token }); 
};

export const getAllRoomsAdmin = (token) => {
     // Fetch generic list
     return fetch(API_URL + '/api/rooms', {
         headers: { 'Authorization': `Bearer ${token}` }
     }).then(res => res.json());
};

export const getRoomAdmin = (id, token) => {
    return request(`/rooms/${id}`, { method: 'GET', token });
};

export const updateRoom = (id, roomData, token) => {
    return request(`/rooms/${id}`, {
        method: 'PUT',
        token,
        body: JSON.stringify(roomData),
    });
};

export const deleteRoom = (id, token) => {
    return request(`/rooms/${id}`, {
        method: 'DELETE',
        token,
    });
};
