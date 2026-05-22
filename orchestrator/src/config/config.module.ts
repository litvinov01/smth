import { Global, Module } from '@nestjs/common';
import { APP_CONFIG } from './config.constants';
import { AppConfigService } from './config.service';
import { loadConfig } from './load-config';

@Global()
@Module({
    providers: [
        {
            provide: APP_CONFIG,
            useFactory: () => loadConfig(),
        },
        AppConfigService,
    ],
    exports: [APP_CONFIG, AppConfigService],
})
export class ConfigModule {}
