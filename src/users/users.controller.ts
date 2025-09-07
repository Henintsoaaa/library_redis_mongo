import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserResponse } from '../auth/interfaces/user.interface';

@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin', 'librarian')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto);
    return {
      success: true,
      message: 'User created successfully',
      user,
    };
  }

  @Get()
  async findAll() {
    const users = await this.usersService.findAll();
    return {
      success: true,
      users,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) {
      return {
        success: false,
        message: 'User not found',
      };
    }
    return {
      success: true,
      user,
    };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: UserResponse,
  ) {
    const updatedUser = await this.usersService.updateUser(id, updateUserDto);
    return {
      success: true,
      message: 'User updated successfully',
      user: updatedUser,
    };
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    await this.usersService.remove(id);
    return {
      success: true,
      message: 'User deleted successfully',
    };
  }

  @Patch(':id/deactivate')
  @Roles('admin')
  async deactivate(@Param('id') id: string) {
    await this.usersService.deactivateUser(id);
    return {
      success: true,
      message: 'User deactivated successfully',
    };
  }

  @Patch(':id/activate')
  @Roles('admin')
  async activate(@Param('id') id: string) {
    await this.usersService.activateUser(id);
    return {
      success: true,
      message: 'User activated successfully',
    };
  }
}
