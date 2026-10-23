import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

@Injectable()
export class JsonFileStore {
  private readonly directory: string;
  private readonly queues = new Map<string, Promise<unknown>>();

  constructor(config: ConfigService) {
    this.directory = resolve(
      config.get<string>("DATABASE_DIR") ?? join(process.cwd(), "database"),
    );
  }

  async read<T>(fileName: string): Promise<T[]> {
    this.assertFileName(fileName);
    await (this.queues.get(fileName) ?? Promise.resolve());
    return this.readDirect<T>(fileName);
  }

  async mutate<T, R>(
    fileName: string,
    mutation: (records: T[]) => R | Promise<R>,
  ): Promise<R> {
    this.assertFileName(fileName);
    const prior = this.queues.get(fileName) ?? Promise.resolve();
    const operation = prior
      .catch(() => undefined)
      .then(async () => {
        const records = await this.readDirect<T>(fileName);
        const result = await mutation(records);
        await this.writeAtomic(fileName, records);
        return result;
      });
    this.queues.set(fileName, operation);
    try {
      return await operation;
    } finally {
      if (this.queues.get(fileName) === operation) this.queues.delete(fileName);
    }
  }

  private assertFileName(fileName: string): void {
    if (basename(fileName) !== fileName || !fileName.endsWith(".json"))
      throw new Error("Invalid JSON store filename");
  }

  private async readDirect<T>(fileName: string): Promise<T[]> {
    await mkdir(this.directory, { recursive: true });
    try {
      const parsed: unknown = JSON.parse(
        await readFile(join(this.directory, fileName), "utf8"),
      );
      if (!Array.isArray(parsed))
        throw new Error(`${fileName} must contain a JSON array`);
      return parsed as T[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  private async writeAtomic<T>(fileName: string, records: T[]): Promise<void> {
    const destination = join(this.directory, fileName);
    const temporary = `${destination}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(records, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporary, destination);
  }
}
