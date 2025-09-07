export interface LoginResponse {
  success: boolean;
  message: string;
  sessionId?: string;
  user?: {
    _id: string;
    name: string;
    email: string;
    role: string;
  };
}

export interface Session {
  sessionId: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
}
