import { HttpStatus, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { ApiError } from "../common/api-error";
import { JsonFileStore } from "../storage/json-file-store.service";
import { PublicUserSsoLink, UserSsoLinkRecord } from "./user-sso-link.model";

@Injectable()
export class UserSsoLinkService {
  private static readonly FILE_NAME = "user-sso-links.json";
  constructor(private readonly store: JsonFileStore) {}

  async create(input: {
    userId: string;
    appId: string;
    samlNameId: string;
    nameIdFormat?: string;
  }): Promise<PublicUserSsoLink> {
    return this.store.mutate<UserSsoLinkRecord, PublicUserSsoLink>(
      UserSsoLinkService.FILE_NAME,
      (links) => {
        const identityLink = links.find(
          (link) =>
            link.appId === input.appId && link.samlNameId === input.samlNameId,
        );
        if (identityLink) {
          throw new ApiError(
            identityLink.userId === input.userId
              ? "SSO_IDENTITY_ALREADY_LINKED"
              : "SSO_IDENTITY_CONFLICT",
            identityLink.userId === input.userId
              ? "This SAML identity is already linked"
              : "This SAML identity belongs to another account",
            HttpStatus.CONFLICT,
          );
        }
        if (
          links.some(
            (link) =>
              link.userId === input.userId && link.appId === input.appId,
          )
        ) {
          throw new ApiError(
            "SSO_APP_ALREADY_LINKED",
            "This account already has an identity for this SSO application",
            HttpStatus.CONFLICT,
          );
        }
        const link: UserSsoLinkRecord = {
          id: randomUUID(),
          userId: input.userId,
          appId: input.appId,
          samlNameId: input.samlNameId,
          ...(input.nameIdFormat ? { nameIdFormat: input.nameIdFormat } : {}),
          createdAt: new Date().toISOString(),
        };
        links.push(link);
        return this.toPublic(link);
      },
    );
  }

  async findUserId(appId: string, samlNameId: string): Promise<string> {
    const link = (
      await this.store.read<UserSsoLinkRecord>(UserSsoLinkService.FILE_NAME)
    ).find(
      (candidate) =>
        candidate.appId === appId && candidate.samlNameId === samlNameId,
    );
    if (!link)
      throw new ApiError(
        "SSO_IDENTITY_NOT_LINKED",
        "This SAML identity is not linked to a local account",
        HttpStatus.UNAUTHORIZED,
      );
    return link.userId;
  }

  async listForUser(userId: string): Promise<PublicUserSsoLink[]> {
    return (
      await this.store.read<UserSsoLinkRecord>(UserSsoLinkService.FILE_NAME)
    )
      .filter((link) => link.userId === userId)
      .map((link) => this.toPublic(link));
  }

  async listAll(): Promise<PublicUserSsoLink[]> {
    return (await this.store.read<UserSsoLinkRecord>(UserSsoLinkService.FILE_NAME)).map((link) => this.toPublic(link));
  }

  async removeAllForUser(userId: string): Promise<void> {
    await this.store.mutate<UserSsoLinkRecord, void>(UserSsoLinkService.FILE_NAME, (links) => {
      for (let index = links.length - 1; index >= 0; index -= 1)
        if (links[index].userId === userId) links.splice(index, 1);
    });
  }

  async removeAllForApp(appId: string): Promise<void> {
    await this.store.mutate<UserSsoLinkRecord, void>(UserSsoLinkService.FILE_NAME, (links) => {
      for (let index = links.length - 1; index >= 0; index -= 1)
        if (links[index].appId === appId) links.splice(index, 1);
    });
  }

  async removeForUser(userId: string, appId: string): Promise<void> {
    return this.store.mutate<UserSsoLinkRecord, void>(
      UserSsoLinkService.FILE_NAME,
      (links) => {
        const index = links.findIndex(
          (link) => link.userId === userId && link.appId === appId,
        );
        if (index === -1) {
          throw new ApiError(
            "SSO_LINK_NOT_FOUND",
            "This account is not linked to the SSO application",
            HttpStatus.NOT_FOUND,
          );
        }
        links.splice(index, 1);
      },
    );
  }

  private toPublic(link: UserSsoLinkRecord): PublicUserSsoLink {
    return {
      id: link.id,
      userId: link.userId,
      appId: link.appId,
      ...(link.nameIdFormat ? { nameIdFormat: link.nameIdFormat } : {}),
      createdAt: link.createdAt,
    };
  }
}
