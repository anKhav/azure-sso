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

@Controller("sso/app")
@UseGuards(SessionGuard, AdminGuard)
export class SsoAppController {
  constructor(private readonly apps: SsoAppService, private readonly links: UserSsoLinkService) {}

  @Post("create")
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
