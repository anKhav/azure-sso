import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes, randomUUID } from "node:crypto";
import { ApiError } from "../common/api-error";
import { JsonFileStore } from "../storage/json-file-store.service";
import { SamlFlowRecord, SamlOperation } from "./saml-flow.model";

@Injectable()
export class SamlFlowService {
  private static readonly FILE_NAME = "saml-flows.json";
  private readonly ttlMs: number;

  constructor(
    private readonly store: JsonFileStore,
    config: ConfigService,
  ) {
    this.ttlMs =
      Number(config.get<string>("SAML_FLOW_TTL_SECONDS") ?? 300) * 1000;
  }

  async create(input: {
    appId: string;
    operation: SamlOperation;
    initiatingUserId?: string;
    targetUserId?: string;
    redirectUrl: string;
  }): Promise<SamlFlowRecord> {
    const now = new Date();
    const flow: SamlFlowRecord = {
      flowId: randomBytes(32).toString("base64url"),
      requestId: `_${randomUUID().replaceAll("-", "")}`,
      appId: input.appId,
      operation: input.operation,
      ...(input.initiatingUserId
        ? { initiatingUserId: input.initiatingUserId }
        : {}),
      ...(input.targetUserId ? { targetUserId: input.targetUserId } : {}),
      redirectUrl: input.redirectUrl,
      requestCreatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.ttlMs).toISOString(),
    };
    await this.store.mutate<SamlFlowRecord, void>(
      SamlFlowService.FILE_NAME,
      (flows) => {
        this.cleanup(flows);
        flows.push(flow);
      },
    );
    return flow;
  }

  async getActiveByFlowId(
    flowId: string,
    appId?: string,
  ): Promise<SamlFlowRecord> {
    const flow = (
      await this.store.read<SamlFlowRecord>(SamlFlowService.FILE_NAME)
    ).find((candidate) => candidate.flowId === flowId);
    if (!flow || (appId && flow.appId !== appId))
      throw new ApiError(
        "SAML_FLOW_NOT_FOUND",
        "SAML flow is invalid",
        HttpStatus.BAD_REQUEST,
      );
    if (flow.consumedAt)
      throw new ApiError(
        "SAML_FLOW_REPLAYED",
        "SAML flow has already been used",
        HttpStatus.BAD_REQUEST,
      );
    if (Date.parse(flow.expiresAt) <= Date.now())
      throw new ApiError(
        "SAML_FLOW_EXPIRED",
        "SAML flow has expired",
        HttpStatus.BAD_REQUEST,
      );
    return flow;
  }

  async getRequestCacheValue(
    requestId: string,
    appId: string,
  ): Promise<string | null> {
    const flow = (
      await this.store.read<SamlFlowRecord>(SamlFlowService.FILE_NAME)
    ).find(
      (candidate) =>
        candidate.requestId === requestId && candidate.appId === appId,
    );
    if (
      !flow ||
      flow.requestValidatedAt ||
      flow.consumedAt ||
      Date.parse(flow.expiresAt) <= Date.now()
    )
      return null;
    return flow.requestCreatedAt;
  }

  async markRequestValidated(
    requestId: string,
    appId: string,
  ): Promise<string | null> {
    return this.store.mutate<SamlFlowRecord, string | null>(
      SamlFlowService.FILE_NAME,
      (flows) => {
        const flow = flows.find(
          (candidate) =>
            candidate.requestId === requestId && candidate.appId === appId,
        );
        if (!flow || flow.requestValidatedAt || flow.consumedAt) return null;
        flow.requestValidatedAt = new Date().toISOString();
        return flow.requestCreatedAt;
      },
    );
  }

  async consume(flowId: string): Promise<SamlFlowRecord> {
    return this.store.mutate<SamlFlowRecord, SamlFlowRecord>(
      SamlFlowService.FILE_NAME,
      (flows) => {
        const flow = flows.find((candidate) => candidate.flowId === flowId);
        if (
          !flow ||
          flow.consumedAt ||
          Date.parse(flow.expiresAt) <= Date.now()
        ) {
          throw new ApiError(
            "SAML_FLOW_REPLAYED",
            "SAML flow is no longer active",
            HttpStatus.BAD_REQUEST,
          );
        }
        flow.consumedAt = new Date().toISOString();
        return { ...flow };
      },
    );
  }

  private cleanup(flows: SamlFlowRecord[]): void {
    const retentionBoundary = Date.now() - 24 * 60 * 60 * 1000;
    for (let index = flows.length - 1; index >= 0; index -= 1) {
      if (Date.parse(flows[index].expiresAt) < retentionBoundary)
        flows.splice(index, 1);
    }
  }
}
