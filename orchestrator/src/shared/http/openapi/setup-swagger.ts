import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
    const config = new DocumentBuilder()
        .setTitle('Swap Orchestrator API')
        .setDescription('Backend orchestrator for digital-fiat currency exchange')
        .setVersion('1.0')
        .addTag('Transactions', 'Create and track fiat-to-crypto swap transactions')
        .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
}
