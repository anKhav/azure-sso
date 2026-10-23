import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { SessionGuard } from "./session.guard";
import { SessionService } from "./session.service";
import { TrustedOriginGuard } from "./trusted-origin.guard";

@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [SessionService, SessionGuard, TrustedOriginGuard],
  exports: [SessionService, SessionGuard, TrustedOriginGuard],
})
export class AuthModule {}
