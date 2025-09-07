import { IsOptional, IsDateString, IsIn } from 'class-validator';

export class UpdateBorrowingDto {
  @IsOptional()
  @IsDateString()
  returnDate?: Date;

  @IsOptional()
  @IsIn(['borrowed', 'returned', 'overdue'])
  status?: 'borrowed' | 'returned' | 'overdue';
}
