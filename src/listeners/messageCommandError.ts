import { Events, Listener } from "@sapphire/framework";

export class MessageCommandErrorListener extends Listener<typeof Events.MessageCommandError> {
    public constructor(context: Listener.LoaderContext, options: Listener.Options) {
        super(context, {
            ...options,
            event: Events.MessageCommandError,
        });
    }

    public async run(error: unknown, payload: any): Promise<void> {
        const commandName = payload.command?.name ?? "unknown";
        this.container.logger.error(`[MessageCommand:${commandName}] ${error instanceof Error ? error.stack ?? error.message : error}`);
        await payload.message?.reply("Something went wrong while running that command. The error was logged.").catch(() => null);
    }
}
