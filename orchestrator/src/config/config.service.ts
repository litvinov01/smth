import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG } from './config.constants';
import { AppConfig, EvmConfig } from './schemas';

@Injectable()
export class AppConfigService {
    constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

    get nodeEnv(): AppConfig['nodeEnv'] {
        return this.config.nodeEnv;
    }

    get port(): number {
        return this.config.port;
    }

    get databaseUrl(): string {
        return this.config.database.url;
    }

    get evm(): EvmConfig {
        return this.config.evm;
    }

    get messaging(): AppConfig['messaging'] {
        return this.config.messaging;
    }

    get runsApi(): boolean {
        const role = this.config.messaging.processRole;
        return role === 'api' || role === 'all';
    }

    get runsWorkers(): boolean {
        const role = this.config.messaging.processRole;
        return role === 'worker' || role === 'all';
    }
}
