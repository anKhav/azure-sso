import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Response } from "express";

interface ExceptionBody {
  code?: string;
  message?: string | string[];
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const traceId = randomUUID();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const body =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const details: ExceptionBody =
      typeof body === "object" && body !== null ? body : {};
    const message = Array.isArray(details.message)
      ? details.message.join("; ")
      : (details.message ??
        (status === 500 ? "An unexpected error occurred" : "Request failed"));
    const code =
      details.code ?? (status === 400 ? "VALIDATION_ERROR" : `HTTP_${status}`);
    if (!(exception instanceof HttpException))
      this.logger.error(`Unhandled error traceId=${traceId}`, exception);
    response.setHeader("X-Trace-Id", traceId);
    response.status(status).json({ error: true, code, message, traceId });
  }
}
