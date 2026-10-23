import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { ApiError } from "../common/api-error";
import type { AuthenticatedRequest } from "./authenticated-request";
import { SessionService } from "./session.service";

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.cookies?.[this.sessions.cookieName] as
      string | undefined;
    const session = token ? this.sessions.verify(token) : null;
    if (!session)
      throw new ApiError(
        "AUTHENTICATION_REQUIRED",
        "Authentication is required",
        HttpStatus.UNAUTHORIZED,
      );
    request.userId = session.sub;
    return true;
  }
}
