export interface MessageConsumer {
    handle(payload: unknown): Promise<void>;
}
