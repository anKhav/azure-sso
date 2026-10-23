import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class RegisterUserDto {
  @ApiProperty({
    example: "user@example.com",
    description: "Unique email address for the new local user.",
  })
  @IsEmail()
  @MaxLength(254)
  email!: string;
  @ApiProperty({
    example: "Password#1Password#1",
    minLength: 12,
    maxLength: 128,
    format: "password",
    description:
      "Password containing uppercase, lowercase, numeric, and special characters.",
  })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(/[a-z]/, { message: "password must contain a lowercase letter" })
  @Matches(/[A-Z]/, { message: "password must contain an uppercase letter" })
  @Matches(/[0-9]/, { message: "password must contain a number" })
  @Matches(/[^A-Za-z0-9]/, {
    message: "password must contain a special character",
  })
  password!: string;
}
