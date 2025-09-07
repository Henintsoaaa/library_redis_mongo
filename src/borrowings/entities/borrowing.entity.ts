import { ObjectId } from 'mongodb';

export class Borrowing {
  _id?: ObjectId;
  userId: ObjectId;
  bookId: ObjectId;
  borrowDate: Date;
  dueDate: Date;
  returnDate?: Date | null;
  status: 'borrowed' | 'returned' | 'overdue';

  constructor(partial: Partial<Borrowing>) {
    Object.assign(this, partial);
  }
}
