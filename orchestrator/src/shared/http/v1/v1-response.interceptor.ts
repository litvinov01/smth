import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Type,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ModuleRef } from '@nestjs/core';
import { Observable, map } from 'rxjs';
import {
  V1ResponseFormatter,
  V1_RESPONSE_FORMATTER_KEY,
} from './v1-response-formatter.interface';

@Injectable()
export class V1ResponseInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly moduleRef: ModuleRef,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const formatterType = this.reflector.get<
      Type<V1ResponseFormatter> | undefined
    >(V1_RESPONSE_FORMATTER_KEY, context.getClass());

    if (!formatterType) {
      return next.handle();
    }

    const formatter = this.moduleRef.get(formatterType, { strict: false });

    return next.handle().pipe(
      map((data) => {
        if (data === undefined || data === null) {
          return data;
        }
        if (Array.isArray(data)) {
          return data.map((item) => formatter.format(item));
        }
        return formatter.format(data);
      }),
    );
  }
}
