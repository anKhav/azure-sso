import { Module } from "@nestjs/common";
import { SsoAppController } from "./sso-app.controller";
import { SsoAppService } from "./sso-app.service";
import { RedirectUrlService } from "./redirect-url.service";
import { UserSsoLinkService } from "./user-sso-link.service";
import { UserModule } from "../user/user.module";
import { AdminController } from "./admin.controller";

@Module({
  imports: [UserModule],
  controllers: [SsoAppController, AdminController],
  providers: [SsoAppService, UserSsoLinkService, RedirectUrlService],
  exports: [SsoAppService, UserSsoLinkService, RedirectUrlService, UserModule],
})
export class SsoModule {}
