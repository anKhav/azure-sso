import { IsUUID } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UnregisterSsoDto {
  @ApiProperty({
    format: "uuid",
    description: "ID of the local user whose SSO link will be removed.",
  })
  @IsUUID()
  userId!: string;

  @ApiProperty({
    format: "uuid",
    description: "ID of the SSO application to unlink from the user.",
  })
  @IsUUID()
  appId!: string;
}
