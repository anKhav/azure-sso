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
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

@Controller("user/sso")
@ApiTags("SSO authentication")
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
  @ApiOperation({
    summary: "List current user SSO links",
    description:
      "Returns SSO applications linked to the current user without exposing the Azure NameID.",
  })
  @ApiCookieAuth("azure_saml_session")
  @UseGuards(SessionGuard)
  listLinks(
    @Req() request: AuthenticatedRequest,
  ): Promise<PublicUserSsoLink[]> {
    return this.links.listForUser(request.userId);
  }

  @Delete("register")
  @ApiOperation({
    summary: "Unregister a user from SSO",
    description:
      "Removes the selected user's identity link for one SSO application. Admin only.",
  })
  @ApiCookieAuth("azure_saml_session")
  @UseGuards(SessionGuard, AdminGuard, TrustedOriginGuard)
  async unregister(@Body() body: UnregisterSsoDto): Promise<{ success: true }> {
    await this.apps.findRecordById(body.appId);
    await this.users.findPublicById(body.userId);
    await this.links.removeForUser(body.userId, body.appId);
    return { success: true };
  }

  @Post("register")
  @ApiOperation({
    summary: "Start SSO user registration",
    description:
      "Creates a short-lived SAML linking flow and responds with 303 See Other to Microsoft Entra. Admin only.",
  })
  @ApiCookieAuth("azure_saml_session")
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
      redirectUrl: this.redirects.approve(body.returnUrl),
    });
    response.redirect(
      HttpStatus.SEE_OTHER,
      await this.saml.createAuthorizeUrl(app, flow),
    );
  }

  @Get("login")
  @ApiOperation({
    summary: "Start SSO login",
    description:
      "Creates a short-lived SAML login flow and responds with 302 Found to Microsoft Entra. No existing session is required.",
  })
  async login(
    @Query() query: StartSsoLoginDto,
    @Res() response: Response,
  ): Promise<void> {
    const app = await this.apps.findRecordByName(query.appName);
    const flow = await this.flows.create({
      appId: app.id,
      operation: "login",
      redirectUrl: this.redirects.approve(query.returnUrl),
    });
    response.redirect(
      HttpStatus.FOUND,
      await this.saml.createAuthorizeUrl(app, flow),
    );
  }
}
