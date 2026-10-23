import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { AuthenticatedRequest } from "../auth/authenticated-request";
import { UserService } from "./user.service";

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly users: UserService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = await this.users.findPublicById(request.userId);
    if (user.role !== "admin") throw new ForbiddenException("Administrator access is required");
    return true;
  }
}
