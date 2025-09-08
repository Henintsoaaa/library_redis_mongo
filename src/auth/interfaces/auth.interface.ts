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

export interface RegistrationResponse {
  success: boolean;
  message: string;
  sessionId?: string;
  user?: UserResponse;
  role?: string;
}

export interface User {
  _id?: string;
  name: string;
  email: string;
  phone: string;
  password: string;
  role: 'user' | 'librarian' | 'admin';
  membershipDate: Date;
  active: boolean;
}

export interface UserResponse {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: 'user' | 'librarian' | 'admin';
  membershipDate: Date;
  active: boolean;
}
