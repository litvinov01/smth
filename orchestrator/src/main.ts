import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { AppConfigService } from './config/config.service';
import { setupSwagger } from './shared/http/openapi';
import { ZodValidationPipe } from 'nestjs-zod';

async function bootstrap() {
    const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

    const config = app.get(AppConfigService);

    app.setGlobalPrefix('/api');
    app.useGlobalPipes(new ZodValidationPipe());
    setupSwagger(app);
    await app.listen(config.port, '0.0.0.0');
}
bootstrap();
