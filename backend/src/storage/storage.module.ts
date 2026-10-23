import { Global, Module } from "@nestjs/common";
import { JsonFileStore } from "./json-file-store.service";

@Global()
@Module({ providers: [JsonFileStore], exports: [JsonFileStore] })
export class StorageModule {}
