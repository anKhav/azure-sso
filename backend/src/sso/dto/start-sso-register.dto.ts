import { IsString, IsUUID, IsUrl, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
export class StartSsoRegisterDto {
  @ApiProperty({
    format: "uuid",
    description:
      "ID of the local user that will receive the verified Azure identity link.",
  })
  @IsUUID()
  userId!: string;
  @ApiProperty({
    format: "uuid",
    description: "ID of the configured SSO application used for registration.",
  })
  @IsUUID()
  appId!: string;
  @ApiProperty({
    example: "https://your-host/admin/users",
    description: "Same-origin frontend URL opened after completion.",
  })
  @IsUrl({ require_protocol: true, require_tld: false })
  @MaxLength(2048)
  returnUrl!: string;
}
