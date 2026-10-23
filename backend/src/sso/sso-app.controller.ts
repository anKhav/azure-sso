import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { SessionGuard } from "../auth/session.guard";
import { TrustedOriginGuard } from "../auth/trusted-origin.guard";
import { AdminGuard } from "../user/admin.guard";
import { CreateSsoAppDto } from "./dto/create-sso-app.dto";
import { PublicSsoApp } from "./sso-app.model";
import { SsoAppService } from "./sso-app.service";
import { UserSsoLinkService } from "./user-sso-link.service";
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";

@Controller("sso/app")
@UseGuards(SessionGuard, AdminGuard)
@ApiTags("SSO applications")
@ApiCookieAuth("azure_saml_session")
export class SsoAppController {
  constructor(
    private readonly apps: SsoAppService,
    private readonly links: UserSsoLinkService,
  ) {}

  @Post("create")
  @ApiOperation({
    summary: "Create an SSO application",
    description:
      "Stores Microsoft Entra SAML configuration and its X.509 response-signing certificate. Admin only.",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: [
        "name",
        "loginUrl",
        "applicationId",
        "azureIssuer",
        "certificate",
      ],
      properties: {
        name: {
          type: "string",
          example: "Test App",
          description:
            "Local display name and the appName used by the SSO login endpoint.",
        },
        loginUrl: {
          type: "string",
          format: "uri",
          description: "Microsoft Entra Login URL from the SAML setup page.",
        },
        applicationId: {
          type: "string",
          description: "Microsoft Entra Application (client) ID.",
        },
        azureIssuer: {
          type: "string",
          format: "uri",
          description:
            "Microsoft Entra Identifier, normally https://sts.windows.net/{tenantId}/.",
        },
        certificate: {
          type: "string",
          format: "binary",
          description:
            "Raw or PEM X.509 SAML signing certificate downloaded from Microsoft Entra.",
        },
      },
    },
  })
  @UseGuards(TrustedOriginGuard)
  @UseInterceptors(
    FileInterceptor("certificate", {
      storage: memoryStorage(),
      limits: { fileSize: 1024 * 1024, files: 1, fields: 4 },
    }),
  )
  create(
    @Body() dto: CreateSsoAppDto,
    @UploadedFile() certificate?: Express.Multer.File,
  ): Promise<PublicSsoApp> {
    return this.apps.create(dto, certificate);
  }

  @Get()
  @ApiOperation({
    summary: "List SSO applications",
    description:
      "Returns the public configuration of every registered SSO application. Admin only.",
  })
  list(): Promise<PublicSsoApp[]> {
    return this.apps.list();
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get an SSO application",
    description:
      "Returns public configuration, generated Entity ID, ACS URL, and metadata URL. Admin only.",
  })
  @ApiParam({ name: "id", format: "uuid", description: "SSO application ID." })
  get(@Param("id") id: string): Promise<PublicSsoApp> {
    return this.apps.get(id);
  }

  @Delete(":id")
  @ApiOperation({
    summary: "Delete an SSO application",
    description:
      "Deletes the application, uploaded certificate, and all user links for this application. Admin only.",
  })
  @ApiParam({
    name: "id",
    format: "uuid",
    description: "SSO application ID to delete.",
  })
  @UseGuards(TrustedOriginGuard)
  async delete(@Param("id") id: string): Promise<{ success: true }> {
    await this.apps.delete(id);
    await this.links.removeAllForApp(id);
    return { success: true };
  }
}
