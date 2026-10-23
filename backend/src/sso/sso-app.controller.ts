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
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiTags } from "@nestjs/swagger";

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
        name: { type: "string", example: "Test App" },
        loginUrl: { type: "string", format: "uri" },
        applicationId: { type: "string" },
        azureIssuer: { type: "string", format: "uri" },
        certificate: { type: "string", format: "binary" },
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
  list(): Promise<PublicSsoApp[]> {
    return this.apps.list();
  }

  @Get(":id")
  get(@Param("id") id: string): Promise<PublicSsoApp> {
    return this.apps.get(id);
  }

  @Delete(":id")
  @UseGuards(TrustedOriginGuard)
  async delete(@Param("id") id: string): Promise<{ success: true }> {
    await this.apps.delete(id);
    await this.links.removeAllForApp(id);
    return { success: true };
  }
}
