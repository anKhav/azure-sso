import { Module } from "@nestjs/common";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";
import { AdminGuard } from "./admin.guard";

@Module({
  controllers: [UserController],
  providers: [UserService, AdminGuard],
  exports: [UserService, AdminGuard],
})
export class UserModule {}
