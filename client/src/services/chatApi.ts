import { request } from './http';
import type { ApiId, MessageResponse, ChatMessage } from '../types/api';

export function getMessages(id: ApiId, headers: HeadersInit) {
  return request<ChatMessage[]>(`/api/chat/${id}`, {
    method: 'GET',
    headers,
  });
}

export function sendMessage(id: ApiId, data: { content: string }, headers: HeadersInit) {
  return request<ChatMessage>(`/api/chat/${id}/send`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
}

export function reportMessage(id: ApiId, headers: HeadersInit) {
  return request<MessageResponse>(`/api/chat/message/${id}/report`, {
    method: 'POST',
    headers,
  });
}

