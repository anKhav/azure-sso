import { IsEmail, IsString, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
export class LoginUserDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  @MaxLength(254)
  email!: string;
  @ApiProperty({ example: "Password#1Password#1", format: "password" })
  @IsString()
  @MaxLength(128)
  password!: string;
}
