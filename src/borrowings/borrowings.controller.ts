import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { BorrowingsService } from './borrowings.service';
import { CreateBorrowingDto } from './dto/create-borrowing.dto';
import { UpdateBorrowingDto } from './dto/update-borrowing.dto';
import { ReturnBookDto } from './dto/return-book.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from 'src/auth/decorators/public.decorator';

@Controller('borrowings')
@UseGuards(AuthGuard, RolesGuard)
export class BorrowingsController {
  constructor(private readonly borrowingsService: BorrowingsService) {}

  @Post()
  create(
    @Body() createBorrowingDto: CreateBorrowingDto,
    @CurrentUser() user: any,
  ) {
    return this.borrowingsService.create(createBorrowingDto, user);
  }

  @Get()
  @Roles('admin', 'librarian')
  findAll() {
    return this.borrowingsService.findAll();
  }

  @Get('stats')
  @Roles('admin', 'librarian')
  getStats() {
    return this.borrowingsService.getBorrowingStats();
  }

  @Get('overdue')
  @Roles('admin', 'librarian')
  getOverdueBooks() {
    return this.borrowingsService.getOverdueBooks();
  }

  @Post('mark-overdue')
  @Roles('admin', 'librarian')
  markOverdue() {
    return this.borrowingsService.markOverdue();
  }

  @Get('user/:userId')
  @Roles('admin', 'librarian', 'user')
  findByUserId(
    @Param('userId') userId: string,
    @CurrentUser() currentUser: any,
  ) {
    if (currentUser.role === 'user' && currentUser.id !== userId) {
      userId = currentUser.id;
    }
    return this.borrowingsService.findByUserId(userId);
  }

  @Get('user/:userId/active')
  @Roles('admin', 'librarian', 'user')
  findActiveByUserId(
    @Param('userId') userId: string,
    @CurrentUser() currentUser: any,
  ) {
    if (currentUser.role === 'user' && currentUser.id !== userId) {
      userId = currentUser.id;
    }
    return this.borrowingsService.findActiveByUserId(userId);
  }

  @Get('my-borrowings')
  @Roles('user')
  getMyBorrowings(@CurrentUser() user: any) {
    return this.borrowingsService.findByUserId(user.id);
  }

  @Get('my-active-borrowings')
  @Roles('user')
  getMyActiveBorrowings(@CurrentUser() user: any) {
    return this.borrowingsService.findActiveByUserId(user.id);
  }

  @Get(':id')
  @Roles('admin', 'librarian', 'user')
  findOne(@Param('id') id: string) {
    return this.borrowingsService.findOne(id);
  }

  @Post(':id/return')
  @Roles('admin', 'librarian')
  returnBook(@Param('id') id: string, @Body() returnBookDto: ReturnBookDto) {
    return this.borrowingsService.returnBook(id, returnBookDto);
  }

  @Patch(':id')
  @Roles('admin', 'librarian')
  update(
    @Param('id') id: string,
    @Body() updateBorrowingDto: UpdateBorrowingDto,
  ) {
    return this.borrowingsService.update(id, updateBorrowingDto);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.borrowingsService.remove(id);
  }
}
