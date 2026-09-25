export interface User {
  id: string;
  username: string;
  createdAt: string;
}

export interface AuthSession {
  user: User;
  accessToken: string;
}
