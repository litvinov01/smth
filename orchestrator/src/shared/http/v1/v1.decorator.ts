import {
  Controller,
  SetMetadata,
  Type,
  UseInterceptors,
  applyDecorators,
} from '@nestjs/common';
import {
  V1ResponseFormatter,
  V1_RESPONSE_FORMATTER_KEY,
} from './v1-response-formatter.interface';
import { V1ResponseInterceptor } from './v1-response.interceptor';

/**
 * Marks a controller as API v1: routes are prefixed with `v1/<path>`
 * and handler return values are passed through the given V1 response formatter.
 */
export function V1(
  path: string,
  formatter: Type<V1ResponseFormatter>,
): ClassDecorator {
  return applyDecorators(
    Controller(`v1/${path}`),
    SetMetadata(V1_RESPONSE_FORMATTER_KEY, formatter),
    UseInterceptors(V1ResponseInterceptor),
  );
}
