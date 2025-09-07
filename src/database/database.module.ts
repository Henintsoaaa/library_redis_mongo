import { Module, Global } from '@nestjs/common';
import { MongoClient, Db } from 'mongodb';

@Global()
@Module({
  providers: [
    {
      provide: 'MONGO_CLIENT',
      useFactory: async (): Promise<Db> => {
        const client = new MongoClient('mongodb://localhost:27017');
        await client.connect();
        return client.db('library_db');
      },
    },
  ],
  exports: ['MONGO_CLIENT'],
})
export class DatabaseModule {}
