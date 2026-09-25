import type { CallRecord, ConnectionStatus } from './call.js';
import type { Friend, FriendRequest } from './friend.js';
import type { User } from './user.js';

export interface ApiEnvelope<T> {
  data: T;
}

export interface HealthResponse {
  ok: boolean;
  version: string;
}

// P3+ REST (미리 고정 — RN 재사용)
export interface SearchUsersResponse {
  users: Pick<User, 'id' | 'username'>[];
}
export interface FriendsResponse {
  friends: Friend[];
}
export interface FriendRequestsResponse {
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
}
export interface CallHistoryResponse {
  calls: CallRecord[];
}

export type { ConnectionStatus };
