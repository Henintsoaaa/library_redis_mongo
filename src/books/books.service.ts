import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';

@Injectable()
export class BooksService {
  private collection;

  constructor(@Inject('MONGO_CLIENT') private db: Db) {
    this.collection = this.db.collection('books');
  }

  async create(createBookDto: CreateBookDto) {
    const result = await this.collection.insertOne(createBookDto);
    return { _id: result.insertedId, ...createBookDto };
  }

  async findAll(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    const total = await this.collection.countDocuments();
    const books = await this.collection
      .find()
      .skip(skip)
      .limit(limit)
      .toArray();

    return {
      books,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const book = await this.collection.findOne({ _id: new ObjectId(id) });
    if (!book) throw new NotFoundException('Book not found');
    return book;
  }

  async update(id: string, updateBookDto: UpdateBookDto) {
    console.log('Updating book with id:', id);
    const result = await this.collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateBookDto },
      { returnDocument: 'after' },
    );

    if (!result) throw new NotFoundException('Book not found');
    return result;
  }

  async remove(id: string) {
    const result = await this.collection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0)
      throw new NotFoundException('Book not found');
    return { deleted: true };
  }
}
