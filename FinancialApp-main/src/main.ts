import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

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
    app.use((req: any, res: any, next: () => void) => {
      const traceId =
        req.headers['x-trace-id'] ||
        req.headers['idempotency-key'] ||
        req.headers['x-request-id'] ||
        randomUUID();
      req.traceId = traceId;
      res.setHeader('X-Trace-Id', traceId);
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
