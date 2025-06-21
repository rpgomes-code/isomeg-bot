import {Events, Listener} from '@sapphire/framework';
import {Client} from "../core/client";

export class ReadyListener extends Listener {
    constructor(context: Listener.LoaderContext, options: Listener.Options) {
        super(context, {
            ...options,
            once: true,
            event: Events.ClientReady,
        });
    }
    public async run(client: Client): Promise<void> {
        this.container.logger.info(`Ready! Logged in as ${client.user?.tag}`);
    }
}