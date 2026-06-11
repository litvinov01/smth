import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
    apiInternalErrorDocs,
    apiNotFoundDocs,
    apiValidationErrorDocs,
    createDocs,
} from '../../../../../shared/http/openapi';
import { TransactionV1ResponseDto } from '../formatters/v1/transaction.v1.dto';

export const TransactionControllerDocs = createDocs([ApiTags('Transactions')])([]);

const transactionEndpointCommonDocs = [...apiValidationErrorDocs, ...apiInternalErrorDocs];

export const CreateTransactionDocs = createDocs(transactionEndpointCommonDocs)([
    ApiOperation({
        summary: 'Create a transaction',
        description:
            // eslint-disable-next-line max-len
            'Registers a new fiat-to-crypto swap transaction in CREATED status. Optionally attach a consumer EVM address for on-chain escrow deployment.',
    }),
    ApiCreatedResponse({
        description: 'Transaction created',
        type: TransactionV1ResponseDto,
    }),
]);

export const SubmitTransactionDocs = createDocs([...transactionEndpointCommonDocs, ...apiNotFoundDocs])([
    ApiOperation({
        summary: 'Submit a transaction for on-chain deployment',
        description:
            // eslint-disable-next-line max-len
            'Deploys the escrow contract for an existing transaction and transitions its status to PENDING while the chain confirms the deployment.',
    }),
    ApiParam({
        name: 'id',
        description: 'UUID v7 transaction identifier',
        example: '018f5e30-8c4a-7b3e-b3d1-8b4e7f6a5d4c',
    }),
    ApiOkResponse({
        description: 'Transaction submitted; deployment pending on chain',
        type: TransactionV1ResponseDto,
    }),
]);

export const GetTransactionDocs = createDocs([...transactionEndpointCommonDocs, ...apiNotFoundDocs])([
    ApiOperation({
        summary: 'Get a transaction by id',
        description: 'Returns the current state of a transaction including chain fields when available.',
    }),
    ApiParam({
        name: 'id',
        description: 'UUID v7 transaction identifier',
        example: '018f5e30-8c4a-7b3e-b3d1-8b4e7f6a5d4c',
    }),
    ApiOkResponse({
        description: 'Transaction found',
        type: TransactionV1ResponseDto,
    }),
]);
