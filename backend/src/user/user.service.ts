import { HttpStatus, Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { compare, hash } from "bcrypt";
import { randomUUID } from "node:crypto";
import { ApiError } from "../common/api-error";
import { JsonFileStore } from "../storage/json-file-store.service";
import { LoginUserDto } from "./dto/login-user.dto";
import { RegisterUserDto } from "./dto/register-user.dto";
import { PublicUser, UserRecord } from "./user.model";

@Injectable()
export class UserService implements OnModuleInit {
  private static readonly FILE_NAME = "users.json";
  private static readonly ADMIN_ID = "11111111-1111-4111-8111-111111111111";
  constructor(private readonly store: JsonFileStore, private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const email = (this.config.get<string>("ADMIN_EMAIL") ?? "admin@gmail.com").trim().toLowerCase();
    const password = this.config.get<string>("ADMIN_PASSWORD") ?? "Password#1Password#1";
    const passwordHash = await hash(password, 12);
    await this.store.mutate<UserRecord, void>(UserService.FILE_NAME, (users) => {
      for (const user of users) if (!user.role) user.role = "user";
      let admin = users.find((user) => user.id === UserService.ADMIN_ID);
      if (!admin) {
        admin = { id: UserService.ADMIN_ID, email, passwordHash, role: "admin", createdAt: new Date().toISOString() };
        users.push(admin);
      } else {
        admin.email = email;
        admin.passwordHash = passwordHash;
        admin.role = "admin";
      }
      for (let index = users.length - 1; index >= 0; index -= 1)
        if (users[index].id !== UserService.ADMIN_ID && users[index].email.toLowerCase() === email)
          users.splice(index, 1);
    });
  }

  async register(dto: RegisterUserDto): Promise<PublicUser> {
    const email = dto.email.trim().toLowerCase();
    const passwordHash = await hash(dto.password, 12);
    return this.store.mutate<UserRecord, PublicUser>(
      UserService.FILE_NAME,
      (users) => {
        if (users.some((user) => user.email.toLowerCase() === email)) {
          throw new ApiError(
            "EMAIL_ALREADY_REGISTERED",
            "An account with this email already exists",
            HttpStatus.CONFLICT,
          );
        }
        const user: UserRecord = {
          id: randomUUID(),
          email,
          passwordHash,
          role: "user",
          createdAt: new Date().toISOString(),
        };
        users.push(user);
        return this.toPublic(user);
      },
    );
  }

  async authenticate(dto: LoginUserDto): Promise<PublicUser> {
    const email = dto.email.trim().toLowerCase();
    const users = await this.store.read<UserRecord>(UserService.FILE_NAME);
    const user = users.find(
      (candidate) => candidate.email.toLowerCase() === email,
    );
    if (!user || !(await compare(dto.password, user.passwordHash))) {
      throw new ApiError(
        "INVALID_CREDENTIALS",
        "Email or password is incorrect",
        HttpStatus.UNAUTHORIZED,
      );
    }
    return this.toPublic(user);
  }

  async findPublicById(id: string): Promise<PublicUser> {
    const users = await this.store.read<UserRecord>(UserService.FILE_NAME);
    const user = users.find((candidate) => candidate.id === id);
    if (!user)
      throw new ApiError(
        "USER_NOT_FOUND",
        "User not found",
        HttpStatus.NOT_FOUND,
      );
    return this.toPublic(user);
  }

  async list(): Promise<PublicUser[]> {
    return (await this.store.read<UserRecord>(UserService.FILE_NAME)).map((user) =>
      this.toPublic({ ...user, role: user.role ?? "user" }),
    );
  }

  async delete(id: string): Promise<void> {
    await this.store.mutate<UserRecord, void>(UserService.FILE_NAME, (users) => {
      const index = users.findIndex((user) => user.id === id);
      if (index === -1) throw new ApiError("USER_NOT_FOUND", "User not found", HttpStatus.NOT_FOUND);
      if (users[index].role === "admin" || users[index].id === UserService.ADMIN_ID)
        throw new ApiError("ADMIN_CANNOT_BE_DELETED", "The static administrator cannot be deleted", HttpStatus.FORBIDDEN);
      users.splice(index, 1);
    });
  }

  private toPublic(user: UserRecord): PublicUser {
    const { passwordHash: _passwordHash, ...publicUser } = user;
    return { ...publicUser, role: user.role ?? "user" };
  }
}
