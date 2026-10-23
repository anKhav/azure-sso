import { IsNotEmpty, IsString, IsUrl, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
export class StartSsoLoginDto {
  @ApiProperty({ example: "Test App" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  appName!: string;
  @ApiProperty({ example: "https://your-host/sso/result" })
  @IsUrl({ require_protocol: true, require_tld: false })
  @MaxLength(2048)
  redirectUrl!: string;
}
