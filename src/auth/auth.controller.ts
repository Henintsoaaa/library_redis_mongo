import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  HttpStatus,
  HttpCode,
  Res,
  Req,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';
import type { UserResponse } from './interfaces/user.interface';

@Controller('auth')
@UseGuards(AuthGuard, RolesGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly UsersService: UsersService,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.register(registerDto);

    // Set session cookie for browser clients
    if (result.sessionId) {
      response.cookie('sessionId', result.sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });
    }

    return {
      success: true,
      message: 'User registered successfully',
      access_token: result.sessionId, // Use sessionId as access_token for frontend compatibility
      user: {
        id: result.user?._id || '',
        name: result.user?.name || '',
        email: result.user?.email || '',
        phone: result.user?.phone || '',
        role: result.user?.role || 'user',
        membershipDate: result.user?.membershipDate?.toISOString(),
        active: result.user?.active,
      },
    };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(loginDto);

    // Set session cookie (optional, for browser clients)
    if (result.sessionId) {
      response.cookie('sessionId', result.sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });
    }

    return {
      success: true,
      message: 'Login successful',
      access_token: result.sessionId, // Use sessionId as access_token for frontend compatibility
      user: {
        id: result.user?._id || '',
        name: result.user?.name || '',
        email: result.user?.email || '',
        role: result.user?.role || 'user',
      },
    };
  }

  @Get('profile')
  async getProfile(@CurrentUser() user: UserResponse) {
    return {
      success: true,
      user: {
        id: user._id?.toString() || '',
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        membershipDate: user.membershipDate?.toISOString(),
        active: user.active,
      },
    };
  }

  @Get('me')
  async getCurrentUser(@CurrentUser() user: UserResponse) {
    return {
      id: user._id?.toString() || '',
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      membershipDate: user.membershipDate?.toISOString(),
      active: user.active,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const sessionId =
      (request.headers['x-session-id'] as string) || request.cookies?.sessionId;

    if (sessionId) {
      const result = await this.authService.logout(sessionId);

      // Clear session cookie
      response.clearCookie('sessionId');

      return result;
    }

    return { success: false, message: 'No active session found' };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @CurrentUser() user: UserResponse,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.logoutAll(user._id.toString());

    // Clear current session cookie
    response.clearCookie('sessionId');

    return result;
  }

  @Get('sessions')
  async getActiveSessions(@CurrentUser() user: UserResponse) {
    const activeCount = await this.authService.getActiveSessions(
      user._id.toString(),
    );

    return {
      success: true,
      activeSessions: activeCount,
    };
  }

  @Roles('admin')
  @Get('users')
  async getAllUsers() {
    // This is an admin-only endpoint
    return {
      success: true,
      message: 'Admin access granted',
    };
  }

  @Post('deactivate')
  @Roles('admin')
  async deactivateUser(@Body() body: { userId: string }) {
    await this.UsersService.deactivateUser(body.userId);
    return {
      success: true,
      message: 'User deactivated successfully',
    };
  }

  @Post('activate')
  @Roles('admin')
  async activateUser(@Body() body: { userId: string }) {
    await this.UsersService.activateUser(body.userId);
    return {
      success: true,
      message: 'User activated successfully',
    };
  }
}
