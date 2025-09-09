import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateBookDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  author: string;

  @IsNotEmpty()
  @IsString()
  isbn: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumber()
  publishedYear?: number;

  @IsOptional()
  @IsNumber()
  copies?: number;

  @IsOptional()
  @IsNumber()
  availableCopies?: number;

  @IsOptional()
  @IsString()
  location?: string;
}
