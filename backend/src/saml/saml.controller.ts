import {
  Body,
  Controller,
  Get,
  Header,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { SessionService } from "../auth/session.service";
import { ApiError } from "../common/api-error";
import { RedirectUrlService } from "../sso/redirect-url.service";
import { SsoAppService } from "../sso/sso-app.service";
import { UserSsoLinkService } from "../sso/user-sso-link.service";
import { SamlFlowService } from "./saml-flow.service";
import { SamlService } from "./saml.service";
import { ApiExcludeEndpoint, ApiTags } from "@nestjs/swagger";

@Controller("saml")
@ApiTags("SAML protocol")
export class SamlController {
  constructor(
    private readonly apps: SsoAppService,
    private readonly saml: SamlService,
    private readonly flows: SamlFlowService,
    private readonly links: UserSsoLinkService,
    private readonly redirects: RedirectUrlService,
    private readonly sessions: SessionService,
  ) {}

  @Get("metadata/:appId")
  @Header("Content-Type", "application/samlmetadata+xml; charset=utf-8")
  async metadata(@Param("appId") appId: string): Promise<string> {
    return this.saml.metadata(await this.apps.findRecordById(appId));
  }

  @Post("acs/:appId")
  @ApiExcludeEndpoint()
  async acs(
    @Param("appId") appId: string,
    @Body() body: { SAMLResponse?: string; RelayState?: string },
    @Res() response: Response,
  ): Promise<void> {
    if (!body.RelayState)
      throw new ApiError(
        "SAML_RELAY_STATE_REQUIRED",
        "RelayState is required",
        HttpStatus.BAD_REQUEST,
      );
    const flow = await this.flows.getActiveByFlowId(body.RelayState, appId);
    const app = await this.apps.findRecordById(appId);
    try {
      if (!body.SAMLResponse || body.SAMLResponse.length > 1_400_000) {
        throw new ApiError(
          "SAML_RESPONSE_REQUIRED",
          "SAMLResponse is required",
          HttpStatus.BAD_REQUEST,
        );
      }
      const identity = await this.saml.validatePostResponse(
        app,
        flow,
        body.SAMLResponse,
      );
      await this.flows.consume(flow.flowId);
      let userId: string;
      if (flow.operation === "register") {
        if (!flow.initiatingUserId)
          throw new Error("Registration flow has no initiating user");
        const targetUserId = flow.targetUserId ?? flow.initiatingUserId;
        await this.links.create({
          userId: targetUserId,
          appId: app.id,
          samlNameId: identity.nameId,
          ...(identity.nameIdFormat
            ? { nameIdFormat: identity.nameIdFormat }
            : {}),
        });
        userId = flow.initiatingUserId;
      } else {
        userId = await this.links.findUserId(app.id, identity.nameId);
      }
      this.sessions.setCookie(response, userId);
      response.redirect(
        HttpStatus.SEE_OTHER,
        this.redirects.outcome(flow.redirectUrl, "success"),
      );
    } catch (error) {
      await this.flows.consume(flow.flowId).catch(() => undefined);
      response.redirect(
        HttpStatus.SEE_OTHER,
        this.redirects.outcome(
          flow.redirectUrl,
          "error",
          this.errorCode(error),
        ),
      );
    }
  }

  private errorCode(error: unknown): string {
    if (error instanceof HttpException) {
      const body = error.getResponse();
      if (
        typeof body === "object" &&
        body !== null &&
        "code" in body &&
        typeof body.code === "string"
      )
        return body.code;
    }
    return "SAML_COMPLETION_FAILED";
  }
}
