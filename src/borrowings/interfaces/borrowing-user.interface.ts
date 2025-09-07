export interface BorrowingUser {
  id: string;
  role: 'admin' | 'librarian' | 'member';
  email: string;
}
