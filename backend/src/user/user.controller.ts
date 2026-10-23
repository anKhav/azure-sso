import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/authenticated-request";
import { SessionGuard } from "../auth/session.guard";
import { SessionService } from "../auth/session.service";
import { TrustedOriginGuard } from "../auth/trusted-origin.guard";
import { ApiError } from "../common/api-error";
import { LoginUserDto } from "./dto/login-user.dto";
import { PublicUser } from "./user.model";
import { UserService } from "./user.service";
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";

@Controller("user")
@ApiTags("Users")
export class UserController {
  constructor(
    private readonly users: UserService,
    private readonly sessions: SessionService,
  ) {}

  @Post("login")
  @ApiOperation({
    summary: "Log in with email and password",
    description:
      "Validates local credentials and sets the HTTP-only session cookie.",
  })
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginUserDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: PublicUser }> {
    const user = await this.users.authenticate(dto);
    this.sessions.setCookie(response, user.id);
    return { user };
  }

  @Get("me")
  @ApiOperation({
    summary: "Get the current user",
    description: "Restores the user represented by the current session cookie.",
  })
  @ApiCookieAuth("azure_saml_session")
  @UseGuards(SessionGuard)
  async me(
    @Req() request: AuthenticatedRequest,
  ): Promise<{ user: PublicUser }> {
    return { user: await this.users.findPublicById(request.userId) };
  }

  @Post("logout")
  @ApiOperation({
    summary: "Log out",
    description: "Clears the current session cookie.",
  })
  @ApiCookieAuth("azure_saml_session")
  @UseGuards(SessionGuard, TrustedOriginGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) response: Response): void {
    this.sessions.clearCookie(response);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get a user by ID",
    description:
      "Returns the requested user only when it is the current session user.",
  })
  @ApiParam({
    name: "id",
    format: "uuid",
    description: "Local user ID. It must match the current session user.",
  })
  @ApiCookieAuth("azure_saml_session")
  @UseGuards(SessionGuard)
  async getById(
    @Param("id") id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ user: PublicUser }> {
    if (id !== request.userId)
      throw new ApiError(
        "USER_ACCESS_DENIED",
        "You may only access your own user record",
        HttpStatus.FORBIDDEN,
      );
    return { user: await this.users.findPublicById(id) };
  }
}
