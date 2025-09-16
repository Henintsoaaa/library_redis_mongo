import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { SearchBooksDto, BookStatus } from './dto/search-books.dto';

@Injectable()
export class BooksService {
  private collection;

  constructor(@Inject('MONGO_CLIENT') private db: Db) {
    this.collection = this.db.collection('books');
  }

  async create(createBookDto: CreateBookDto) {
    const now = new Date();
    const bookData = {
      ...createBookDto,
      createdAt: now,
      updatedAt: now,
    };
    const result = await this.collection.insertOne(bookData);
    return { _id: result.insertedId, ...bookData };
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
      { $set: { ...updateBookDto, updatedAt: new Date() } },
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

  async getBookSpecific() {
    const result = await this.collection.aggregate([
      // 1. On joint avec les livres
      {
        $lookup: {
          from: 'books',
          localField: 'bookId',
          foreignField: '_id',
          as: 'book',
        },
      },
      { $unwind: '$book' },

      // 2. Filtrer : auteur = "Smith", returnDate = null, date = 2025-09-01
      {
        $match: {
          'book.author': 'Smith',
          returnDate: null,
          borrowDate: { $lte: new Date('2025-09-01') },
        },
      },

      // 3. Joindre avec les utilisateurs
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },

      // 4. Projection finale
      {
        $project: {
          _id: 0,
          user: '$user.name',
          borrowedBook: '$book.title',
          borrowDate: 1,
        },
      },
    ]);
    return result;
  }

  async searchBooksAdvanced(searchDto: SearchBooksDto) {
    const {
      title,
      author,
      category,
      publishedYear,
      status,
      isbn,
      location,
      page = 1,
      limit = 10,
    } = searchDto;

    const skip = (page - 1) * limit;

    // Construction du pipeline d'agrégation
    const pipeline: any[] = [];

    // Étape 1: Match sur les critères de base du livre
    const bookMatchConditions: any = {};

    if (title) {
      bookMatchConditions.title = { $regex: title, $options: 'i' };
    }

    if (author) {
      bookMatchConditions.author = { $regex: author, $options: 'i' };
    }

    if (category) {
      bookMatchConditions.category = { $regex: category, $options: 'i' };
    }

    if (publishedYear) {
      bookMatchConditions.publishedYear = publishedYear;
    }

    if (isbn) {
      bookMatchConditions.isbn = { $regex: isbn, $options: 'i' };
    }

    if (location) {
      bookMatchConditions.location = { $regex: location, $options: 'i' };
    }

    if (Object.keys(bookMatchConditions).length > 0) {
      pipeline.push({ $match: bookMatchConditions });
    }

    // Étape 2: Jointure avec les emprunts pour déterminer le statut
    pipeline.push({
      $lookup: {
        from: 'borrowings',
        let: { bookId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$bookId', '$$bookId'] },
              returnDate: null, // Emprunts non retournés
            },
          },
        ],
        as: 'activeBorrowings',
      },
    });

    // Étape 3: Calcul du statut et filtrage selon le statut demandé
    pipeline.push({
      $addFields: {
        borrowedCopies: { $size: '$activeBorrowings' },
        computedStatus: {
          $cond: {
            if: { $gt: [{ $size: '$activeBorrowings' }, 0] },
            then: 'borrowed',
            else: 'available',
          },
        },
      },
    });

    // Filtrage par statut si spécifié
    if (status && status !== BookStatus.ALL) {
      pipeline.push({
        $match: {
          computedStatus: status,
        },
      });
    }

    // Étape 4: Projection des données finales
    pipeline.push({
      $project: {
        _id: 1,
        title: 1,
        author: 1,
        isbn: 1,
        category: 1,
        publishedYear: 1,
        copies: 1,
        availableCopies: {
          $subtract: ['$copies', '$borrowedCopies'],
        },
        location: 1,
        status: '$computedStatus',
        borrowedCopies: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    });

    // Étape 5: Tri par titre
    pipeline.push({ $sort: { title: 1 } });

    // Pipeline pour compter le total
    const countPipeline = [...pipeline, { $count: 'total' }];

    // Pipeline pour récupérer les résultats paginés
    const resultPipeline = [...pipeline, { $skip: skip }, { $limit: limit }];

    // Exécution des requêtes
    const [countResult, books] = await Promise.all([
      this.collection.aggregate(countPipeline).toArray(),
      this.collection.aggregate(resultPipeline).toArray(),
    ]);

    const total = countResult.length > 0 ? countResult[0].total : 0;

    return {
      books,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      searchCriteria: searchDto,
    };
  }
}
