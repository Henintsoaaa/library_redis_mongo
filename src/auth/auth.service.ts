import {
  Injectable,
  UnauthorizedException,
  Inject,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import Redis from 'ioredis';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { Db } from 'mongodb';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UsersService } from '../users/users.service';
import { LoginResponse } from './interfaces/auth.interface';
import { UserResponse } from './interfaces/user.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly SESSION_EXPIRY = 24 * 60 * 60; // 24 hours in seconds

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    @Inject('MONGO_CLIENT') private readonly db: Db,
    private readonly UsersService: UsersService,
  ) {}

  async register(registerDto: RegisterDto): Promise<UserResponse> {
    try {
      return await this.UsersService.create(registerDto);
    } catch (error) {
      this.logger.error(`Registration failed: ${error.message}`);
      throw error;
    }
  }

  async login(loginDto: LoginDto): Promise<LoginResponse> {
    const { email, password } = loginDto;

    try {
      // Find user by email
      const user = await this.UsersService.findByEmail(email);
      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Check if user is active
      if (!user.active) {
        throw new UnauthorizedException('Account is deactivated');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Generate session
      const sessionId = randomUUID();
      const sessionData = {
        userId: user._id?.toString() || '',
        email: user.email,
        role: user.role,
        createdAt: new Date().toISOString(),
      };

      // Store session in Redis
      await this.redis.setex(
        `session:${sessionId}`,
        this.SESSION_EXPIRY,
        JSON.stringify(sessionData),
      );

      this.logger.log(`User ${email} logged in successfully`);

      return {
        success: true,
        message: 'Login successful',
        sessionId,
        user: {
          _id: user._id?.toString() || '',
          name: user.name,
          email: user.email,
          role: user.role,
        },
      };
    } catch (error) {
      this.logger.error(`Login failed for ${email}: ${error.message}`);

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new BadRequestException('Login failed');
    }
  }

  async validateSession(sessionId: string): Promise<UserResponse | null> {
    try {
      const sessionData = await this.redis.get(`session:${sessionId}`);

      if (!sessionData) {
        return null;
      }

      const session = JSON.parse(sessionData);
      const user = await this.UsersService.findById(session.userId);

      if (!user || !user.active) {
        // Clean up invalid session
        await this.redis.del(`session:${sessionId}`);
        return null;
      }

      // Extend session expiry on each validation
      await this.redis.expire(`session:${sessionId}`, this.SESSION_EXPIRY);

      return user;
    } catch (error) {
      this.logger.error(`Session validation failed: ${error.message}`);
      return null;
    }
  }

  async logout(
    sessionId: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const deleted = await this.redis.del(`session:${sessionId}`);

      if (deleted === 1) {
        this.logger.log(`Session ${sessionId} logged out successfully`);
        return { success: true, message: 'Logged out successfully' };
      }

      return { success: false, message: 'Session not found' };
    } catch (error) {
      this.logger.error(`Logout failed: ${error.message}`);
      throw new BadRequestException('Logout failed');
    }
  }

  async logoutAll(
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const pattern = 'session:*';
      const keys = await this.redis.keys(pattern);

      let deletedCount = 0;

      for (const key of keys) {
        const sessionData = await this.redis.get(key);
        if (sessionData) {
          const session = JSON.parse(sessionData);
          if (session.userId === userId) {
            await this.redis.del(key);
            deletedCount++;
          }
        }
      }

      this.logger.log(`Logged out ${deletedCount} sessions for user ${userId}`);
      return {
        success: true,
        message: `Logged out from ${deletedCount} devices`,
      };
    } catch (error) {
      this.logger.error(`Logout all failed: ${error.message}`);
      throw new BadRequestException('Logout from all devices failed');
    }
  }

  async getActiveSessions(userId: string): Promise<number> {
    try {
      const pattern = 'session:*';
      const keys = await this.redis.keys(pattern);

      let activeCount = 0;

      for (const key of keys) {
        const sessionData = await this.redis.get(key);
        if (sessionData) {
          const session = JSON.parse(sessionData);
          if (session.userId === userId) {
            activeCount++;
          }
        }
      }

      return activeCount;
    } catch (error) {
      this.logger.error(`Get active sessions failed: ${error.message}`);
      return 0;
    }
  }
}
