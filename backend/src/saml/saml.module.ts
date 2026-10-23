import { Module } from "@nestjs/common";
import { SsoModule } from "../sso/sso.module";
import { SsoAuthController } from "../sso/sso-auth.controller";
import { SamlController } from "./saml.controller";
import { SamlFlowService } from "./saml-flow.service";
import { SamlService } from "./saml.service";

@Module({
  imports: [SsoModule],
  controllers: [SamlController, SsoAuthController],
  providers: [SamlFlowService, SamlService],
  exports: [SamlFlowService, SamlService],
})
export class SamlModule {}
