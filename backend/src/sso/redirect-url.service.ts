import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiError } from "../common/api-error";

@Injectable()
export class RedirectUrlService {
  private readonly frontendOrigin: string;
  private readonly allowedPaths: Set<string>;
  constructor(config: ConfigService) {
    this.frontendOrigin = new URL(
      config.get<string>("FRONTEND_URL") ?? "http://localhost:3000",
    ).origin;
    this.allowedPaths = new Set(
      (config.get<string>("SAML_REDIRECT_PATHS") ?? "/sso/result")
        .split(",")
        .map((path) => path.trim()),
    );
  }

  approve(value: string): string {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new ApiError(
        "INVALID_REDIRECT_URL",
        "Redirect URL is not allowed",
        HttpStatus.BAD_REQUEST,
      );
    }
    if (
      url.origin !== this.frontendOrigin ||
      !this.allowedPaths.has(url.pathname) ||
      url.username ||
      url.password
    ) {
      throw new ApiError(
        "INVALID_REDIRECT_URL",
        "Redirect URL is not allowed",
        HttpStatus.BAD_REQUEST,
      );
    }
    url.hash = "";
    return url.toString();
  }

  outcome(
    approvedUrl: string,
    status: "success" | "error",
    code?: string,
  ): string {
    const url = new URL(approvedUrl);
    url.searchParams.set("status", status);
    if (code) url.searchParams.set("code", code);
    else url.searchParams.delete("code");
    return url.toString();
  }
}
