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
  private readonly COLLECTION_NAME = 'borrows';
  private readonly DEFAULT_BORROW_DAYS = 14;

  constructor(@Inject('MONGO_CLIENT') private db: Db) {}

  async create(createBorrowingDto: CreateBorrowingDto): Promise<Borrowing> {
    // Convert string IDs to ObjectId
    const userId = new ObjectId(createBorrowingDto.userId);
    const bookId = new ObjectId(createBorrowingDto.bookId);

    const existingBorrow = await this.findActiveByBookId(bookId);
    if (existingBorrow) {
      throw new ConflictException('Book is already borrowed');
    }

    const overdueBooks = await this.findOverdueByUserId(userId);
    if (overdueBooks.length > 0) {
      throw new BadRequestException(
        'User has overdue books. Cannot borrow new books.',
      );
    }

    const borrowDate = createBorrowingDto.borrowDate || new Date();
    const dueDate =
      createBorrowingDto.dueDate || this.calculateDueDate(borrowDate);

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
  ): Promise<Borrowing> {
    if (!ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid borrowing ID');
    }

    const borrowing = await this.findOne(id);

    if (borrowing.status === 'returned') {
      throw new BadRequestException('Book is already returned');
    }

    const returnDate = returnBookDto.returnDate || new Date();
    const updateData: Partial<Borrowing> = {
      returnDate,
      status: 'returned',
    };

    await this.db
      .collection(this.COLLECTION_NAME)
      .updateOne({ _id: new ObjectId(id) }, { $set: updateData });

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

    await this.db
      .collection(this.COLLECTION_NAME)
      .updateOne({ _id: new ObjectId(id) }, { $set: updateBorrowingDto });

    return { ...borrowing, ...updateBorrowingDto };
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
}
