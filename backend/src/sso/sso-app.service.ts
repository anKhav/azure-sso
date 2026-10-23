import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { X509Certificate, randomUUID } from "node:crypto";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ApiError } from "../common/api-error";
import { JsonFileStore } from "../storage/json-file-store.service";
import { CreateSsoAppDto } from "./dto/create-sso-app.dto";
import { PublicSsoApp, SsoAppRecord } from "./sso-app.model";

@Injectable()
export class SsoAppService {
  private static readonly FILE_NAME = "sso-apps.json";
  private readonly backendPublicUrl: string;
  private readonly certificateDirectory: string;

  constructor(
    private readonly store: JsonFileStore,
    config: ConfigService,
  ) {
    this.backendPublicUrl = (
      config.get<string>("BACKEND_PUBLIC_URL") ?? "http://localhost:3001"
    ).replace(/\/$/, "");
    this.certificateDirectory = resolve(
      config.get<string>("CERTIFICATE_UPLOAD_DIR") ??
        join(process.cwd(), "uploads/certificates"),
    );
  }

  async create(
    dto: CreateSsoAppDto,
    certificate: Express.Multer.File | undefined,
  ): Promise<PublicSsoApp> {
    if (!certificate)
      throw new ApiError(
        "CERTIFICATE_REQUIRED",
        "An Azure signing certificate is required",
        HttpStatus.BAD_REQUEST,
      );
    if (certificate.size > 1024 * 1024)
      throw new ApiError(
        "CERTIFICATE_TOO_LARGE",
        "Certificate must not exceed 1 MB",
        HttpStatus.PAYLOAD_TOO_LARGE,
      );

    let parsed: X509Certificate;
    try {
      parsed = new X509Certificate(certificate.buffer);
    } catch {
      throw new ApiError(
        "INVALID_CERTIFICATE",
        "Certificate is not a valid PEM or DER X.509 certificate",
        HttpStatus.BAD_REQUEST,
      );
    }

    const id = randomUUID();
    const certificatePath = `${id}.pem`;
    const pem = this.toPem(parsed.raw);
    await mkdir(this.certificateDirectory, { recursive: true });
    const destination = join(this.certificateDirectory, certificatePath);
    const temporary = `${destination}.${process.pid}.tmp`;
    await writeFile(temporary, pem, { encoding: "utf8", mode: 0o600 });
    await rename(temporary, destination);

    try {
      const record = await this.store.mutate<SsoAppRecord, SsoAppRecord>(
        SsoAppService.FILE_NAME,
        (apps) => {
          const name = dto.name.trim();
          if (
            apps.some((app) => app.name.toLowerCase() === name.toLowerCase())
          ) {
            throw new ApiError(
              "SSO_APP_NAME_EXISTS",
              "An SSO application with this name already exists",
              HttpStatus.CONFLICT,
            );
          }
          const created: SsoAppRecord = {
            id,
            name,
            loginUrl: dto.loginUrl,
            applicationId: dto.applicationId.trim(),
            azureIssuer: dto.azureIssuer,
            entityId: `${this.backendPublicUrl}/saml/metadata/${id}`,
            certificatePath,
            certificateFingerprint: parsed.fingerprint256
              .replaceAll(":", "")
              .toLowerCase(),
            createdAt: new Date().toISOString(),
          };
          apps.push(created);
          return created;
        },
      );
      return this.toPublic(record);
    } catch (error) {
      await unlink(destination).catch(() => undefined);
      throw error;
    }
  }

  async list(): Promise<PublicSsoApp[]> {
    return (await this.store.read<SsoAppRecord>(SsoAppService.FILE_NAME)).map(
      (app) => this.toPublic(app),
    );
  }

  async findRecordById(id: string): Promise<SsoAppRecord> {
    const app = (
      await this.store.read<SsoAppRecord>(SsoAppService.FILE_NAME)
    ).find((candidate) => candidate.id === id);
    if (!app)
      throw new ApiError(
        "SSO_APP_NOT_FOUND",
        "SSO application not found",
        HttpStatus.NOT_FOUND,
      );
    return app;
  }

  async findRecordByName(name: string): Promise<SsoAppRecord> {
    const normalized = name.trim().toLowerCase();
    const app = (
      await this.store.read<SsoAppRecord>(SsoAppService.FILE_NAME)
    ).find((candidate) => candidate.name.toLowerCase() === normalized);
    if (!app)
      throw new ApiError(
        "SSO_APP_NOT_FOUND",
        "SSO application not found",
        HttpStatus.NOT_FOUND,
      );
    return app;
  }

  async get(id: string): Promise<PublicSsoApp> {
    return this.toPublic(await this.findRecordById(id));
  }

  async delete(id: string): Promise<void> {
    const app = await this.findRecordById(id);
    await this.store.mutate<SsoAppRecord, void>(SsoAppService.FILE_NAME, (apps) => {
      const index = apps.findIndex((candidate) => candidate.id === id);
      if (index !== -1) apps.splice(index, 1);
    });
    await unlink(this.certificateAbsolutePath(app)).catch(() => undefined);
  }

  certificateAbsolutePath(app: SsoAppRecord): string {
    return join(this.certificateDirectory, app.certificatePath);
  }

  private toPublic(app: SsoAppRecord): PublicSsoApp {
    const metadataUrl = `${this.backendPublicUrl}/saml/metadata/${app.id}`;
    return {
      id: app.id,
      name: app.name,
      loginUrl: app.loginUrl,
      applicationId: app.applicationId,
      azureIssuer: app.azureIssuer,
      entityId: app.entityId,
      certificateFingerprint: app.certificateFingerprint,
      acsUrl: `${this.backendPublicUrl}/saml/acs/${app.id}`,
      metadataUrl,
      createdAt: app.createdAt,
    };
  }

  private toPem(raw: Buffer): string {
    const body =
      raw
        .toString("base64")
        .match(/.{1,64}/g)
        ?.join("\n") ?? "";
    return `-----BEGIN CERTIFICATE-----\n${body}\n-----END CERTIFICATE-----\n`;
  }
}
