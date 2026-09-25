const TOKEN_KEY = 'cp_access';

export function apiBase(): string {
  return (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_URL ?? 'http://localhost:3000';
}

export function wsBase(): string {
  return (import.meta as unknown as { env: Record<string, string> }).env?.VITE_WS_URL ?? 'ws://localhost:3000/ws';
}

export function wsUrlWithAuth(): string {
  const token = localStorage.getItem(TOKEN_KEY);
  const base = wsBase();
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(t: string | null): void {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(path: string, opts?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts?.body) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${apiBase()}${path}`, {
    credentials: 'include',
    ...opts,
    headers: { ...headers, ...(opts?.headers as Record<string, string> | undefined) },
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `request failed (${r.status})`);
  }
  return r.json() as Promise<T>;
}

export async function getHealth() {
  const r = await fetch(`${apiBase()}/api/health`);
  if (!r.ok) throw new Error(`health ${r.status}`);
  return r.json();
}

// --- Auth ---
export interface AuthPayload {
  data: { user: { id: string; username: string; createdAt?: string }; accessToken: string };
}
export const authApi = {
  // ID/비밀번호 로그인 비활성화 — Google OAuth만 사용
  google: (idToken: string) =>
    api<AuthPayload>('/api/auth/google', { method: 'POST', body: JSON.stringify({ idToken }) }),
  me: () => api<{ data: { user: { id: string; username: string } } }>('/api/auth/me'),
  logout: () => api('/api/auth/logout', { method: 'POST' }),
};

// --- Users ---
export const usersApi = {
  search: (q: string) =>
    api<{ data: { users: { id: string; username: string }[] } }>(`/api/users/search?q=${encodeURIComponent(q)}`),
};

// --- Friends ---
import type { Friend, FriendRequest } from '@carphone/shared';
export const friendsApi = {
  list: () => api<{ data: { friends: Friend[] } }>('/api/friends'),
  requests: () =>
    api<{ data: { incoming: (FriendRequest & { senderName?: string })[]; outgoing: (FriendRequest & { receiverName?: string })[] } }>(
      '/api/friends/requests',
    ),
  send: (username: string) =>
    api('/api/friends/request', { method: 'POST', body: JSON.stringify({ username }) }),
  accept: (id: string) => api(`/api/friends/requests/${id}/accept`, { method: 'POST' }),
  reject: (id: string) => api(`/api/friends/requests/${id}/reject`, { method: 'POST' }),
  remove: (id: string) => api(`/api/friends/${id}`, { method: 'DELETE' }),
};

// --- Calls ---
import type { CallRecord } from '@carphone/shared';
export const callsApi = {
  record: (input: { roomId: string; otherUserId?: string; status?: string; durationSec?: number }) =>
    api('/api/calls', { method: 'POST', body: JSON.stringify(input) }),
  history: () => api<{ data: { calls: CallRecord[] } }>('/api/calls/history'),
};
