import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NextFunction, Request, Response } from 'express';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const httpsEnabled = process.env.HTTPS_ENABLED === 'true';
  const httpsOptions = httpsEnabled
    ? {
        key: readFileSync(process.env.HTTPS_KEY_PATH ?? ''),
        cert: readFileSync(process.env.HTTPS_CERT_PATH ?? ''),
        ca: process.env.HTTPS_CA_PATH ? readFileSync(process.env.HTTPS_CA_PATH) : undefined,
      }
    : undefined;

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    ...(httpsOptions ? { httpsOptions } : {}),
  });
  const configService = app.get(ConfigService);

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const traceEnabled = configService.get<boolean>('observability.traceEnabled') ?? true;
  if (traceEnabled) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      const requestWithTrace = req as Request & { traceId?: string };
      const traceId =
        requestWithTrace.headers['x-trace-id'] ||
        requestWithTrace.headers['idempotency-key'] ||
        requestWithTrace.headers['x-request-id'] ||
        randomUUID();
      requestWithTrace.traceId = String(traceId);
      res.setHeader('X-Trace-Id', String(traceId));
      next();
    });
  }

  const openapiConfig = new DocumentBuilder()
    .setTitle('Digital Banking Core API')
    .setDescription('API surface for the digital banking MVP core components.')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, openapiConfig);
  SwaggerModule.setup('docs', app, document);

  const port = configService.get('app.port');
  await app.listen(port);
}

bootstrap();
