import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class RegisterUserDto {
  @IsEmail() @MaxLength(254) email!: string;
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
