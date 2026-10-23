import { IsEmail, IsString, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
export class LoginUserDto {
  @ApiProperty({
    example: "user@example.com",
    description: "Email address of an existing local user.",
  })
  @IsEmail()
  @MaxLength(254)
  email!: string;
  @ApiProperty({
    example: "Password#1Password#1",
    format: "password",
    description: "Local account password.",
  })
  @IsString()
  @MaxLength(128)
  password!: string;
}
