import { IsUUID } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UnregisterSsoDto {
  @ApiProperty({
    format: "uuid",
    description: "Local user whose SSO link is removed.",
  })
  @IsUUID()
  userId!: string;

  @ApiProperty({ format: "uuid", description: "SSO application to unlink." })
  @IsUUID()
  appId!: string;
}
