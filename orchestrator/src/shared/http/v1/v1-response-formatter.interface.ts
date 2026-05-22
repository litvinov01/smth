export interface V1ResponseFormatter<TInput = unknown, TOutput = unknown> {
    format(value: TInput): TOutput;
}

export const V1_RESPONSE_FORMATTER_KEY = 'v1_response_formatter';
