import { Events, Listener } from "@sapphire/framework";

export class ListenerErrorListener extends Listener<typeof Events.ListenerError> {
    public constructor(context: Listener.LoaderContext, options: Listener.Options) {
        super(context, {
            ...options,
            event: Events.ListenerError,
        });
    }

    public run(error: unknown, payload: any): void {
        const listenerName = payload.listener?.name ?? "unknown";
        this.container.logger.error(`[Listener:${listenerName}] ${error instanceof Error ? error.stack ?? error.message : error}`);
    }
}
