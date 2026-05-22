import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { SharedModule } from './shared/shared.module';
import { TransactionModule } from './transaction/transaction.module';

@Module({
  imports: [SharedModule, PrismaModule, TransactionModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
