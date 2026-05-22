import { applyDecorators } from '@nestjs/common';

type DocDecorator = ClassDecorator | MethodDecorator;

export const createDocs =
    (common: DocDecorator[]) =>
    (concrete: DocDecorator[]): MethodDecorator & ClassDecorator =>
        applyDecorators(...common, ...concrete);
