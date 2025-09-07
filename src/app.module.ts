import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { BooksModule } from './books/books.module';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './users/users.module';
import { BorrowingsModule } from './borrowings/borrowings.module';

@Module({
  imports: [RedisModule, DatabaseModule, BooksModule, AuthModule, UsersModule, BorrowingsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
