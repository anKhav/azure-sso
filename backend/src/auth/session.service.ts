import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { Response } from "express";

interface SessionPayload {
  sub: string;
  type: "session";
}

@Injectable()
export class SessionService {
  readonly cookieName: string;
  readonly maxAgeMilliseconds: number;
  readonly secure: boolean;
  private readonly secret: string;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.cookieName =
      config.get<string>("SESSION_COOKIE_NAME") ?? "azure_saml_session";
    this.secret =
      config.get<string>("SESSION_SECRET") ??
      "development-only-secret-change-before-deployment";
    this.maxAgeMilliseconds =
      Number(config.get<string>("SESSION_TTL_SECONDS") ?? 28_800) * 1000;
    this.secure = config.get<string>("COOKIE_SECURE") === "true";
  }

  create(userId: string): string {
    return this.jwt.sign(
      { sub: userId, type: "session" } satisfies SessionPayload,
      {
        secret: this.secret,
        expiresIn: Math.floor(this.maxAgeMilliseconds / 1000),
        issuer: "azure-saml-test",
        audience: "azure-saml-test-browser",
      },
    );
  }

  verify(token: string): SessionPayload | null {
    try {
      const payload = this.jwt.verify<SessionPayload>(token, {
        secret: this.secret,
        issuer: "azure-saml-test",
        audience: "azure-saml-test-browser",
      });
      return payload.type === "session" && payload.sub ? payload : null;
    } catch {
      return null;
    }
  }

  setCookie(response: Response, userId: string): void {
    response.cookie(this.cookieName, this.create(userId), {
      httpOnly: true,
      sameSite: this.secure ? "none" : "lax",
      secure: this.secure,
      path: "/",
      maxAge: this.maxAgeMilliseconds,
    });
  }

  clearCookie(response: Response): void {
    response.clearCookie(this.cookieName, {
      httpOnly: true,
      sameSite: this.secure ? "none" : "lax",
      secure: this.secure,
      path: "/",
    });
  }
}
