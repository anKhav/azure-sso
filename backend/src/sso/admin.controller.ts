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
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";

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
  @ApiOperation({
    summary: "List all users",
    description:
      "Returns every local user together with their configured SSO links. Admin only.",
  })
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
  @ApiOperation({
    summary: "Create a local user",
    description:
      "Creates a password-based local user with the standard user role. Admin only.",
  })
  @UseGuards(TrustedOriginGuard)
  create(@Body() dto: RegisterUserDto): Promise<PublicUser> {
    return this.users.register(dto);
  }

  @Delete(":id")
  @ApiOperation({
    summary: "Delete a local user",
    description:
      "Deletes a non-admin local user and all of their SSO links. The static administrator cannot be deleted.",
  })
  @ApiParam({
    name: "id",
    format: "uuid",
    description: "Local user ID to delete.",
  })
  @UseGuards(TrustedOriginGuard)
  async delete(@Param("id") id: string): Promise<{ success: true }> {
    await this.users.delete(id);
    await this.links.removeAllForUser(id);
    return { success: true };
  }
}
