export class Book {
  _id?: string;
  title: string;
  author: string;
  isbn: string;
  category?: string;
  publishedYear?: number;
  copies?: number;
  availableCopies?: number;
  location?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
