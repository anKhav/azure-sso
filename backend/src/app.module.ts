import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AuthModule } from "./auth/auth.module";
import { StorageModule } from "./storage/storage.module";
import { SsoModule } from "./sso/sso.module";
import { SamlModule } from "./saml/saml.module";
import { UserModule } from "./user/user.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    StorageModule,
    AuthModule,
    UserModule,
    SsoModule,
    SamlModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
