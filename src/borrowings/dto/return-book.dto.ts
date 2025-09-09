import { IsOptional, IsDateString } from 'class-validator';

export class ReturnBookDto {
  @IsOptional()
  @IsDateString()
  returnDate?: string;
}
