import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsDateString,
} from 'class-validator';

export class CreateBorrowingDto {
  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsNotEmpty()
  @IsString()
  bookId: string;

  @IsOptional()
  @IsDateString()
  borrowDate?: Date;

  @IsOptional()
  @IsDateString()
  dueDate?: Date;
}
