import {
  Injectable,
  Inject,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';
import * as bcrypt from 'bcrypt';
import { User, UserResponse } from '../auth/interfaces/user.interface';
import { RegisterDto } from '../auth/dto/register.dto';

@Injectable()
export class UsersService {
  constructor(@Inject('MONGO_CLIENT') private readonly db: Db) {}

  async create(registerDto: RegisterDto): Promise<UserResponse> {
    const { name, email, phone, password, role = 'user' } = registerDto;

    const existingUser = await this.db.collection('users').findOne({ email });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const user: User = {
      name,
      email,
      phone,
      role,
      membershipDate: new Date(),
      active: true,
      password: hashedPassword,
    };

    const result = await this.db.collection('users').insertOne(user);

    const createdUser = await this.findById(result.insertedId.toString());
    if (!createdUser) {
      throw new Error('Failed to create user');
    }

    return createdUser;
  }

  async findById(userId: string): Promise<UserResponse | null> {
    try {
      const user = await this.db
        .collection('users')
        .findOne(
          { _id: new ObjectId(userId) },
          { projection: { password: 0 } },
        );

      if (!user) {
        return null;
      }

      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        membershipDate: user.membershipDate,
        active: user.active,
      };
    } catch (error) {
      return null;
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.db.collection('users').findOne({ email });
    return user as User | null;
  }

  async updateUser(
    userId: string,
    updateData: Partial<User>,
  ): Promise<UserResponse> {
    // If password is being updated, hash it
    if (updateData.password) {
      const saltRounds = 10;
      updateData.password = await bcrypt.hash(updateData.password, saltRounds);
    }

    // If email is being updated, check for conflicts
    if (updateData.email) {
      const existingUser = await this.db.collection('users').findOne({
        email: updateData.email,
        _id: { $ne: new ObjectId(userId) },
      });
      if (existingUser) {
        throw new ConflictException('Email already exists');
      }
    }

    const result = await this.db
      .collection('users')
      .updateOne({ _id: new ObjectId(userId) }, { $set: updateData });

    if (result.matchedCount === 0) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.findById(userId);
    if (!updatedUser) {
      throw new NotFoundException('User not found after update');
    }

    return updatedUser;
  }

  async deactivateUser(userId: string): Promise<void> {
    await this.updateUser(userId, { active: false });
  }

  async activateUser(userId: string): Promise<void> {
    await this.updateUser(userId, { active: true });
  }

  async findAll(): Promise<UserResponse[]> {
    const users = await this.db
      .collection('users')
      .find({}, { projection: { password: 0 } })
      .toArray();
    return users as UserResponse[];
  }

  async remove(userId: string): Promise<void> {
    const result = await this.db
      .collection('users')
      .deleteOne({ _id: new ObjectId(userId) });

    if (result.deletedCount === 0) {
      throw new NotFoundException('User not found');
    }
  }
}
