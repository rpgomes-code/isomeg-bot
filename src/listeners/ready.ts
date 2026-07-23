import { Events, Listener } from '@sapphire/framework';
import { Client } from "../core/client";
import { createListenerLog } from "../lib/logger";
import { seedGuild } from "../db/seed";
import { config } from '../constants/config';
import { createPlayer } from "../music/player";

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
        });

        const player = await createPlayer();
        this.container.player = player;

        for (const guild of client.guilds.cache.values()) {
            await seedGuild(guild.id, guild.name);
        }

        for (const guildConfig of config.guilds) {
            if (guildConfig.id) {
                await seedGuild(guildConfig.id, guildConfig.name);
            }
        }

        this.container.logger.info(
            `Bot is online in ${client.guilds.cache.size} guilds, database synced. Commands will be re-registered on first use.`
        );
    }
}
