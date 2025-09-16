import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';
import { CreateBorrowingDto } from './dto/create-borrowing.dto';
import { UpdateBorrowingDto } from './dto/update-borrowing.dto';
import { ReturnBookDto } from './dto/return-book.dto';
import { Borrowing } from './entities/borrowing.entity';

@Injectable()
export class BorrowingsService {
  private readonly COLLECTION_NAME = 'borrowings';
  private readonly DEFAULT_BORROW_DAYS = 14;

  constructor(@Inject('MONGO_CLIENT') private db: Db) {}

  async create(
    createBorrowingDto: CreateBorrowingDto,
    currentUser?: any,
  ): Promise<Borrowing> {
    // Convert string IDs to ObjectId
    const userId = new ObjectId(createBorrowingDto.userId);
    const bookId = new ObjectId(createBorrowingDto.bookId);

    // Check if user is authorized to borrow for this userId
    if (
      currentUser &&
      currentUser.role !== 'admin' &&
      currentUser.role !== 'librarian' &&
      currentUser._id.toString() !== createBorrowingDto.userId
    ) {
      throw new BadRequestException('You can only borrow books for yourself');
    }

    // Get the book to check copies
    const book = await this.db.collection('books').findOne({ _id: bookId });
    if (!book) {
      throw new NotFoundException('Book not found');
    }

    // Count active borrows for this book
    const activeBorrowsCount = await this.db
      .collection(this.COLLECTION_NAME)
      .countDocuments({
        bookId,
        status: { $in: ['borrowed', 'overdue'] },
      });

    if (activeBorrowsCount >= (book.copies || 0)) {
      throw new ConflictException('No copies available for borrowing');
    }

    const overdueBooks = await this.findOverdueByUserId(userId);
    if (overdueBooks.length > 0) {
      throw new BadRequestException(
        'User has overdue books. Cannot borrow new books.',
      );
    }

    const borrowDate = createBorrowingDto.borrowDate
      ? new Date(createBorrowingDto.borrowDate)
      : new Date();
    const dueDate = createBorrowingDto.dueDate
      ? new Date(createBorrowingDto.dueDate)
      : this.calculateDueDate(borrowDate);

    const borrowing = new Borrowing({
      userId,
      bookId,
      borrowDate,
      dueDate,
      returnDate: null,
      status: 'borrowed',
    });

    const result = await this.db
      .collection(this.COLLECTION_NAME)
      .insertOne(borrowing);

    // Decrement book copies and availableCopies
    await this.db
      .collection('books')
      .updateOne(
        { _id: bookId },
        { $inc: { copies: -1, availableCopies: -1 } },
      );

    return { ...borrowing, _id: result.insertedId };
  }

  async findAll(): Promise<Borrowing[]> {
    const borrowings = await this.db
      .collection(this.COLLECTION_NAME)
      .find({})
      .sort({ borrowDate: -1 })
      .toArray();

    return borrowings.map((b) => new Borrowing(b));
  }

  async findOne(id: string): Promise<Borrowing> {
    if (!ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid borrowing ID');
    }

    const borrowing = await this.db
      .collection(this.COLLECTION_NAME)
      .findOne({ _id: new ObjectId(id) });

    if (!borrowing) {
      throw new NotFoundException('Borrowing not found');
    }

    return new Borrowing(borrowing);
  }

  async findByUserId(userId: string): Promise<Borrowing[]> {
    if (!ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const borrowings = await this.db
      .collection(this.COLLECTION_NAME)
      .find({ userId: new ObjectId(userId) })
      .sort({ borrowDate: -1 })
      .toArray();

    return borrowings.map((b) => new Borrowing(b));
  }

  async findActiveByUserId(userId: string): Promise<Borrowing[]> {
    if (!ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const borrowings = await this.db
      .collection(this.COLLECTION_NAME)
      .find({
        userId: new ObjectId(userId),
        status: { $in: ['borrowed', 'overdue'] },
      })
      .sort({ borrowDate: -1 })
      .toArray();

    return borrowings.map((b) => new Borrowing(b));
  }

  async findOverdueByUserId(userId: ObjectId): Promise<Borrowing[]> {
    const borrowings = await this.db
      .collection(this.COLLECTION_NAME)
      .find({
        userId,
        status: 'borrowed',
        dueDate: { $lt: new Date() },
      })
      .toArray();

    return borrowings.map((b) => new Borrowing(b));
  }

  async findActiveByBookId(bookId: ObjectId): Promise<Borrowing | null> {
    const borrowing = await this.db.collection(this.COLLECTION_NAME).findOne({
      bookId,
      status: { $in: ['borrowed', 'overdue'] },
    });

    return borrowing ? new Borrowing(borrowing) : null;
  }

  async returnBook(
    id: string,
    returnBookDto: ReturnBookDto,
    currentUser?: any,
  ): Promise<Borrowing> {
    if (!ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid borrowing ID');
    }

    const borrowing = await this.findOne(id);

    // Check if user is authorized to return this book
    if (
      currentUser &&
      currentUser.role === 'user' &&
      borrowing.userId.toString() !== currentUser._id.toString()
    ) {
      throw new BadRequestException('You can only return your own books');
    }

    if (borrowing.status === 'returned') {
      throw new BadRequestException('Book is already returned');
    }

    const returnDate = returnBookDto.returnDate
      ? new Date(returnBookDto.returnDate)
      : new Date();
    const updateData: Partial<Borrowing> = {
      returnDate,
      status: 'returned',
    };

    await this.db
      .collection(this.COLLECTION_NAME)
      .updateOne({ _id: new ObjectId(id) }, { $set: updateData });

    // Increment book copies and availableCopies
    await this.db
      .collection('books')
      .updateOne(
        { _id: borrowing.bookId },
        { $inc: { copies: 1, availableCopies: 1 } },
      );

    return { ...borrowing, ...updateData };
  }

  async update(
    id: string,
    updateBorrowingDto: UpdateBorrowingDto,
  ): Promise<Borrowing> {
    if (!ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid borrowing ID');
    }

    const borrowing = await this.findOne(id);

    // Prepare update data with proper type conversion
    const updateData: any = {};
    if (updateBorrowingDto.returnDate) {
      updateData.returnDate = new Date(updateBorrowingDto.returnDate);
    }
    if (updateBorrowingDto.status) {
      updateData.status = updateBorrowingDto.status;
    }

    await this.db
      .collection(this.COLLECTION_NAME)
      .updateOne({ _id: new ObjectId(id) }, { $set: updateData });

    return { ...borrowing, ...updateData };
  }

  async markOverdue(): Promise<number> {
    const result = await this.db.collection(this.COLLECTION_NAME).updateMany(
      {
        status: 'borrowed',
        dueDate: { $lt: new Date() },
      },
      { $set: { status: 'overdue' } },
    );

    return result.modifiedCount;
  }

  async getOverdueBooks(): Promise<Borrowing[]> {
    const borrowings = await this.db
      .collection(this.COLLECTION_NAME)
      .find({ status: 'overdue' })
      .sort({ dueDate: 1 })
      .toArray();

    return borrowings.map((b) => new Borrowing(b));
  }

  async getBorrowingStats() {
    const pipeline = [
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ];

    const stats = await this.db
      .collection(this.COLLECTION_NAME)
      .aggregate(pipeline)
      .toArray();

    return {
      total: await this.db.collection(this.COLLECTION_NAME).countDocuments(),
      byStatus: stats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
    };
  }

  async remove(id: string): Promise<void> {
    if (!ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid borrowing ID');
    }

    const result = await this.db
      .collection(this.COLLECTION_NAME)
      .deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      throw new NotFoundException('Borrowing not found');
    }
  }

  private calculateDueDate(borrowDate: Date): Date {
    const dueDate = new Date(borrowDate);
    dueDate.setDate(dueDate.getDate() + this.DEFAULT_BORROW_DAYS);
    return dueDate;
  }

  async getSpecific() {
    const result = await this.db
      .collection(this.COLLECTION_NAME)
      .find({})
      .toArray();
    return result;
  }
}
