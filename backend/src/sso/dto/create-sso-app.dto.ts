import { IsNotEmpty, IsString, IsUrl, MaxLength } from "class-validator";

export class CreateSsoAppDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2048)
  loginUrl!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  applicationId!: string;

  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2048)
  azureIssuer!: string;
}
