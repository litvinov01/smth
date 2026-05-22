import { ApiBadRequestResponse, ApiInternalServerErrorResponse, ApiNotFoundResponse } from '@nestjs/swagger';

export const apiValidationErrorDocs = [
    ApiBadRequestResponse({
        description: 'Request validation failed',
        schema: {
            example: {
                statusCode: 400,
                message: 'Validation failed',
                errors: [{ path: 'currency', message: 'Must be a 3-letter ISO 4217 code (e.g. EUR)' }],
            },
        },
    }),
];

export const apiNotFoundDocs = [
    ApiNotFoundResponse({
        description: 'Resource not found',
        schema: {
            example: {
                statusCode: 404,
                message: 'Transaction not found',
                error: 'Not Found',
            },
        },
    }),
];

export const apiInternalErrorDocs = [
    ApiInternalServerErrorResponse({
        description: 'Unexpected server error',
        schema: {
            example: {
                statusCode: 500,
                message: 'Internal Server Error',
            },
        },
    }),
];
