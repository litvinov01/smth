import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { AppConfigService } from '../../../../config/config.service';
import { MessageConsumer } from '../../../domain/ports/message-consumer.port';
import { CONSUMER_METADATA_KEY, ConsumerOptions } from './consumer.decorator';
import { ConsumerCollection } from './consumer.collection';

@Injectable()
export class ConsumerExplorer implements OnModuleInit {
    private readonly logger = new Logger(ConsumerExplorer.name);

    constructor(
        private readonly discovery: DiscoveryService,
        private readonly reflector: Reflector,
        private readonly appConfig: AppConfigService,
        private readonly consumerCollection: ConsumerCollection,
    ) {}

    onModuleInit(): void {
        if (!this.appConfig.messaging.enabled || !this.appConfig.runsWorkers) {
            return;
        }

        for (const wrapper of this.discovery.getProviders()) {
            const { instance, metatype } = wrapper;
            if (!metatype || !instance) {
                continue;
            }

            const metadata = this.reflector.get<ConsumerOptions | undefined>(CONSUMER_METADATA_KEY, metatype);
            if (!metadata) {
                continue;
            }

            if (metadata.requiresEvm && !this.appConfig.evm.enabled) {
                this.logger.log(`Skipping ${metatype.name} (EVM not configured)`);
                continue;
            }

            const consumer = instance as MessageConsumer;
            if (typeof consumer.handle !== 'function') {
                this.logger.warn(`${metatype.name} is decorated with @Consumer but does not implement handle()`);
                continue;
            }

            this.consumerCollection.add(metadata, consumer);
            this.logger.log(`Registered consumer ${metatype.name} → ${metadata.topic}`);
        }
    }
}
