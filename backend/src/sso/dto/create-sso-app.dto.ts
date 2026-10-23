import { IsNotEmpty, IsString, IsUrl, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateSsoAppDto {
  @ApiProperty({
    example: "Test App",
    description: "Local display name used as appName during login.",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    example: "https://login.microsoftonline.com/{tenantId}/saml2",
    description: "Microsoft Entra Login URL.",
  })
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2048)
  loginUrl!: string;

  @ApiProperty({
    example: "dc3dc381-d159-4ae8-8be7-8e48b14b279a",
    description: "Azure Application (client) ID.",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  applicationId!: string;

  @ApiProperty({
    example: "https://sts.windows.net/{tenantId}/",
    description: "Microsoft Entra Identifier (SAML issuer).",
  })
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2048)
  azureIssuer!: string;
}
