import {Events, Listener} from '@sapphire/framework';
import {Client} from "../core/client";
import {createListenerLog} from "../lib/logger";

export class ReadyListener extends Listener {
    constructor(context: Listener.LoaderContext, options: Listener.Options) {
        super(context, {
            ...options,
            once: true,
            event: Events.ClientReady,
        });
    }
    public async run(client: Client): Promise<void> {
        createListenerLog({
            type: Events.ClientReady,
            guild: "#",
            user: {
                username: client.user.tag,
                displayName: client.user.displayName
            },
            createdAt: new Date()
        })
    }
}