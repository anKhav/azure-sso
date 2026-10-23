import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { SessionGuard } from "../auth/session.guard";
import { TrustedOriginGuard } from "../auth/trusted-origin.guard";
import { AdminGuard } from "../user/admin.guard";
import { RegisterUserDto } from "../user/dto/register-user.dto";
import { PublicUser } from "../user/user.model";
import { UserService } from "../user/user.service";
import { PublicUserSsoLink } from "./user-sso-link.model";
import { UserSsoLinkService } from "./user-sso-link.service";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";

export interface AdminUser extends PublicUser {
  ssoLinks: PublicUserSsoLink[];
}

@Controller("admin/users")
@UseGuards(SessionGuard, AdminGuard)
@ApiTags("Administration")
@ApiCookieAuth("azure_saml_session")
export class AdminController {
  constructor(
    private readonly users: UserService,
    private readonly links: UserSsoLinkService,
  ) {}

  @Get()
  async list(): Promise<AdminUser[]> {
    const [users, links] = await Promise.all([
      this.users.list(),
      this.links.listAll(),
    ]);
    return users.map((user) => ({
      ...user,
      ssoLinks: links.filter((link) => link.userId === user.id),
    }));
  }

  @Post()
  @UseGuards(TrustedOriginGuard)
  create(@Body() dto: RegisterUserDto): Promise<PublicUser> {
    return this.users.register(dto);
  }

  @Delete(":id")
  @UseGuards(TrustedOriginGuard)
  async delete(@Param("id") id: string): Promise<{ success: true }> {
    await this.users.delete(id);
    await this.links.removeAllForUser(id);
    return { success: true };
  }
}
