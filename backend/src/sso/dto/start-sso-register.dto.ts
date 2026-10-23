import { IsString, IsUUID, IsUrl, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
export class StartSsoRegisterDto {
  @ApiProperty({ format: "uuid", description: "Local user to link." })
  @IsUUID()
  userId!: string;
  @ApiProperty({ format: "uuid", description: "Configured SSO application." })
  @IsUUID()
  appId!: string;
  @ApiProperty({ example: "https://your-host/sso/result" })
  @IsUrl({ require_protocol: true, require_tld: false })
  @MaxLength(2048)
  redirectUrl!: string;
}
