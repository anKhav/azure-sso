import { IsString, IsUUID, IsUrl, MaxLength } from "class-validator";
export class StartSsoRegisterDto {
  @IsUUID() userId!: string;
  @IsUUID() appId!: string;
  @IsUrl({ require_protocol: true, require_tld: false })
  @MaxLength(2048)
  redirectUrl!: string;
}
