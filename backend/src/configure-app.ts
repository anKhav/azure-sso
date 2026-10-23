import { INestApplication, ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import { urlencoded } from "express";
import { ApiExceptionFilter } from "./common/api-exception.filter";

export function configureApp(app: INestApplication): void {
  app.use(cookieParser());
  app.use(urlencoded({ extended: false, limit: "1mb" }));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
    credentials: true,
  });
  app.getHttpAdapter().getInstance().disable("x-powered-by");
}
