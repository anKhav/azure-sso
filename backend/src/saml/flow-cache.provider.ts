import type { CacheItem, CacheProvider } from "@node-saml/node-saml";
import { SamlFlowService } from "./saml-flow.service";

export class FlowCacheProvider implements CacheProvider {
  constructor(
    private readonly flows: SamlFlowService,
    private readonly appId: string,
  ) {}

  async saveAsync(key: string, value: string): Promise<CacheItem | null> {
    const existing = await this.flows.getRequestCacheValue(key, this.appId);
    return existing ? { value, createdAt: Date.now() } : null;
  }

  getAsync(key: string): Promise<string | null> {
    return this.flows.getRequestCacheValue(key, this.appId);
  }
  removeAsync(key: string | null): Promise<string | null> {
    return key
      ? this.flows.markRequestValidated(key, this.appId)
      : Promise.resolve(null);
  }
}
