import { IsUUID } from "class-validator";

export class UnregisterSsoDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  appId!: string;
}
