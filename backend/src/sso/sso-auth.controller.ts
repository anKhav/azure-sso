import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/authenticated-request";
import { SessionGuard } from "../auth/session.guard";
import { TrustedOriginGuard } from "../auth/trusted-origin.guard";
import { AdminGuard } from "../user/admin.guard";
import { UserService } from "../user/user.service";
import { SamlFlowService } from "../saml/saml-flow.service";
import { SamlService } from "../saml/saml.service";
import { StartSsoLoginDto } from "./dto/start-sso-login.dto";
import { StartSsoRegisterDto } from "./dto/start-sso-register.dto";
import { UnregisterSsoDto } from "./dto/unregister-sso.dto";
import { RedirectUrlService } from "./redirect-url.service";
import { SsoAppService } from "./sso-app.service";
import { PublicUserSsoLink } from "./user-sso-link.model";
import { UserSsoLinkService } from "./user-sso-link.service";

@Controller("user/sso")
export class SsoAuthController {
  constructor(
    private readonly apps: SsoAppService,
    private readonly flows: SamlFlowService,
    private readonly saml: SamlService,
    private readonly redirects: RedirectUrlService,
    private readonly links: UserSsoLinkService,
    private readonly users: UserService,
  ) {}

  @Get("links")
  @UseGuards(SessionGuard)
  listLinks(
    @Req() request: AuthenticatedRequest,
  ): Promise<PublicUserSsoLink[]> {
    return this.links.listForUser(request.userId);
  }

  @Delete("register")
  @UseGuards(SessionGuard, AdminGuard, TrustedOriginGuard)
  async unregister(
    @Body() body: UnregisterSsoDto,
  ): Promise<{ success: true }> {
    await this.apps.findRecordById(body.appId);
    await this.users.findPublicById(body.userId);
    await this.links.removeForUser(body.userId, body.appId);
    return { success: true };
  }

  @Post("register")
  @UseGuards(SessionGuard, AdminGuard, TrustedOriginGuard)
  async register(
    @Body() body: StartSsoRegisterDto,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ): Promise<void> {
    await this.users.findPublicById(body.userId);
    const app = await this.apps.findRecordById(body.appId);
    const flow = await this.flows.create({
      appId: app.id,
      operation: "register",
      initiatingUserId: request.userId,
      targetUserId: body.userId,
      redirectUrl: this.redirects.approve(body.redirectUrl),
    });
    response.redirect(
      HttpStatus.SEE_OTHER,
      await this.saml.createAuthorizeUrl(app, flow),
    );
  }

  @Get("login")
  async login(
    @Query() query: StartSsoLoginDto,
    @Res() response: Response,
  ): Promise<void> {
    const app = await this.apps.findRecordByName(query.appName);
    const flow = await this.flows.create({
      appId: app.id,
      operation: "login",
      redirectUrl: this.redirects.approve(query.redirectUrl),
    });
    response.redirect(
      HttpStatus.FOUND,
      await this.saml.createAuthorizeUrl(app, flow),
    );
  }
}
