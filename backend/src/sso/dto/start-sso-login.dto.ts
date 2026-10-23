import { IsNotEmpty, IsString, IsUrl, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
export class StartSsoLoginDto {
  @ApiProperty({
    example: "Test App",
    description: "Exact local name of the configured SSO application.",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  appName!: string;
  @ApiProperty({
    example: "https://your-host/dashboard",
    description: "Same-origin frontend URL opened after completion.",
  })
  @IsUrl({ require_protocol: true, require_tld: false })
  @MaxLength(2048)
  returnUrl!: string;
}
