import { ObjectId } from 'mongodb';

export interface User {
  _id?: ObjectId;
  name: string;
  email: string;
  phone: string;
  role: 'user' | 'admin' | 'librarian';
  membershipDate: Date;
  active: boolean;
  password: string;
}

export interface UserResponse {
  _id: ObjectId;
  name: string;
  email: string;
  phone: string;
  role: string;
  membershipDate: Date;
  active: boolean;
}
