import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { stringify as yamlStringify } from 'yaml';
import { AppModule } from '../src/app.module';

async function generate() {
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle('Digital Banking Core API')
    .setDescription('API surface for the digital banking MVP core components.')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const outputPath = join(process.cwd(), 'openapi', 'openapi.yaml');
  const yaml = yamlStringify(document);
  writeFileSync(outputPath, yaml, 'utf8');

  await app.close();
  console.log(`OpenAPI spec generated at ${outputPath}`);
}

generate().catch((error) => {
  console.error('OpenAPI generation failed', error);
  process.exit(1);
});
