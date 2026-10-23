import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiError } from "../common/api-error";
import type { Request } from "express";

@Injectable()
export class TrustedOriginGuard implements CanActivate {
  private readonly frontendOrigin: string;
  constructor(config: ConfigService) {
    this.frontendOrigin = new URL(
      config.get<string>("FRONTEND_URL") ?? "http://localhost:3000",
    ).origin;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const origin = request.get("origin");
    if (origin !== this.frontendOrigin) {
      throw new ApiError(
        "CSRF_ORIGIN_REJECTED",
        "Request origin is not allowed",
        HttpStatus.FORBIDDEN,
      );
    }
    return true;
  }
}
