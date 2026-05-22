import { Global, Module } from '@nestjs/common';
import { V1ResponseInterceptor } from './http/v1/v1-response.interceptor';

@Global()
@Module({
    providers: [V1ResponseInterceptor],
    exports: [V1ResponseInterceptor],
})
export class SharedModule {}
