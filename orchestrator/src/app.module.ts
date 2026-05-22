import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { SharedModule } from './shared/shared.module';
import { TransactionModule } from './transaction/transaction.module';

@Module({
    imports: [ConfigModule, SharedModule, PrismaModule, TransactionModule],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
