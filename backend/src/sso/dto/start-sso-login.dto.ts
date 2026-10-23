import { IsNotEmpty, IsString, IsUrl, MaxLength } from "class-validator";
export class StartSsoLoginDto {
  @IsString() @IsNotEmpty() @MaxLength(100) appName!: string;
  @IsUrl({ require_protocol: true, require_tld: false })
  @MaxLength(2048)
  redirectUrl!: string;
}
