import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { configureApp } from "./configure-app";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, new ExpressAdapter());
  configureApp(app);
  const swaggerConfig = new DocumentBuilder()
    .setTitle("Azure SAML SSO API")
    .setDescription(
      "Backend API for local users, Microsoft Entra SAML applications, linking, and login flows.",
    )
    .setVersion("1.0")
    .addCookieAuth("azure_saml_session")
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api-docs", app, document);
  await app.listen(Number(process.env.PORT ?? 3001));
}

void bootstrap();
