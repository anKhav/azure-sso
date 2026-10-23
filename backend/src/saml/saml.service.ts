import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Profile, SAML, ValidateInResponseTo } from "@node-saml/node-saml";
import { DOMParser } from "@xmldom/xmldom";
import { readFile } from "node:fs/promises";
import { ApiError } from "../common/api-error";
import { SsoAppRecord } from "../sso/sso-app.model";
import { SsoAppService } from "../sso/sso-app.service";
import { FlowCacheProvider } from "./flow-cache.provider";
import { SamlFlowRecord } from "./saml-flow.model";
import { SamlFlowService } from "./saml-flow.service";

export interface VerifiedSamlIdentity {
  nameId: string;
  nameIdFormat?: string;
  issuer: string;
}

@Injectable()
export class SamlService {
  private readonly logger = new Logger(SamlService.name);
  private readonly requestExpirationMs: number;

  constructor(
    private readonly apps: SsoAppService,
    private readonly flows: SamlFlowService,
    config: ConfigService,
  ) {
    this.requestExpirationMs =
      Number(config.get<string>("SAML_FLOW_TTL_SECONDS") ?? 300) * 1000;
  }

  async createAuthorizeUrl(
    app: SsoAppRecord,
    flow: SamlFlowRecord,
  ): Promise<string> {
    const saml = await this.createClient(app, flow.requestId);
    return saml.getAuthorizeUrlAsync(flow.flowId, undefined, {});
  }

  async validatePostResponse(
    app: SsoAppRecord,
    flow: SamlFlowRecord,
    samlResponse: string,
  ): Promise<VerifiedSamlIdentity> {
    try {
      const saml = await this.createClient(app);
      const result = await saml.validatePostResponseAsync({
        SAMLResponse: samlResponse,
      });
      if (result.loggedOut || !result.profile?.nameID)
        throw new Error("Missing NameID in authentication response");
      this.verifyIssuer(result.profile, app.azureIssuer);
      this.verifyDestinationAndRecipient(
        result.profile,
        `${app.entityId.replace(/\/saml\/metadata\/[^/]+$/, "")}/saml/acs/${app.id}`,
      );
      return {
        nameId: result.profile.nameID,
        ...(result.profile.nameIDFormat
          ? { nameIdFormat: result.profile.nameIDFormat }
          : {}),
        issuer: result.profile.issuer,
      };
    } catch (error) {
      this.logger.warn(
        `SAML validation failed appId=${app.id} requestId=${flow.requestId} stage=response-validation reason=${error instanceof Error ? error.message : "unknown"}`,
      );
      throw new ApiError(
        "SAML_VALIDATION_FAILED",
        "The SAML response could not be validated",
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  async metadata(app: SsoAppRecord): Promise<string> {
    return (await this.createClient(app)).generateServiceProviderMetadata(
      null,
      null,
    );
  }

  private async createClient(
    app: SsoAppRecord,
    generatedRequestId?: string,
  ): Promise<SAML> {
    const idpCert = await readFile(
      this.apps.certificateAbsolutePath(app),
      "utf8",
    );
    const callbackUrl = `${app.entityId.replace(/\/saml\/metadata\/[^/]+$/, "")}/saml/acs/${app.id}`;
    return new SAML({
      entryPoint: app.loginUrl,
      issuer: app.entityId,
      callbackUrl,
      idpCert,
      idpIssuer: app.azureIssuer,
      audience: app.entityId,
      validateInResponseTo: ValidateInResponseTo.always,
      requestIdExpirationPeriodMs: this.requestExpirationMs,
      cacheProvider: new FlowCacheProvider(this.flows, app.id),
      generateUniqueId: generatedRequestId
        ? () => generatedRequestId
        : undefined,
      signatureAlgorithm: "sha256",
      digestAlgorithm: "sha256",
      wantAssertionsSigned: false,
      wantAuthnResponseSigned: false,
      acceptedClockSkewMs: 5_000,
      maxAssertionAgeMs: this.requestExpirationMs,
    });
  }

  private verifyIssuer(profile: Profile, expected: string): void {
    if (profile.issuer !== expected) throw new Error("Unexpected SAML issuer");
  }

  private verifyDestinationAndRecipient(
    profile: Profile,
    expected: string,
  ): void {
    const responseXml = profile.getSamlResponseXml?.();
    if (!responseXml) throw new Error("Missing response XML");
    const destination = new DOMParser()
      .parseFromString(responseXml, "text/xml")
      .documentElement.getAttribute("Destination");
    if (destination !== expected)
      throw new Error("Unexpected SAML destination");

    const assertion = profile.getAssertion?.() as
      Record<string, unknown> | undefined;
    const assertionRoot = assertion?.Assertion as
      Record<string, unknown> | undefined;
    const subjects = assertionRoot?.Subject as unknown[] | undefined;
    const subject = subjects?.[0] as Record<string, unknown> | undefined;
    const confirmations = subject?.SubjectConfirmation as unknown[] | undefined;
    const hasExpectedRecipient = confirmations?.some((confirmation) => {
      const data = (confirmation as Record<string, unknown>)
        .SubjectConfirmationData as unknown[] | undefined;
      const attributes = (data?.[0] as Record<string, unknown> | undefined)
        ?.$ as Record<string, unknown> | undefined;
      return attributes?.Recipient === expected;
    });
    if (!hasExpectedRecipient)
      throw new Error("Unexpected or missing SAML recipient");
  }
}
